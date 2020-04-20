import express, {Express} from "express";
import cors from "cors";
import SocketIO from "socket.io";
import {Worker} from "mediasoup/lib/Worker";
import {Router} from "mediasoup/lib/Router";
import * as https from "https";
import {Server} from "https";
import {Consumer} from "mediasoup/lib/Consumer";
import {Producer} from "mediasoup/lib/Producer";
import {WebRtcTransport} from "mediasoup/lib/WebRtcTransport";
import {DtlsParameters} from "mediasoup/src/WebRtcTransport";
import {MediaKind, RtpParameters} from "mediasoup/src/RtpParameters";
import {RtpCapabilities} from "mediasoup/lib/RtpParameters";
import * as fs from "fs";
import admin from "firebase-admin";
import {v4 as uuidv4} from 'uuid';
// @ts-ignore
import * as timesyncServer from "timesync/server";

const mediasoup = require("mediasoup");

const serviceAccount = require("./firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

let mediasoupRouter: Router;
const config = require("./config");

interface Actor {
    uid: string;
    name: string;
    role: "actor" | "director";
    socketId: string;
    transports: {
        [id: string]: WebRtcTransport;
    };
    producers: {
        [id: string]: Producer;
    };
    consumers: {
        [id: string]: Consumer;
    };
}

interface Stage {
    id: string;
    name: string;
    communication: 'p2p' | 'server';
    type: 'theater' | 'music' | 'conference';
    actors: Actor[];
}

const stages: Stage[] = [];


const main = async () => {
    const app: Express = express();
    app.use(cors({origin: true}));
    app.options("*", cors());
    app.use('/timesync', timesyncServer.requestHandler);

    const webServer: Server = https.createServer({
        key: fs.readFileSync(config.sslKey),
        cert: fs.readFileSync(config.sslCrt),
        ca: config.ca && fs.readFileSync(config.ca),
        requestCert: false,
        rejectUnauthorized: false
    }, app);

    const worker: Worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort
    });
    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    mediasoupRouter = await worker.createRouter({mediaCodecs});

    app.get("/", (req, res) => {
        res.status(200).send("Alive and kickin'");
    });

    //TODO: Remove the following lines
    stages.push({
        id: "stage1",
        name: "My first Stage with mediasoup",
        communication: "server",
        type: "music",
        actors: []
    });
    stages.push({
        id: "stage2",
        name: "My first Stage with P2P",
        communication: "p2p",
        type: "music",
        actors: []
    });

    const handleConnection = (socket: SocketIO.Socket) => {
        let stage: Stage | undefined;
        let user: admin.auth.UserRecord | undefined;
        let actor: Actor | undefined;
        console.log("New connection from " + socket.id);

        socket.on("get-rtp-capabilities", async ({}, callback) => {
            callback(mediasoupRouter.rtpCapabilities);
        });

        /*** CREATE SEND TRANSPORT ***/
        socket.on("create-send-transport", async (data: {}, callback) => {
            console.log(socket.id + ": create-send-transport");
            if (!stage || !actor || !user) {
                console.error("create-transport before successful join-room");
                return;
            }
            const transport: WebRtcTransport = await mediasoupRouter.createWebRtcTransport({
                listenIps: config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
            });
            if (config.mediasoup.webRtcTransport.maxIncomingBitrate) {
                try {
                    await transport.setMaxIncomingBitrate(config.mediasoup.webRtcTransport.maxIncomingBitrate);
                } catch (error) {
                }
            }
            actor.transports[transport.id] = transport;
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        });

        /*** CREATE RECEIVE TRANSPORT ***/
        socket.on("create-receive-transport", async (data: {
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": create-receive-transport");
            if (!stage || !user) {
                console.error("create-transport before successful join-stage");
                return;
            }
            const transport: WebRtcTransport = await mediasoupRouter.createWebRtcTransport({
                listenIps: config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
            });
            actor.transports[transport.id] = transport;
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        });

        /*** CONNECT TRANSPORT ***/
        socket.on("connect-transport", async (data: {
            transportId: string;
            dtlsParameters: DtlsParameters;
        }, callback) => {
            console.log(socket.id + ": connect-transport " + data.transportId);
            const transport: WebRtcTransport = actor.transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            await transport.connect({dtlsParameters: data.dtlsParameters});
            /*** ANSWER BY SENDING EXISTING MEMBERS AND DIRECTOR ***/
            callback({connected: true});
        });

        /*** SEND TRACK ***/
        socket.on("send-track", async (data: {
            transportId: string;
            rtpParameters: RtpParameters;
            kind: MediaKind;
        }, callback) => {
            console.log(socket.id + ": send-track");
            const transport: WebRtcTransport = actor.transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            const producer: Producer = await transport.produce({
                kind: data.kind,
                rtpParameters: data.rtpParameters
            });
            producer.on("transportclose", () => {
                console.log("producer's transport closed", producer.id);
                //closeProducer(producer);
            });
            actor.producers[producer.id] = producer;
            // Inform all about new producer
            socket.broadcast.emit("producer-added", {
                uid: actor.uid,
                producerId: producer.id
            });
            callback({id: producer.id});
        });

        /*** CONSUME (paused track) ***/
        socket.on("consume", async (data: {
            producerId: string;
            transportId: string;
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": consume");
            const transport: WebRtcTransport = actor.transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            const consumer: Consumer = await transport.consume({
                producerId: data.producerId,
                rtpCapabilities: data.rtpCapabilities,
                paused: true
            });
            actor.consumers[consumer.id] = consumer;
            callback({
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                producerPaused: consumer.producerPaused,
                type: consumer.type
            });
        });

        /*** FINISH CONSUME (resume track after successful consume establishment) ***/
        socket.on("finish-consume", async (data: {
            uid: string;
            consumerId: string;
        }, callback) => {
            console.log(socket.id + ": finished consume");
            const actor: Actor = stage.actors.find((actor: Actor) => actor.uid === data.uid);
            if (!actor) {
                return callback({error: "actor not found"});
            }
            const consumer: Consumer = actor.consumers[data.consumerId];
            if (!consumer) {
                return callback({error: "consumer not found"});
            }
            consumer.resume().then(
                () => callback()
            );
        });

        /*** Common ***/
        socket.on('create-stage', (data: {
            name: string;
            communication: 'p2p' | 'server';
            type: 'theater' | 'music' | 'conference';
            token: string;
        }, callback) => {
            admin.auth().verifyIdToken(data.token)
                .then((decodedIdToken: admin.auth.DecodedIdToken) => {
                    admin.auth().getUser(decodedIdToken.uid)
                        .then((userRecord: admin.auth.UserRecord) => {
                            user = userRecord;
                            actor = {
                                uid: userRecord.uid,
                                name: userRecord.displayName,
                                socketId: socket.id,
                                role: "director",
                                transports: {},
                                consumers: {},
                                producers: {}
                            };
                            const stage: Stage = {
                                id: uuidv4(),
                                name: data.name,
                                actors: [actor],
                                type: data.type,
                                communication: data.communication
                            };
                            stages.push(stage);
                            console.log(actor.name + " created a new stage: " + stage.name);
                            callback({
                                id: stage.id,
                                name: stage.name,
                                communication: stage.communication,
                                type: stage.type
                            });
                        })
                })
                .catch((error) => callback({error: error}));
        });
        socket.on('join-stage', async (data: {
            stageId: string;
            token: string;
        }, callback) => {
            stage = stages.find((stage: Stage) => stage.id === data.stageId);
            if (!stage)
                return callback({error: "Could not find stage with id " + data.stageId});
            return admin.auth().verifyIdToken(data.token)
                .then((decodedIdToken: admin.auth.DecodedIdToken) => {
                    admin.auth().getUser(decodedIdToken.uid)
                        .then((userRecord: admin.auth.UserRecord) => {
                            actor = {
                                uid: userRecord.uid,
                                name: userRecord.displayName,
                                role: "actor",
                                socketId: socket.id,
                                transports: {},
                                consumers: {},
                                producers: {}
                            };
                            user = userRecord;
                            stage.actors.push(actor);
                            console.log(actor.name + " entered the stage");
                            socket.broadcast.emit("participant-added", {
                                uid: actor.uid,
                                socketId: socket.id,
                                role: actor.role,
                                name: actor.name
                            });
                            return callback({
                                id: stage.id,
                                name: stage.name,
                                communication: stage.communication,
                                type: stage.type
                            });
                        })
                })
                .catch((error) => callback({error: error}));
        });
        socket.on('get-actors', (data: {}, callback) => {
            if (!stage)
                return callback({error: "Join first"});
            return callback({
                actors: stage.actors.map((actor: Actor) => ({
                    uid: actor.uid,
                    name: actor.name,
                    role: actor.role,
                    socketId: actor.socketId,
                    _mediasoup: actor.producers ? {
                        producerIds: Object.values(actor.producers).map((producer: Producer) => producer.id)
                    } : undefined
                }))
            });
        });


        /*** P2P Signaling ***/
        /*socket.broadcast.emit('participants-added', {
            users: [socket.id]
        });*/

        socket.on('disconnect', () => {
            console.log(actor ? actor.name : socket.id + " left the stage");
            if (stage)
                stage.actors = stage.actors.filter((actor: Actor) => actor.uid !== user.uid);
            socket.emit('participant-removed', socket.id);
        });

        socket.on('make-offer', (data: {
            offer: any;
            toSocketId: string;
        }) => {
            if (!actor) {
                console.error("No actor available");
                return;
            }
            socket.to(data.toSocketId).emit('offer-made', {
                uid: actor.uid,
                socketId: socket.id,
                role: actor.role,
                name: actor.name,
                offer: data.offer
            });
        });

        socket.on('make-answer', (data) => {
            socket.to(data.to).emit('answer-made', {
                socketId: socket.id,
                answer: data.answer
            });
        });

        socket.on('send-candidate', (data) => {
            socket.to(data.to).emit('candidate-sent', {
                socketId: socket.id,
                candidate: data.candidate
            });
        });
    };

    const socketServer: SocketIO.Server = SocketIO(webServer);
    socketServer.on("connection", handleConnection);
    socketServer.origins("*:*");

    webServer.listen(config.listenPort, () => {
        console.log("Running digital stage on port " + config.listenPort);
    });

};
main();
