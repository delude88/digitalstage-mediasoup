import {useCallback, useEffect, useState} from "react";
import debounce from 'lodash.debounce';
import omit from 'lodash.omit';

export interface ConnectionInfo {
    NAT: number;
    OS: string;
    interfaceIP: string;
    localBindPort: string;
    localIP: string;
    localIP2: string;
    localPort: string;
    localPort2: string;
}

export interface SoundjackSettings {
    valid: boolean;
    inputAudioDevice: number;
    outputAudioDevice: number;
    channelConfiguration: number; // 0 = mono, 1 = dual mono, 2 = stereo
    bitDepth: number;
    sampleRate: number;
    bufferSize: number;
    frameSize: number;  // networkBlockSize
}

const InitialSettings: SoundjackSettings = {
    inputAudioDevice: 0,
    outputAudioDevice: 0,
    valid: true,
    bitDepth: 16,
    sampleRate: 48000,
    bufferSize: 512,
    frameSize: 512,
    channelConfiguration: 1
};

export interface AudioDevice {
    id: number;
    label: string;
}

export interface Stream {
    ip: string;
    port: string;
    decodeFactor: string;
    channelCount: string;
    frameSize: string;
    latency?: string;
    remoteSoundLevel?: string;
    status: "active" | "disconnecting";
}

const sendSettings = (socket: WebSocket, settings: SoundjackSettings) => {
    socket.send(JSON.stringify({
        type: "stopAudioEngine"
    }));
    socket.send(JSON.stringify({
        audioChannelIndex: settings.channelConfiguration.toString(),
        bitDepth: settings.bitDepth.toString(),
        buchse1: "on",
        buchse2: "on",
        buchse3: "off",
        buchse4: "off",
        buchse5: "off",
        buchse6: "off",
        buchse7: "off",
        buchse8: "off",
        frameSize: settings.bufferSize.toString(),
        frameSizeSend: settings.frameSize.toString(),
        inputIndex: settings.inputAudioDevice.toString(),
        outputIndex: settings.outputAudioDevice.toString(),
        sampleRate: settings.sampleRate.toString(),
        type: "startAudioEngine"
    }));
};
const debouncedSendSettings = debounce(sendSettings, 500);

