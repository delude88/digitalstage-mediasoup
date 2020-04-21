import express, {Express} from "express";
import cors from "cors";
import * as https from "https";
import {Server} from "https";
import * as fs from "fs";
import SocketIO from "socket.io";
import {Stage} from "./api/stage";

const config = require("./config");

// Initialize express
const app: Express = express();
app.use(cors({origin: true}));
app.options("*", cors());

// Initialize HTTPS
const webServer: Server = https.createServer({
    key: fs.readFileSync(config.sslKey),
    cert: fs.readFileSync(config.sslCrt),
    ca: config.ca && fs.readFileSync(config.ca),
    requestCert: false,
    rejectUnauthorized: false
}, app);

// Initialize Socket.IO
const SocketHandler = (socket: SocketIO.Socket) => {
    let stage: Stage | undefined = undefined;

    socket.on("create-stage", (data: {

    }) => {
        // Create stage
    });

    socket.on("join-stage", (data: {

    }) => {
        // Join stage

        // Inform all other actors of stage

    });
};
const socketServer: SocketIO.Server = SocketIO(webServer);
socketServer.origins("*:*");
socketServer.use(SocketHandler);

webServer.listen(config.listenPort, () => {
    console.log("Running digital stage on port " + config.listenPort);
});
