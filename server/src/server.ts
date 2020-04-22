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

        const joinRoomAndInitializeAllServices = (stageId: string, uid: string,) => {
            socket.join(stageId);
            // Add socket event handler for webrtc (p2p-*), mediasoup (ms-*) and soundjack (sj-*)
            webRTCHandler.initializeSingleSocket(socket, stageId, uid);
            mediasoupHandler.initializeSingleSocket(socket, stageId, uid);
            socket.on("sj-send-ip", (data: {
                ip: string;
                port: number;
            }) => {
                socket.emit("sj-ip-sent", {
                    uid: uid,
                    ip: data.ip,
                    port: data.port
                });
            });
            socket.broadcast.to(stageId).emit("p2p-peer-added", {
                uid: uid,
                socketId: socket.id
            });
        };

        socket.on("create-stage", (data: {
            token: string;
            stageName: string;
            type: "theater" | "music" | "conference";
        }, callback) => {
            console.log("create-stage(" + data.token + ", " + data.stageName + ", " + data.type + ")");
            admin.auth().verifyIdToken(data.token)
                .then(
                    (decodedIdToken: admin.auth.DecodedIdToken) => {
                        //TODO: Add role management by verifying permission to create stage
                        admin.firestore().collection("stages").add({
                            name: data.stageName,
                            type: data.type,
                            directorUid: decodedIdToken.uid
                        }).then(
                            (docRef: admin.firestore.DocumentReference) => {
                                joinRoomAndInitializeAllServices(docRef.id, decodedIdToken.uid);
                                callback(docRef.id);
                            }
                        );
                    });
        });

        socket.on("join-stage", (data: {
            token: string;
            stageId: string;
        }, callback) => {
            console.log("join-stage(" + data.token + ", " + data.stageId + ")");
            admin.auth().verifyIdToken(data.token)
                .then(
                    (decodedIdToken: admin.auth.DecodedIdToken) => {
                        //TODO: Add role management by verifying access to stage
                        admin.firestore().collection("stages").doc(data.stageId).get()
                            .then((doc: admin.firestore.DocumentSnapshot) => {
                                if (doc.exists) {
                                    const docData = doc.data();
                                    joinRoomAndInitializeAllServices(data.stageId, decodedIdToken.uid);
                                    callback({
                                        stage: {
                                            ...docData,
                                            id: data.stageId
                                        }
                                    });
                                } else {
                                    callback({error: "Could not find stage"});
                                }
                            });
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
