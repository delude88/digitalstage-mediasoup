import express, {Express} from "express";
import cors from "cors";
import SocketIO from "socket.io";
import {Worker} from "mediasoup/lib/Worker";
import {Router} from "mediasoup/lib/Router";
import * as http from "http";
import {Server} from "http";
import {Consumer} from "mediasoup/lib/Consumer";
import {Producer} from "mediasoup/lib/Producer";
import {WebRtcTransport} from "mediasoup/lib/WebRtcTransport";
import {DtlsParameters} from "mediasoup/src/WebRtcTransport";
import {MediaKind, RtpParameters} from "mediasoup/src/RtpParameters";
import {RtpCapabilities} from "mediasoup/lib/RtpParameters";

const mediasoup = require("mediasoup");

let mediasoupRouter: Router;
const config = require("./config");

const port: number = parseInt(process.env.PORT) || 3001;

interface Member {
    id: string;
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

type Director = Member

interface Room {
    id: string;
    members: Member[];
    director?: Director;
}

const rooms: Room[] = [];


const main = async () => {
    const app: Express = express();
    app.use(cors({origin: true}));
    app.options("*", cors());

    const webServer: Server = http.createServer({}, app);

    const worker: Worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort
    });
    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    mediasoupRouter = await worker.createRouter({mediaCodecs});

    app.post("/rooms/create", async (req, res) => {
        const roomName: string = req.body.name;
        if (rooms.find((room: Room) => room.id === roomName) !== null) {
            return res.status(400).json({error: "Room already exsists"});
        }
        rooms.push({
            id: roomName,
            members: []
        });
        res.status(200).json({status: "ok"});
    });

    //TODO: Remove the following line
    rooms.push({
        id: "myroom",
        members: [],
    });

    const handleConnection = (socket: SocketIO.Socket) => {
        let room: Room | undefined;
        let member: Member | undefined;
        console.log("New connection from " + socket.id);

        /*** JOIN ROOM (answer: rtp capabilities) ***/
        socket.on("join-room", async (data: {
            memberId: string;
            roomName: string;
            isDirector: boolean;
        }, callback) => {
            console.log(socket.id + ": join-room");
            //TODO: If switching room, disconnect first
            room = rooms.find((room: Room) => room.id === data.roomName);
            if (room) {
                member = {
                    id: data.memberId,
                    transports: {},
                    consumers: {},
                    producers: {}
                };
                if (data.isDirector) {
                    //TODO: Handle if director is already present
                    room.director = member;
                } else {
                    room.members.push(member);
                }
                callback(mediasoupRouter.rtpCapabilities);
            } else {
                callback(null);
            }
        });

        /*** CREATE TRANSPORT ***/
        socket.on("create-send-transport", async (data: {}, callback) => {
            console.log(socket.id + ": create-send-transport");
            if (!room || !member) {
                console.error("create-transport before successful join-room");
                return;
            }
            const transport: WebRtcTransport = await mediasoupRouter.createWebRtcTransport({
                listenIps: config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
                appData: {peerId: member.id, clientDirection: "send"}
            });
            if (config.mediasoup.webRtcTransport.maxIncomingBitrate) {
                try {
                    await transport.setMaxIncomingBitrate(config.mediasoup.webRtcTransport.maxIncomingBitrate);
                } catch (error) {
                }
            }
            member.transports[transport.id] = transport;
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        });

        socket.on("create-receive-transport", async (data: {
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": create-receive-transport");
            if (!room || !member) {
                console.error("create-transport before successful join-room");
                return;
            }
            const transport: WebRtcTransport = await mediasoupRouter.createWebRtcTransport({
                listenIps: config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate,
                appData: {peerId: member.id, clientDirection: "recv"}
            });
            member.transports[transport.id] = transport;
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        });

        socket.on("connect-transport", async (data: {
            transportId: string;
            dtlsParameters: DtlsParameters;
        }, callback) => {
            console.log(socket.id + ": connect-transport " + data.transportId);
            const transport: WebRtcTransport = member.transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            await transport.connect({dtlsParameters: data.dtlsParameters});
            callback({connected: true});
        });

        socket.on("send-track", async (data: {
            transportId: string;
            rtpParameters: RtpParameters;
            kind: MediaKind;
        }, callback) => {
            console.log(socket.id + ": send-track");
            const transport: WebRtcTransport = member.transports[data.transportId];
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
            member.producers[producer.id] = producer;
            // Inform all about new producer
            socket.emit("producer-added", {
                id: producer.id
            });
            callback({id: producer.id});
        });

        socket.on("consume", async (data: {
            producerId: string;
            transportId: string;
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": consume");
            const transport: WebRtcTransport = member.transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            const consumer: Consumer = await transport.consume({
                producerId: data.producerId,
                rtpCapabilities: data.rtpCapabilities,
                paused: true
            });
            member.consumers[consumer.id] = consumer;
            callback({
                id: consumer.id,
                producerId: consumer.producerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                producerPaused: consumer.producerPaused,
                type: consumer.type
            });
        });

        socket.on("finish-consume", async (data: {
            id: string;
        }, callback) => {
            console.log(socket.id + ": finished consume");
            const consumer: Consumer = member.consumers[data.id];
            if (!consumer) {
                callback({error: "consumer not found"});
            }
            consumer.resume().then(
                () => callback()
            );
        });
    };
    const socketServer: SocketIO.Server = SocketIO(webServer);
    socketServer.on("connection", handleConnection);
    socketServer.origins("*:*");

    webServer.listen(port, () => {
        console.log("Running digital stage on port " + port);
    });

};
main();

async function createWebRtcTransport(router: Router, {peerId, direction}: any): Promise<WebRtcTransport> {
    const {
        listenIps,
        initialAvailableOutgoingBitrate
    } = config.mediasoup.webRtcTransport;

    return await router.createWebRtcTransport({
        listenIps: listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: initialAvailableOutgoingBitrate,
        appData: {peerId, clientDirection: direction}
    });
}
