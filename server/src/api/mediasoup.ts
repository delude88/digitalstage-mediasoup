import SocketIO from "socket.io";
import {Worker} from "mediasoup/lib/Worker";
import {Router} from "mediasoup/lib/Router";
import {WebRtcTransport} from "mediasoup/lib/WebRtcTransport";
import {Producer} from "mediasoup/lib/Producer";
import {Consumer} from "mediasoup/lib/Consumer";
import {RtpCapabilities} from "mediasoup/lib/RtpParameters";
import {DtlsParameters} from "mediasoup/src/WebRtcTransport";
import {MediaKind, RtpParameters} from "mediasoup/src/RtpParameters";

const mediasoup = require("mediasoup");

const config = require("./../config");

const mediaCodecs = config.mediasoup.router.mediaCodecs;

export default class MediasoupHandler {
    private worker: Worker | null = null;
    private stageRouter: {
        [stageId: string]: Router;
    } = {};

    public initialize = async (): Promise<void> => {
        this.worker = await mediasoup.createWorker({
            logLevel: config.mediasoup.worker.logLevel,
            logTags: config.mediasoup.worker.logTags,
            rtcMinPort: config.mediasoup.worker.rtcMinPort,
            rtcMaxPort: config.mediasoup.worker.rtcMaxPort
        });
        console.log("Initialized MediasoupHandler");
    };

    private getStageRouter = async (stageId: string): Promise<Router> => {
        if (!this.stageRouter[stageId]) {
            this.stageRouter[stageId] = await this.worker.createRouter(mediaCodecs);
        }
        return this.stageRouter[stageId];
    };

    public initializeSingleSocket = async (socket: SocketIO.Socket, stageId: string, uid: string) => {
        const router: Router = await this.getStageRouter(stageId);
        const transports: {
            [id: string]: WebRtcTransport;
        } = {};
        const producers: {
            [id: string]: Producer;
        } = {};
        const consumers: {
            [id: string]: Consumer;
        } = {};

        socket.on("ms-get-rtp-capabilities", async ({}, callback) => {
            callback(router.rtpCapabilities);
        });

        /*** CREATE SEND TRANSPORT ***/
        socket.on("ms-create-send-transport", async (data: {}, callback) => {
            console.log(socket.id + ": ms-create-send-transport");
            try {
                const transport: WebRtcTransport = await router.createWebRtcTransport({
                    listenIps: config.mediasoup.webRtcTransport.listenIps,
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                    initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
                });
                if (config.mediasoup.webRtcTransport.maxIncomingBitrate) {
                    await transport.setMaxIncomingBitrate(config.mediasoup.webRtcTransport.maxIncomingBitrate);
                }
                transports[transport.id] = transport;
                callback({
                    id: transport.id,
                    iceParameters: transport.iceParameters,
                    iceCandidates: transport.iceCandidates,
                    dtlsParameters: transport.dtlsParameters
                });
            } catch (error) {
                callback({error: error});
            }
        });

        /*** CREATE RECEIVE TRANSPORT ***/
        socket.on("ms-create-receive-transport", async (data: {
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": ms-create-receive-transport");
            const transport: WebRtcTransport = await router.createWebRtcTransport({
                listenIps: config.mediasoup.webRtcTransport.listenIps,
                enableUdp: true,
                enableTcp: true,
                preferUdp: true,
                initialAvailableOutgoingBitrate: config.mediasoup.webRtcTransport.initialAvailableOutgoingBitrate
            });
            transports[transport.id] = transport;
            callback({
                id: transport.id,
                iceParameters: transport.iceParameters,
                iceCandidates: transport.iceCandidates,
                dtlsParameters: transport.dtlsParameters
            });
        });

        /*** CONNECT TRANSPORT ***/
        socket.on("ms-connect-transport", async (data: {
            transportId: string;
            dtlsParameters: DtlsParameters;
        }, callback) => {
            console.log(socket.id + ": ms-connect-transport " + data.transportId);
            const transport: WebRtcTransport = transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            await transport.connect({dtlsParameters: data.dtlsParameters});
            /*** ANSWER BY SENDING EXISTING MEMBERS AND DIRECTOR ***/
            callback({connected: true});
        });
        /*** SEND TRACK ***/
        socket.on("ms-send-track", async (data: {
            transportId: string;
            rtpParameters: RtpParameters;
            kind: MediaKind;
        }, callback) => {
            console.log(socket.id + ": ms-send-track");
            const transport: WebRtcTransport = transports[data.transportId];
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
            producers[producer.id] = producer;
            // Inform all about new producer
            socket.broadcast.emit("producer-added", {
                uid: uid,
                producerId: producer.id
            });
            callback({id: producer.id});
        });

        /*** CONSUME (paused track) ***/
        socket.on("ms-consume", async (data: {
            producerId: string;
            transportId: string;
            rtpCapabilities: RtpCapabilities;
        }, callback) => {
            console.log(socket.id + ": consume");
            const transport: WebRtcTransport = transports[data.transportId];
            if (!transport) {
                callback({error: "Could not find transport " + data.transportId});
                return;
            }
            const consumer: Consumer = await transport.consume({
                producerId: data.producerId,
                rtpCapabilities: data.rtpCapabilities,
                paused: true
            });
            consumers[consumer.id] = consumer;
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
        socket.on("ms-finish-consume", async (data: {
            uid: string;
            consumerId: string;
        }, callback) => {
            console.log(socket.id + ": finished consume");
            const consumer: Consumer = consumers[data.consumerId];
            if (!consumer) {
                return callback({error: "consumer not found"});
            }
            consumer.resume().then(
                () => callback()
            );
        });
    };
}
