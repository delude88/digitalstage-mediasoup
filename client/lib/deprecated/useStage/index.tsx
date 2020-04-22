import {useCallback, useEffect, useState} from "react";
import * as mediasoup from "mediasoup-client";
import firebase from "firebase/app";
import "firebase/auth";
import {extend, SocketWithRequest} from "../../api/SocketWithRequest";
import SocketIOClient from "socket.io-client";
import {p2pConfiguration} from "./config";
import {RtpCapabilities} from "mediasoup-client/src/RtpParameters";
import {Transport} from "mediasoup-client/lib/Transport";
import Stage from "./types/Stage";
import Actor from "./types/Actor";

export default (host: string, port: number) => {
    // Public states
    const [stage, setStage] = useState<Stage>();
    const [actors, setActors] = useState<Actor[]>([]);
    // Private states
    const [socket, setSocket] = useState<SocketWithRequest>();
    const [device, setDevice] = useState<mediasoup.Device>();
    const [sendTransport, setSendTransport] = useState<mediasoup.types.Transport>();
    const [receiveTransport, setReceiveTransport] = useState<mediasoup.types.Transport>();
    const [producers, setProducers] = useState<mediasoup.types.Producer[]>([]);

    const connect = useCallback(() => {
        if (socket) {
            throw new Error("Already connected");
        }
        setSocket(extend(SocketIOClient(host + ":" + port)));
    }, [socket]);

    const createStage = useCallback((user: firebase.User, name: string, communication: 'p2p' | 'server' = 'server', type: 'theater' | 'music' | 'conference' = 'conference'): Promise<Stage> => {
        if (stage) {
            throw new Error("Already connected to a stage, please disconnect first");
        }
        if (!socket) {
            throw new Error("Not connected. Please connect to server first");
        }
        // Get token for user
        return user.getIdToken()
            .then((token: string) => {
                console.log("create-stage");
                return socket.request("create-stage", {
                    name,
                    type,
                    token
                })
                    .then((response): Stage => {
                        if (response.error) {
                            throw new Error("");
                        }
                        const stage: Stage = {
                            ...response
                        };
                        setStage(stage);
                        return stage;
                    })
            });

    }, [stage, socket]);

    const joinStage = useCallback((user: firebase.User, stageId: string): Promise<Stage> => {
        if (stage) {
            throw new Error("Already connected to a stage, please disconnect first");
        }
        if (!socket) {
            throw new Error("Not connected. Please connect to server first");
        }
        // Get token for user
        return user.getIdToken()
            .then((token: string) => {
                console.log("join-stage");
                return socket.request("join-stage", {
                    stageId,
                    token
                })
                    .then((response): Stage => {
                        if (response.error) {
                            console.error(response.error);
                            throw new Error(response.error);
                        }
                        console.log("got stage");
                        const stage: Stage = {
                            ...response
                        };
                        setStage(stage);
                        return stage;
                    })
            });
    }, [stage, socket]);

    useEffect(() => {
        if (stage) {
            /*** Common ***/
            socket.on('participant-removed', (uid: string) => {
                setActors(prevState => prevState.filter((actor: Actor) => {
                    if (actor.uid === uid) {
                        if (actor._p2pConnection && actor._p2pConnection.connection) {
                            actor._p2pConnection.connection.close();
                        }
                        if (actor._mediasoup) {
                            actor._mediasoup.consumers.forEach((consumer: mediasoup.types.Consumer) => consumer.close());
                        }
                        return false;
                    }
                    return true;
                }));
            });
            socket.on('participant-added', (data: {
                uid: string;
                socketId: string;
                role: 'actor' | 'director';
                name: string;
            }) => {
                console.log("participant-added " + data.uid);
                const actor: Actor = {
                    uid: data.uid,
                    socketId: data.socketId,
                    role: data.role,
                    name: data.name,
                    audioTracks: [],
                    videoTracks: []
                };
                setActors(prevState => [...prevState, actor]);
                if (stage.communication === "p2p") {
                    createP2PConnection(actor);
                    if (actor._p2pConnection && actor._p2pConnection.connection) {
                        actor._p2pConnection.connection.createOffer().then(
                            (offer: RTCSessionDescriptionInit) => {
                                //if (this.state.settings.useHighBitrate)
                                //    offer.sdp = offer.sdp.replace('useinbandfec=1', 'useinbandfec=1; maxaveragebitrate=510000');
                                actor._p2pConnection.connection.setLocalDescription(new RTCSessionDescription(offer)).then(
                                    () => socket.emit('make-offer', {
                                        offer: offer,
                                        to: data.socketId
                                    })
                                )
                            }
                        )
                    }
                }
            });

            if (stage.communication === "p2p") {
                /*** P2P handler ***/
                socket.on('answer-made', (data: {
                    socketId: string;
                    answer: RTCSessionDescriptionInit;
                }) => {
                    // Find user by socketId
                    const actor: Actor | undefined = actors.find((actor: Actor) => actor.socketId === data.socketId);
                    if (actor && actor._p2pConnection && actor._p2pConnection.connection) {
                        actor._p2pConnection.connection.setRemoteDescription(new RTCSessionDescription(data.answer)).then(() => {
                            console.log("Got answer");
                        })
                    }
                });

                socket.on('offer-made', (data: {
                    uid: string;
                    socketId: string;
                    role: "actor" | "director";
                    name: string;
                    offer: RTCSessionDescriptionInit;
                }) => {
                    // Since existing user always make offers to new users, handle this for adding actors also
                    const actor: Actor = {
                        uid: data.uid,
                        name: data.name,
                        socketId: data.socketId,
                        role: data.role,
                        audioTracks: [],
                        videoTracks: [],
                    };
                    createP2PConnection(actor);
                    actor._p2pConnection.connection.setRemoteDescription(new RTCSessionDescription(data.offer)).then(
                        () => actor._p2pConnection.connection.createAnswer().then(
                            (answer: RTCSessionDescriptionInit) => {
                                //if (this.state.settings.useHighBitrate)
                                // answer.sdp = answer.sdp.replace('useinbandfec=1', 'useinbandfec=1; maxaveragebitrate=510000');
                                actor._p2pConnection.connection.setLocalDescription(new RTCSessionDescription(answer)).then(
                                    () => {
                                        console.log("makeAnswer(" + data.uid + ")");
                                        socket.emit('make-answer', {
                                            answer: answer,
                                            to: data.socketId
                                        })
                                    }
                                )
                            }
                        )
                    );
                });

                socket.on('candidate-sent', (data: {
                    uid: string;
                    candidate: RTCIceCandidateInit;
                }) => {
                    const actor: Actor = actors.find((actor: Actor) => actor.uid === data.uid);
                    if (actor._p2pConnection && actor._p2pConnection.connection) {
                        actor._p2pConnection.connection.addIceCandidate(data.candidate);
                    }
                });

            } else {
                /*** Mediasoup handler ***/
                socket.on('producer-added', async (data: {
                    uid: string,
                    producerId: string
                }) => {
                    console.log("new producer" + data.producerId + " by " + data.uid);

                    const actor: Actor = actors.find((actor: Actor) => actor.uid === data.uid);
                    if (actor) {
                        const consumerOptions = await socket.request('consume', {
                            uid: data.uid,
                            producerId: data.producerId,
                            transportId: receiveTransport.id,
                            rtpCapabilities: device.rtpCapabilities
                        });
                        const consumer: mediasoup.types.Consumer = await receiveTransport.consume(consumerOptions);
                        await socket.request('finish-consume', {
                            consumerId: consumerOptions.id
                        });
                        consumer.resume();
                        setActors(prevState => prevState.map((actor: Actor) => {
                            if (actor.uid === data.uid) {
                                actor._mediasoup.consumers = [...actor._mediasoup.consumers, consumer];
                            }
                            return actor;
                        }))
                    }
                });

                connectToMediasoup();
            }
        } else {
            // Disconnect and clean up
        }
    }, [stage]);

    const createP2PConnection = useCallback((actor: Actor) => {
        actor._p2pConnection = {
            connection: new RTCPeerConnection(p2pConfiguration),
            established: false
        };
        actor._p2pConnection.connection.onicecandidateerror = (error) => {
            console.log('failed to add ICE Candidate');
            console.log(error.errorText);
        };
        actor._p2pConnection.connection.oniceconnectionstatechange = (event) => {
            console.log('ICE state change event: ', event);
        };
        actor._p2pConnection.connection.onicecandidate = (ev: RTCPeerConnectionIceEvent) => {
            console.log("ICE connected");
            if (ev.candidate && ev.candidate.candidate.length > 0)
                socket.emit('send-candidate', {
                    candidate: ev.candidate,
                    to: actor.uid
                });
            else {
                setActors(prevState => prevState.map((a: Actor) => {
                    if (a.uid === actor.uid) {
                        a._p2pConnection.established = true;
                    }
                    return a;
                }));
                console.log("Finished");
            }
        };
        actor._p2pConnection.connection.ontrack = (ev: RTCTrackEvent) => {
            const audioTracks: MediaStreamTrack[] = ev.streams[0].getAudioTracks();
            const videoTracks: MediaStreamTrack[] = ev.streams[0].getVideoTracks();
            setActors(prevState => prevState.map((a: Actor) => {
                if (a.uid === actor.uid) {
                    a.audioTracks = [...a.audioTracks, ...audioTracks];
                    a.videoTracks = [...a.videoTracks, ...videoTracks];
                }
                return a;
            }));
        };
    }, [socket, actors]);

    const connectToMediasoup = useCallback(async () => {
        let localDevice: mediasoup.types.Device = device;
        if (!localDevice) {
            localDevice = new mediasoup.types.Device();
            setDevice(localDevice);
        }

        console.log("connect 1: get RTP capabilities");
        const routerRtpCapabilities: RtpCapabilities = await socket.request('get-rtp-capabilities', {});
        await localDevice.load({routerRtpCapabilities});
        console.log("connect 2: create send transport");
        const sendTransportOptions = await socket.request('create-send-transport', {
            forceTcp: false,
            rtpCapabilities: localDevice.rtpCapabilities,
        });
        if (sendTransportOptions.error) {
            throw new Error("connect 2: " + sendTransportOptions.error);
        }
        const sendTransport: Transport = localDevice.createSendTransport(sendTransportOptions);
        sendTransport.on('connect', async ({dtlsParameters}, callback, errCallback) => {
            console.log("sendTransport: connect");
            socket.request('connect-transport', {
                transportId: sendTransportOptions.id,
                dtlsParameters
            })
                .then(callback)
                .catch(errCallback);
        });
        sendTransport.on('produce', async ({kind, rtpParameters, appData}, callback) => {
            console.log("sendTransport: produce");
            const result = await socket.request('send-track', {
                transportId: sendTransportOptions.id,
                kind,
                rtpParameters,
            });
            if (result.error) {
                console.error(result.error);
                return;
            }
            callback(result.id);
        });
        sendTransport.on('connectionstatechange', async (state) => {
            console.log("sendTransport: connectionstatechange " + state);
            if (state === 'closed' || state === 'failed' || state === 'disconnected') {
                console.error("Disconnect by server side");
            }
        });
        setSendTransport(sendTransport);
        console.log("connect 3: create receive transport");
        const receiveTransportOptions = await socket.request('create-receive-transport', {
            forceTcp: false,
            rtpCapabilities: localDevice.rtpCapabilities,
        });
        if (receiveTransportOptions.error) {
            throw new Error("connect 3: " + receiveTransportOptions.error);
        }
        const receiveTransport: Transport = localDevice.createRecvTransport(receiveTransportOptions);
        receiveTransport.on('connect', async ({dtlsParameters}, callback, errCallback) => {
            console.log("receiveTransport: connect");
            await socket.request('connect-transport', {
                transportId: receiveTransportOptions.id,
                dtlsParameters
            })
                .then(callback)
                .catch(errCallback);
        });
        receiveTransport.on('connectionstatechange', async (state) => {
            console.log("receiveTransport: connectionstatechange " + state);
            if (state === 'closed' || state === 'failed' || state === 'disconnected') {
                console.error("Disconnect by server side");
            }
        });
        setReceiveTransport(receiveTransport);

        socket.request("get-actors", {})
            .then((blob) => {
                console.log(blob);
                const actors: Actor[] = blob.actors.map((data) => ({
                    uid: data.uid,
                    name: data.name,
                    role: data.role,
                    scoketId: data.socketId,
                    _mediasoup: data._mediasoup.producerIds ? {
                        producerIds: data._mediasoup.producerIds,
                        consumers: []
                    } : undefined
                }));
                return actors.forEach((actor: Actor) => {
                    if (actor._mediasoup) {
                        return actor._mediasoup.producerIds.forEach(async (producerId: string) => {
                            const consumerOptions = await socket.request('consume', {
                                uid: actor.uid,
                                producerId: producerId,
                                transportId: receiveTransport.id,
                                rtpCapabilities: localDevice.rtpCapabilities
                            });
                            const consumer: mediasoup.types.Consumer = await receiveTransport.consume(consumerOptions);
                            await socket.request('finish-consume', {
                                consumerId: consumerOptions.id
                            });
                            consumer.resume();
                        });
                    }
                });
            })
    }, [socket]);

    const streamTrack = useCallback((track: MediaStreamTrack) => {
        if (!stage) {
            throw new Error("No stage available, please create or join stage first");
        }
        if (!socket) {
            throw new Error("Not connected. Please connect to server first");
        }
        if (stage.communication === "p2p") {
            if (stage.type === "music") {
                actors.forEach((actor: Actor) => {
                    if (actor._p2pConnection && (stage.type === "music" || actor.role === "director")) {
                        actor._p2pConnection.connection.addTrack(track);
                    }
                });
            } else {
                actors.forEach((actor: Actor) => actor._p2pConnection && actor._p2pConnection.connection.addTrack(track));
            }
        } else {
            sendTransport.produce({track: track}).then(
                (producer: mediasoup.types.Producer) => {
                    setProducers(prevState => ([...prevState, producer]));
                }
            );
        }

    }, [socket, stage, sendTransport]);

    const disconnect = useCallback(() => {
        actors.forEach((actor: Actor) => {
            if (actor._p2pConnection) {
                actor._p2pConnection.connection.close();
            }
            if (actor._mediasoup)
                actor._mediasoup.consumers.forEach((consumer: mediasoup.types.Consumer) => consumer.close());
        });
        if (socket) {
            socket.disconnect();
            setSocket(undefined);
            setStage(undefined);
        }
    }, [socket]);


    return {
        connect,
        disconnect,
        createStage,
        joinStage,
        streamTrack,
        isConnected: stage !== undefined,
        stage,
        actors
    }
}
