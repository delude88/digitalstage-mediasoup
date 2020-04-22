import {extend, SocketWithRequest} from "./SocketWithRequest";
import SocketIOClient from "socket.io-client";
import Soundjack from "./Soundjack";
import firebase from "firebase/app";
import "firebase/auth";
import WebRTCConnection from "./WebRTCConnection";
import MediasoupConnection from "./MediasoupConnection";

export interface EventHandler {


}

export interface Stage {
    id: string;
    name: string;
    type: 'theater' | 'music' | 'conference'
}

export default class DigitalStage {
    private socket: SocketWithRequest | null = null;
    private eventHandler: EventHandler[] = [];
    private soundjack: Soundjack = new Soundjack();
    private webRTCConnection: WebRTCConnection | null = null;
    private mediasoupConnection: MediasoupConnection | null = null;
    private stage: Stage | null = null;

    constructor() {
        window.addEventListener("beforeunload", (ev) => {
            ev.preventDefault();
            this.disconnect();
        });
    }

    public connect = (options: {
        hostname: string,
        port: number
    }): Promise<boolean> => {
        return new Promise<boolean>(resolve => {
            this.socket = extend(SocketIOClient(options.hostname + ":" + options.port));
            this.attachSocketHandler();
            return true;
        });
    };

    public disconnect = () => {
        if (this.soundjack)
            this.soundjack.disconnect();
        if (this.mediasoupConnection)
            this.mediasoupConnection.disconnect();
        if (this.webRTCConnection)
            this.webRTCConnection.disconnect();
        if (this.socket)
            this.socket.close();
    };

    public createStage = (user: firebase.User, stageName: string, type: 'theater' | 'music' | 'conference' = 'theater'): Promise<Stage> => {
        return user.getIdToken()
            .then((token: string) => {
                console.log("create-stage");
                return this.socket.request("create-stage", {
                    stageName,
                    type,
                    token
                })
                    .then((response: string | { error: string }): Stage => {
                        if (typeof response === "string") {
                            const stage: Stage = {
                                id: response,
                                name: stageName,
                                type: type
                            };
                            this.stage = stage;
                            return this.stage;
                        } else {
                            if (typeof response === "object" && response.error) {
                                throw new Error(response.error);
                            }
                            throw new Error("Invalid response from server: " + response);
                        }
                    })
            });
    };

    public joinStage = (user: firebase.User, stageId: string): Promise<Stage> => {
        return user.getIdToken()
            .then((token: string) => {
                console.log("join-stage");
                return this.socket.request("join-stage", {
                    stageId,
                    token
                })
                    .then((response: {
                        stage: {
                            id: string;
                            name: string;
                            type: 'theater' | 'music' | 'conference'
                        }
                    } | any): Stage => {
                        if (response.stage) {
                            this.stage = response.stage as Stage;
                            return this.stage;
                        } else {
                            if (response.error) {
                                throw new Error(response.error);
                            }
                            throw new Error("Invalid response from server: " + response);
                        }
                    })
            });
    };

    public useSoundjack = (ip: string = "127.0.0.1", port: number = 1234) => {
        this.soundjack.connect(ip, port);
    };

    public getSoundjack = (): Soundjack | null => {
        return this.soundjack;
    };

    public publishTrack = (track: MediaStreamTrack, communication: "mediasoup" | "p2p") => {
        if (communication === "mediasoup") {
            this.socket.request("publish-track", {}).then(
                (response: any) => {

                }
            )
        } else {

        }
    };

    public publishSoundjack = () => {
        //TODO: Send to all participants the soundjack stream
    };

    public unpublishSoundjack = () => {
        //TODO: Stop streaming the soundjack stream to all participants
    };

    public unpublishTrack = (track: MediaStreamTrack) => {

    };

    public addEventHandler = (eventHandler: EventHandler) => {
        this.eventHandler.push(eventHandler);
    };

    public removeEventHandler = (eventHandler: EventHandler) => {
        this.eventHandler = this.eventHandler.filter((e: EventHandler) => e !== eventHandler);
    };

    private attachSocketHandler = () => {
    };
}
