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

const initializeSocketCommunication = async () => {
    const mediasoupHandler: MediasoupHandler = new MediasoupHandler();
    await mediasoupHandler.initialize();
    const webRTCHandler: WebRTCHandler = new WebRTCHandler();
    await webRTCHandler.initialize();

    const SocketHandler = (socket: SocketIO.Socket) => {
        socket.on("create-stage", (data: {
            token: string;
            stageName: string;
            type: "theater" | "music" | "conference";
        }, callback) => {
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
                                socket.join(docRef.id);
                                webRTCHandler.initializeSingleSocket(socket, docRef.id, decodedIdToken.uid);
                                mediasoupHandler.initializeSingleSocket(socket, docRef.id, decodedIdToken.uid);
                                callback(docRef.id);
                            }
                        );
                    });
        });

        socket.on("join-stage", (data: {
            token: string;
            stageId: string;
        }, callback) => {
            admin.auth().verifyIdToken(data.token)
                .then(
                    (decodedIdToken: admin.auth.DecodedIdToken) => {
                        //TODO: Add role management by verifying access to stage
                        admin.firestore().collection("stages").doc(data.stageId).get()
                            .then((doc: admin.firestore.DocumentSnapshot) => {
                                if (doc.exists) {
                                    const docData = doc.data();
                                    socket.join(data.stageId);
                                    webRTCHandler.initializeSingleSocket(socket, data.stageId, decodedIdToken.uid);
                                    mediasoupHandler.initializeSingleSocket(socket, data.stageId, decodedIdToken.uid);
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
    const socketServer: SocketIO.Server = SocketIO(webServer);
    socketServer.origins("*:*");
    socketServer.use(SocketHandler);
};


webServer.listen(config.listenPort, () => {
    console.log("Running digital stage on port " + config.listenPort + " ...");
    initializeSocketCommunication().then(
        () => console.log("Socket communication ready to please ;-)\nPlease world, tear down this serer enormous with your unlimited creativity!")
    );
});
