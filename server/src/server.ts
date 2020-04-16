import express, {Express} from "express";
import socketIO from "socket.io";
import cors from "cors";
import {Member} from "./models/Member";
import mediasoup from "mediasoup";
import https, {Server as HTTPSServer} from "https";
import fs from "fs";
import {Worker} from "mediasoup/lib/Worker";
import {Router} from "mediasoup/lib/Router";
import {addMemberToServer, removeMemberFromServer} from "./api/firebase";
import {Server} from "./models/Server";
import ip from "ip";

const config = require("./config");

// Global variables
let worker: Worker;
let webServer: HTTPSServer;
let socketServer;
let expressApp: Express;
let mediasoupRouter: Router;

(async () => {
    try {
        await runExpressApp();
        await runWebServer();
        await runSocketServer();
        await runMediasoupWorker();
    } catch (err) {
        console.error(err);
    }
})();


const runExpressApp = async () => {
    expressApp = express();
};

const runWebServer = async () => {
    const {sslKey, sslCrt} = config;
    if (!fs.existsSync(sslKey) || !fs.existsSync(sslCrt)) {
        console.error("SSL files are not found. check your config.js file");
        process.exit(0);
    }
    const tls = {
        cert: fs.readFileSync(sslCrt),
        key: fs.readFileSync(sslKey),
    };
    webServer = https.createServer(tls, expressApp);
    webServer.on("error", (err) => {
        console.error("starting web server failed:", err.message);
    });

    await new Promise((resolve) => {
        const {listenIp, listenPort} = config;
        webServer.listen(listenPort, listenIp, () => {
            const listenIps = config.mediasoup.webRtcTransport.listenIps[0];
            const ip = listenIps.announcedIp || listenIps.ip;
            console.log("server is running");
            console.log(`open https://${ip}:${listenPort} in your web browser`);
            resolve();
        });
    });
};

// Create express instance
const app = express();
app.use(cors({origin: true}));
app.get("/", function (req: any, res: any) {
    res.send("Hello World!");
});

const runSocketServer = async () => {
    const server: Server = {
        ip: ip.address("public"),
        port: config.listenPort,
        members: []
    };

    socketServer = socketIO(webServer);
    socketServer.on("connection", (socket) => {

        console.log("New connection from " + socket.id + " with query: " + socket.handshake.query);

        socket.on("getRouterRtpCapabilities", (data, callback) => {
            callback(mediasoupRouter.rtpCapabilities);
        });

        socket.broadcast.emit("add-users", {
            users: [socket.id]
        });

        socket.on("connect", (data: {
            member: Member;
        }) => {
            // Also add to server list
            addMemberToServer(data.member, server).then(
                () => socket.emit("add-users", socket.id)
            );
        });

        socket.on("disconnect", (data: {
            member: Member;
        }) => {
            //curentSocketIds.splice(curentSocketIds.indexOf(socket.id), 1);
            removeMemberFromServer(data.member, server).then(
                () => socket.emit("remove-users", socket.id)
            );
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

        socket.on("mediasoup-request", (request, cb) => {
            switch (request.method) {
                case "queryRoom":

            }
        });
    });
};

const runMediasoupWorker = async () => {
    worker = await mediasoup.createWorker({
        logLevel: config.mediasoup.worker.logLevel,
        logTags: config.mediasoup.worker.logTags,
        rtcMinPort: config.mediasoup.worker.rtcMinPort,
        rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
    });

    worker.on("died", () => {
        console.error("mediasoup worker died, exiting in 2 seconds... [pid:%d]", worker.pid);
        setTimeout(() => process.exit(1), 2000);
    });

    const mediaCodecs = config.mediasoup.router.mediaCodecs;
    mediasoupRouter = await worker.createRouter({mediaCodecs});
};

async function createWebRtcTransport() {
    const {
        maxIncomingBitrate,
        initialAvailableOutgoingBitrate
    } = config.mediasoup.webRtcTransport;

    const transport = await mediasoupRouter.createWebRtcTransport({
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
