import express, {Express} from "express";
import cors from "cors";
import SocketIO from "socket.io";
import {Worker} from "mediasoup/lib/Worker";
import {Router} from "mediasoup/lib/Router";
import * as http from "http";
import {Server} from "http";
import {WebRtcTransport} from "mediasoup/lib/WebRtcTransport";
import {Producer} from "mediasoup/lib/Producer";
import {Consumer} from "mediasoup/lib/Consumer";

const mediasoup = require('mediasoup');

let mediasoupRouter: Router;
const config = require('./config');

const port: number = parseInt(process.env.PORT) || 3001;

interface Room {
    peers: {},
    transports: {},
    producers: [],
    consumers: []
}

let producer: Producer = null;
let consumer: Consumer = null;
let consumerTransport: any = null;

// Start webserver
const main = async () => {

    const app: Express = express();
    app.use(cors({origin: true}));
    app.options('*', cors());

    const webServer: Server = http.createServer({}, app);

    const worker: Worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort
    });
    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    mediasoupRouter = await worker.createRouter({mediaCodecs});

    const handleConnection = (socket: SocketIO.Socket) => {
        console.log("New connection from " + socket.id);
        let producerTransport: WebRtcTransport;

        if (producer) {
            socket.emit('producer-added');
        }

        socket.on("join", (data: {
            room: string
        }) => {
            console.log("Joining " + data.room);
        });

        socket.on("getRouterRtpCapabilities", (data, callback) => {
            console.log("Sending Router Rtp Capabilities");
            callback(mediasoupRouter.rtpCapabilities);
        });

        socket.on("create-producer-transport", async (data, callback) => {
            console.log("create-producer-transport");
            try {
                const {transport, params} = await createWebRtcTransport();
                producerTransport = transport;
                callback(params);
            } catch (err) {
                console.error(err);
                callback({error: err.message});
            }
        });

        socket.on('connect-producer-transport', async (data, callback) => {
            console.log("connect-producer-transport");
            await producerTransport.connect({dtlsParameters: data.dtlsParameters});
            callback();
        });

        socket.on('create-consumer-transport', async (data, callback) => {
            try {
                const { transport, params } = await createWebRtcTransport();
                consumerTransport = transport;
                callback(params);
            } catch (err) {
                console.error(err);
                callback({ error: err.message });
            }
        });

        socket.on('connect-consumer-transport', async (data, callback) => {
            await consumerTransport.connect({ dtlsParameters: data.dtlsParameters });
            callback();
        });

        socket.on('produce', async (data, callback) => {
            const {kind, rtpParameters} = data;
            producer = await producerTransport.produce({kind, rtpParameters});
            callback({id: producer.id});

            // inform clients about new producer
            socket.broadcast.emit('newProducer');
        });

        socket.on('consume', async (data, callback) => {
            callback(await createConsumer(producer, data.rtpCapabilities));
        });

        socket.on('resume', async (data, callback) => {
            await consumer.resume();
            callback();
        });
    };
    const socketServer: SocketIO.Server = SocketIO(webServer);
    socketServer.on("connection", handleConnection);
    socketServer.origins('*:*');

    webServer.listen(port, () => {
        console.log("Running digital stage on port " + port)
    });

};
main();

async function createWebRtcTransport() {
    const {
        maxIncomingBitrate,
        initialAvailableOutgoingBitrate
    } = config.mediasoup.webRtcTransport;

    const transport: WebRtcTransport = await mediasoupRouter.createWebRtcTransport({
        listenIps: config.mediasoup.webRtcTransport.listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate,
    });
    if (maxIncomingBitrate) {
        try {
            await transport.setMaxIncomingBitrate(maxIncomingBitrate);
        } catch (error) {
        }
    }
    return {
        transport,
        params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters
        },
    };
}

async function createConsumer(producer: Producer, rtpCapabilities: any) {
    if (!mediasoupRouter.canConsume(
        {
            producerId: producer.id,
            rtpCapabilities,
        })
    ) {
        console.error('can not consume');
        return;
    }
    try {
        consumer = await consumerTransport.consume({
            producerId: producer.id,
            rtpCapabilities,
            paused: producer.kind === 'video',
        });
    } catch (error) {
        console.error('consume failed', error);
        return;
    }

    if (consumer.type === 'simulcast') {
        await consumer.setPreferredLayers({ spatialLayer: 2, temporalLayer: 2 });
    }

    return {
        producerId: producer.id,
        id: consumer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused
    };
}
