import {extend, SocketWithRequest} from "./utils/SocketWithRequest";
import SocketIOClient from "socket.io-client";
import SoundjackConnection, {ConnectionInfo} from "./SoundjackConnection";
import firebase from "firebase/app";
import "firebase/auth";
import WebRTCConnection from "./WebRTCConnection";
import MediasoupConnection from "./MediasoupConnection";
import * as mediasoup from "mediasoup-client";

export interface EventHandler {
    onConnected: () => void;
    onParticipantAdded: (participant: Participant) => void;
}

export interface Stage {
    id: string;
    name: string;
    password?: string;
    type: 'theater' | 'music' | 'conference',
    directorUid: string;
}

export interface Participant {
    uid: string;
    name: string;
    tracks: {
        [trackId: string]: MediaStreamTrack;
    };
    soundjack?: {
        ip: string;
        port: number;
        active: boolean;
    }
}

export default class DigitalStageConnection {
    private socket: SocketWithRequest | null = null;
    private eventHandler: EventHandler[] = [];
    private soundjack: SoundjackConnection = new SoundjackConnection();
    private webRTCConnection: WebRTCConnection | null = null;
    private mediasoupConnection: MediasoupConnection | null = null;
    private participants: {
        [uid: string]: Participant
    } = {};
    private stage: Stage | null = null;

    constructor() {
        if (typeof window !== "undefined")
            window.addEventListener("beforeunload", (ev) => {
                ev.preventDefault();
                this.disconnect();
            });
    }

    public connect = (options: {
        hostname: string,
        port: number
    }): Promise<void> => {
        return new Promise<void>(resolve => {
            this.socket = extend(SocketIOClient(options.hostname + ":" + options.port));
            resolve();
        });
    };

    public disconnect = () => {
        if (this.soundjack)
            this.soundjack.disconnect();
        this.soundjack = null;
        if (this.mediasoupConnection)
            this.mediasoupConnection.disconnect();
        this.mediasoupConnection = null;
        if (this.webRTCConnection)
            this.webRTCConnection.disconnect();
        this.webRTCConnection = null;
        if (this.socket)
            this.socket.close();
        this.socket = null;
    };

    public createStage = (user: firebase.User, stageName: string, password?: string, type: 'theater' | 'music' | 'conference' = 'theater'): Promise<Stage> => {
        return user.getIdToken()
            .then((token: string) => {
                console.log("create-stage");
                return this.socket.request("create-stage", {
                    stageName,
                    type,
                    token,
                    password: password ? password : null
                })
                    .then((response: string | { error: string }): Stage => {
                        if (typeof response === "string") {
                            this.stage = {
                                id: response,
                                name: stageName,
                                type: type,
                                password: password,
                                directorUid: user.uid
                            };
                            this.attachSocketHandler(user.uid);
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

    public joinStage = (user: firebase.User, stageId: string, password?: string,): Promise<Stage> => {
        return user.getIdToken()
            .then((token: string) => {
                console.log("join-stage");
                return this.socket.request("join-stage", {
                    stageId,
                    token,
                    password: password ? password : null
                })
                    .then((response: {
                        stage: Stage
                    } | any): Stage => {
                        if (response.stage) {
                            this.stage = response.stage as Stage;
                            this.attachSocketHandler(user.uid);
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

    public getSoundjack = (): SoundjackConnection | null => {
        return this.soundjack;
    };

    public publishTrack = (track: MediaStreamTrack, communication: "mediasoup" | "p2p"): Promise<void> => {
        return new Promise<void>(() => {
            if (communication === "mediasoup") {
                return this.mediasoupConnection.publishTrack(track);
            } else {
                this.webRTCConnection.publishTrack(track);
                return;
            }
        });
    };

    public publishSoundjack = () => {
        //TODO: Send to all participants the soundjack stream
        Object.keys(this.participants)
            .forEach((uid: string) => {
                const participant: Participant = this.participants[uid];
                if (participant.soundjack) {
                    this.soundjack.startStream(participant.soundjack.ip, participant.soundjack.port);
                    participant.soundjack.active = true;
                }
            });
    };

    public unpublishSoundjack = () => {
        //TODO: Stop streaming the soundjack stream to all participants
        Object.keys(this.participants)
            .forEach((uid: string) => {
                const participant: Participant = this.participants[uid];
                if (participant.soundjack && participant.soundjack.active) {
                    this.soundjack.startStream(participant.soundjack.ip, participant.soundjack.port);
                }
            });
    };

    public unpublishTrack = (track: MediaStreamTrack, communication: "mediasoup" | "p2p") => {
        if (communication === "mediasoup") {
            this.mediasoupConnection.unpublishTrack(track);
        } else {
            this.webRTCConnection.unpublishTrack(track);
        }
    };

    public addEventHandler = (eventHandler: EventHandler) => {
        this.eventHandler.push(eventHandler);
    };

    public removeEventHandler = (eventHandler: EventHandler) => {
        this.eventHandler = this.eventHandler.filter((e: EventHandler) => e !== eventHandler);
    };

    private attachSocketHandler = (uid: string) => {
        // Create listener
        this.mediasoupConnection = new MediasoupConnection(this.socket, uid);
        this.webRTCConnection = new WebRTCConnection(this.socket, uid);

        // Add handler when client is added on serverside
        // This handler is used by mediasoup and webrtc as well
        this.socket.on("client-added", (data: {
            uid: string,
            name: string,
            socketId: string
        }) => {
            console.log("CLIENT '" + data.name + "' ADDED!");
            this.participants[uid] = {
                uid: uid,
                name: data.name,
                tracks: {}
            };
        });

        // Add handler for mediasoup
        this.mediasoupConnection.addEventHandler({
            onConnected: () => {
                this.eventHandler.forEach((eventHandler: EventHandler) => eventHandler.onConnected && eventHandler.onConnected());
            },
            onDisconnected: () => {

            },
            onConsumerAdded: (consumer: mediasoup.types.Consumer) => {

            },
            onConsumerRemoved: () => {

            }
        });

        // Add handler for soundjack
        this.soundjack.addEventHandler({
            onConnected: () => {

            },
            onConnectionInfoUpdated: (connectionInfo: ConnectionInfo) => {
                this.publishSoundjackConnectionInfos(connectionInfo);
            },
            onDisconnected: () => {

            },
            onStreamAdded: () => {

            },
            onStreamChanged: () => {

            },
            onStreamRemoved: () => {

            },
            onAudioDeviceAdded: () => {

            },
            onAudioDeviceRemoved: () => {

            },
            onSoundLevelChanged: () => {

            },
            onSettingsUpdated: () => {

            }
        });

        //TODO: Event handler for webrtc
        this.mediasoupConnection.connect()
            .then(() => {
                console.log("Mediasoup ready!");
            })
    };

    private publishSoundjackConnectionInfos = (connectionInfo: ConnectionInfo) => {
        this.socket.emit("sj-send-ip", {
            ip: connectionInfo.interfaceIP,
            port: connectionInfo.localBindPort
        })
    };
}
