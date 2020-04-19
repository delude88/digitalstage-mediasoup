import {useCallback, useEffect, useState} from "react";
import * as mediasoup from 'mediasoup-client';
import {extend, SocketWithRequest} from "./socket.io-promise";
import SocketIOClient from "socket.io-client";
import {Transport} from "mediasoup-client/lib/Transport";
import * as config from "./../env";

interface RemoteMember {
    id: string;
    audioTracks: MediaStreamTrack[],
    videoTracks: MediaStreamTrack[]
}

const useMediasoup = () => {
    const [device, setDevice] = useState<mediasoup.Device>();
    const [sendTransport, setSendTransport] = useState<mediasoup.types.Transport>();
    const [receiveTransport, setReceiveTransport] = useState<mediasoup.types.Transport>();
    const [videoProducers, setVideoProducers] = useState<mediasoup.types.Producer[]>([]);
    const [audioProducers, setAudioProducers] = useState<mediasoup.types.Producer[]>([]);
    const [consumers, setConsumers] = useState<mediasoup.types.Consumer[]>([]);
    const [connected, setConnected] = useState<boolean>(false);

    const [remoteMembers, setRemoteMembers] = useState<RemoteMember[]>();
    const [director, setDirector] = useState<RemoteMember>();

    useEffect(() => {
        try {
            const device = new mediasoup.Device();
            setDevice(device);
        } catch (e) {
            if (e.name === 'UnsupportedError') {
                console.error('browser not supported for video calls');
                return;
            } else {
                console.error(e);
            }
        }
    }, []);

    const sendStream = useCallback((stream: MediaStream) => {
        stream.getVideoTracks().forEach(
            (track: MediaStreamTrack) => {
                console.log("Created a new producer for video");
                sendTransport.produce({track: track}).then(
                    (producer: mediasoup.types.Producer) => {
                        setVideoProducers(prevState => ([...prevState, producer]));
                    }
                );
            }
        );
        stream.getAudioTracks().forEach(
            (track: MediaStreamTrack) => {
                console.log("Created a new producer for audio");
                sendTransport.produce({track: track}).then(
                    (producer: mediasoup.types.Producer) => {
                        setAudioProducers(prevState => ([...prevState, producer]));
                    }
                );
            }
        );
    }, [sendTransport]);

    const connect = useCallback(async (userId: string, roomName: string, isDirector: boolean) => {
        if (!device) {
            throw new Error("Mediasoup device is not ready");
        }
        const socket: SocketWithRequest = extend(SocketIOClient(config.SERVER_URL + ":" + config.SERVER_PORT));

        console.log("connect 1: join room");
        const routerRtpCapabilities = await socket.request('join-room', {
            memberId: userId,
            roomName: roomName,
            isDirector: isDirector
        });
        if (!routerRtpCapabilities) {
            console.log("Error joining the room");
            return;
        }
        await device.load({routerRtpCapabilities});


        /** CONNECT 2: Create send transport **/
        console.log("connect 2: create send transport");
        const sendTransportOptions = await socket.request('create-send-transport', {
            forceTcp: false,
            rtpCapabilities: device.rtpCapabilities,
        });
        if (sendTransportOptions.error) {
            throw new Error("connect 2: " + sendTransportOptions.error);
        }
        const sendTransport: Transport = device.createSendTransport(sendTransportOptions);
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

        /** CONNECT 3: Create receive transport **/
        console.log("connect 3: create receive transport");
        const receiveTransportOptions = await socket.request('create-receive-transport', {
            forceTcp: false,
            rtpCapabilities: device.rtpCapabilities,
        });
        if (receiveTransportOptions.error) {
            throw new Error("connect 3: " + receiveTransportOptions.error);
        }
        const receiveTransport: Transport = device.createRecvTransport(receiveTransportOptions);
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


        // Handle incoming consume reports
        socket.on('producer-added', async (data: {
            userId: string,
            producerId: string
        }) => {
            console.log("new producer" + data.producerId);

            const consumerOptions = await socket.request('consume', {
                producerId: data.producerId,
                transportId: receiveTransport.id,
                rtpCapabilities: device.rtpCapabilities
            });
            const consumer: mediasoup.types.Consumer = await receiveTransport.consume(consumerOptions);
            await socket.request('finish-consume', {
                id: consumerOptions.id
            });
            consumer.resume();
            setConsumers(prevState => ([...prevState, consumer]));
        });

        setConnected(true);
    }, [device]);


    return {
        connected,
        connect,
        sendStream,
        consumers,
        remoteMembers,
        director
    };
};

export default useMediasoup;