export default (host: string = "127.0.0.1", port: number = 1234) => {
    const [connected, setConnected] = useState<boolean>(false);
    const [ready, setReady] = useState<boolean>(false);
    const [available, setAvailable] = useState<boolean>(false);
    const [socket, setSocket] = useState<WebSocket>();
    const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>();
    const [version, setVersion] = useState<string>();
    const [settings, setSettings] = useState<SoundjackSettings>(InitialSettings);
    const [soundLevel, setSoundLevel] = useState<number>();
    const [streams, setStreams] = useState<{
        [id: number]: Stream
    }>({});
    const [audioDevices, setAudioDevices] = useState<{
        [id: number]: string
    }>({});


    useEffect(() => {
        window.addEventListener("beforeunload", (ev) => {
            ev.preventDefault();
            disconnect();
        });
    });

    useEffect(() => {
        try {
            const websocket = new WebSocket("ws://" + host + ":" + port);

            websocket.onopen = () => {
                websocket.send(JSON.stringify({
                    type: "standalone",
                    mode: "private"
                }));
                setReady(true);
            };

            // Bind handler
            websocket.onmessage = (event: MessageEvent) => {
                const message: {
                    type: string;
                    [key: string]: any;
                } = JSON.parse(event.data);

                switch (message.type) {
                    case 'standalone':
                        setVersion(message.version);
                        setTimeout(() => {
                            websocket.send(JSON.stringify({
                                type: "probe"
                            }));
                            setConnected(true);
                        }, 10);
                        websocket.send(JSON.stringify({
                            type: "bind",
                            IP: "0.0.0.0",
                            port: "50000"
                        }));
                        break;
                    case 'setVideoDeviceInfo':
                        // Ignore
                        break;
                    case 'setAudioDeviceInfo':
                        setAudioDevices(prevState => ({
                                ...prevState,
                                [message.audioCount]: message.audioName
                            })
                        );
                        break;
                    case 'streamIsHere':
                        if (message.ID !== "X")
                            setStreams(prevState => ({
                                ...prevState,
                                [message.ID]: {
                                    ...prevState[message.ID],
                                    ip: message.IP,
                                    port: message.port,
                                    decodeFactor: message.decodeFactor,
                                    channelCount: message.channelCount,
                                    frameSize: message.frameSize,
                                    status: "active"
                                }
                            }));
                        break;
                    case 'setRemoteSoundLevel':
                        // Only accept active streams
                        setStreams(prevState => ({
                            ...prevState,
                            [message.data1]: {
                                ...prevState[message.data1],
                                id: message.data2,
                                ip: message.data3,
                                port: message.data4
                            }
                        }));
                        break;
                    case 'streamIsGone':
                        setStreams(prevState => omit(prevState, message.data1));
                        break;
                    case 'tellLatency':
                        // Only accept active streams
                        if (streams[message.data1])
                            setStreams(prevState => ({
                                ...prevState,
                                [message.data1]: {
                                    ...prevState[message.data1],
                                    latency: message.data2
                                }
                            }));
                        break;
                    case 'setNICOptions':
                        //TODO: Shall we store the data somewhere?
                        break;
                    case 'soundCardStatus':
                        break;
                    case 'setLocalSoundLevel':
                        setSoundLevel(message.maxSampleValue);
                        break;
                    case 'tellPort':
                        setConnectionInfo({
                            NAT: message.NAT,
                            interfaceIP: message.interfaceIP,
                            localIP: message.localIP,
                            localIP2: message.localIP2,
                            localBindPort: message.localBindPort,
                        } as ConnectionInfo);
                        break;
                    case 'tellDropout':
                        break;
                    default:
                        // Soundjack is sending weird empty messages, so exclude these
                        if (message.type) {
                            console.warn("Unhandled message:");
                            console.log(message);
                            console.log(event);
                        }
                        break;
                }
            };
            websocket.onerror = (error: Event) => {
                console.error(error);
                setConnected(false);
                setAvailable(false);
                setReady(true);
            };
            websocket.onclose = (event: CloseEvent) => {
                setConnected(false);
            };
            setSocket(websocket);
            setAvailable(true);
        } catch (error) {
            console.error(error);
            setAvailable(false);
        }
    }, [host, port]);

    useEffect(() => {
        if (connected && socket && settings) {
            debouncedSendSettings(socket, settings);
        }
    }, [connected, socket, settings]);

    const disconnect = useCallback(() => {
        debouncedSendSettings.cancel();
        Object.keys(streams).forEach((id: string) => {
            stopStream(id);
        });
        if (socket) {
            socket.close();
        }
    }, [socket, streams]);

    const startStream = useCallback((ip: string, port: number) => {
        socket.send(JSON.stringify({
            type: "startStream",
            IP: ip,
            port: port.toString(),
            ownID: "0",
            remoteSenderID: "0",
            remoteNAT: ""
        }));
    }, [socket]);
    const stopStream = useCallback((id: string) => {
        const stream: Stream = streams[id];
        if (!stream)
            throw new Error("Could not find any stream with id=" + id);
        socket.send(JSON.stringify({
            type: "stopStream",
            ID: id,
            IP: stream.ip,
            port: stream.port,
        }));
        //TODO: Discuss, if we really want to remove the stream here, since it is done by "streamIsGone", but this has a hugh latency ...
        setStreams(prevState => ({
            ...prevState,
            [id]: {
                ...prevState[id],
                status: "disconnecting"
            }
        }))
    }, [socket, streams]);

    return {
        setInputDevice: (id: number) => setSettings(prevState => ({
            ...prevState,
            inputAudioDevice: id
        })),
        setOutputDevice: (id: number) => setSettings(prevState => ({
            ...prevState,
            outputAudioDevice: id
        })),
        setFrameSize: (frameSize: number) => setSettings(prevState => ({...prevState, frameSize: frameSize})),
        setBufferSize: (bufferSize: number) => setSettings(prevState => ({...prevState, bufferSize: bufferSize})),
        startStream,
        streams,
        stopStream,
        settings,
        connected,
        available,
        ready,
        audioDevices,
        soundLevel
    }
};
