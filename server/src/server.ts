import express, {Express} from "express";
import cors from "cors";
import * as https from "https";
import {Server} from "https";
import * as fs from "fs";
import SocketIO from "socket.io";
import admin from "firebase-admin";
import WebRTCHandler from "./api/webrtc";
//@ts-ignore
import * as timesyncServer from "timesync/server";
import MediasoupHandler from "./api/mediasoup";

const config = require("./config");

// Initialize firebase
const serviceAccount = require("../firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://digitalstage-wirvsvirus.firebaseio.com"
});


// Initialize express
const app: Express = express();
app.use(cors({origin: true}));
app.options("*", cors());
app.get("/", (req, res) => {
    res.status(200).send("Alive and kickin'");
});
app.use("/timesync", timesyncServer.requestHandler);

// Initialize HTTPS
const webServer: Server = https.createServer({
    key: fs.readFileSync(config.sslKey),
    cert: fs.readFileSync(config.sslCrt),
    ca: config.ca && fs.readFileSync(config.ca),
    requestCert: false,
    rejectUnauthorized: false
}, app);

const socketServer: SocketIO.Server = SocketIO(webServer);
const initializeSocketCommunication = async () => {
    const mediasoupHandler: MediasoupHandler = new MediasoupHandler();
    await mediasoupHandler.initialize();
    const webRTCHandler: WebRTCHandler = new WebRTCHandler();
    await webRTCHandler.initialize();

    const SocketHandler = (socket: SocketIO.Socket) => {
        console.log("Got new socket connection " + socket.id + " from " + socket.handshake.address);

        const joinRoomAndInitializeAllServices = (stageId: string, user: admin.auth.UserRecord) => {
            socket.join(stageId);
            // Add socket event handler for webrtc (p2p-*), mediasoup (ms-*) and soundjack (sj-*)
            webRTCHandler.initializeSingleSocket(socket, stageId, user.uid);
            mediasoupHandler.initializeSingleSocket(socket, stageId, user.uid);
            socket.on("sj-send-ip", (data: {
                ip: string;
                port: number;
            }) => {
                socket.emit("sj-ip-sent", {
                    uid: user.uid,
                    ip: data.ip,
                    port: data.port
                });
            });
            socket.broadcast.to(stageId).emit("client-added", {
                uid: user.uid,
                name: user.displayName,
                socketId: socket.id
            });
        };

        socket.on("create-stage", (data: {
            token: string;
            stageName: string;
            type: "theater" | "music" | "conference";
            password: string | null;
        }, callback) => {
            console.log("create-stage()");
            admin.auth().verifyIdToken(data.token)
                .then(
                    (decodedIdToken: admin.auth.DecodedIdToken) => {
                        //TODO: Add role management by verifying permission to create stage
                        admin.firestore().collection("stages").add({
                            name: data.stageName,
                            type: data.type,
                            password: data.password,
                            directorUid: decodedIdToken.uid
                        }).then(
                            (docRef: admin.firestore.DocumentReference) => {
                                admin.auth().getUser(decodedIdToken.uid).then(
                                    (user: admin.auth.UserRecord) => {
                                        joinRoomAndInitializeAllServices(docRef.id, user);
                                        callback(docRef.id);
                                    }
                                );
                            }
                        );
                    });
        });

        socket.on("join-stage", (data: {
            token: string;
            stageId: string;
            password: string | null;
        }, callback) => {
            console.log("join-stage()");
            admin.auth().verifyIdToken(data.token)
                .then(
                    (decodedIdToken: admin.auth.DecodedIdToken) => {
                        //TODO: Add role management by verifying access to stage
                        admin.firestore().collection("stages").doc(data.stageId).get()
                            .then((doc: admin.firestore.DocumentSnapshot) => {
                                if (doc.exists) {
                                    const docData = doc.data();
                                    if (docData.password === data.password) {
                                        admin.auth().getUser(decodedIdToken.uid).then(
                                            (user: admin.auth.UserRecord) => {
                                                joinRoomAndInitializeAllServices(data.stageId, user);
                                                callback({
                                                    stage: {
                                                        ...docData,
                                                        id: data.stageId
                                                    }
                                                });
                                            });
                                    } else {
                                        callback({error: "Wrong password"});
                                    }
                                } else {
                                    callback({error: "Could not find stage"});
                                }
                            });
                    });
        });

        // DEPRECATED
        socket.broadcast.emit("add-users", {
            users: [socket.id]
        });

        socket.on("connect", () => {
            socketServer.emit("add-users", socket.id);
        });

        socket.on("disconnect", () => {
            socketServer.emit("remove-user", socket.id);
        });

        socket.on("make-offer", (data) => {
            socket.to(data.to).emit("offer-made", {
                offer: data.offer,
                socket: socket.id
            });
        });

        socket.on("make-answer", (data) => {
            socket.to(data.to).emit("answer-made", {
                socket: socket.id,
                answer: data.answer
            });
        });

        socket.on("send-candidate", (data) => {
            socket.to(data.to).emit("candidate-sent", {
                socket: socket.id,
                candidate: data.candidate
            });
        });
    };

    socketServer.origins("*:*");
    //socketServer.use(SocketHandler);
    socketServer.on("connection", SocketHandler);
};

webServer.listen(config.listenPort, () => {
    console.log("Running digital stage on port " + config.listenPort + " ...");
    initializeSocketCommunication().then(
        () => console.log("Socket communication ready to please ;-)\nPlease world, tear down this serer enormous with your unlimited creativity!")
    );
});
