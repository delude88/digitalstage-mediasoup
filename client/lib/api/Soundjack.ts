import omit from 'lodash.omit';
import debounce from 'lodash.debounce';

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

export interface SoundjackEventHandler {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onAudioDeviceAdded?: (id: string, name: string) => void;
    onAudioDeviceRemoved?: (id: string, name: string) => void;
    onStreamAdded?: (id: string, stream: Stream) => void;
    onStreamRemoved?: (id: string, stream: Stream) => void;
    onStreamChanged?: (id: string, stream: Stream) => void;
    onSettingsUpdated?: (settings: SoundjackSettings) => void;
    onSoundLevelChanged?: (soundLevel: number) => void;
    onConnectionInfoUpdated?: (connection: ConnectionInfo) => void;
}

export default class Soundjack {
    private eventHandler: SoundjackEventHandler[] = [];
    private websocket: WebSocket | null = null;
    private version: string | null = null;
    private connectionInfo: ConnectionInfo | null = null;
    private connected: boolean = false;
    private soundLevel: number = 0;
    private audioDevices: {
        [id: number]: string
    } = {};
    private streams: {
        [id: string]: Stream
    };
    private settings: SoundjackSettings = {
        valid: false,
        inputAudioDevice: 0,
        outputAudioDevice: 0,
        channelConfiguration: 1,
        bitDepth: 16,
        sampleRate: 40000,
        bufferSize: 512,
        frameSize: 512
    };

    constructor() {
        window.addEventListener("beforeunload", (ev) => {
            ev.preventDefault();
            this.disconnect();
        });
    }

    public connect = (ip: string = "127.0.0.1", port: number = 1234) => {
        this.websocket = new WebSocket("ws://" + ip + ":" + port);
        this.attachWebSocketHandler();
    };

    public isConnected = (): boolean => {
        return this.connected;
    };

    public disconnect = () => {
        this.debouncedInitializeAudio.cancel();
        Object.keys(this.streams).forEach((id: string) => {
            this.stopStream(id);
        });
        if (this.websocket) {
            this.websocket.close();
        }
        this.connected = false;
        this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onDisconnected && eventHandler.onDisconnected());
    };

    public startStream = (targetIp: string, targetPort: number) => {
        this.websocket.send(JSON.stringify({
            type: "startStream",
            IP: targetIp,
            port: targetPort.toString(),
            ownID: "0",
            remoteSenderID: "0",
            remoteNAT: ""
        }));
    };

    public stopStream = (id: string) => {
        const stream: Stream = this.streams[id];
        if (stream) {
            this.websocket.send(JSON.stringify({
                type: "stopStream",
                ID: id,
                IP: stream.ip,
                port: stream.port,
            }));
        } else {
            throw new Error("Could not find any stream with id: " + id);
        }
    };

    public setSoundLevel = (soundLevel: number) => {
        this.websocket.send(JSON.stringify({
            type: "setLocalVolume",
            level: soundLevel.toString()
        }));
    };

    public setInputDevice = (id: number) => {
        if (this.audioDevices[id] && this.settings.inputAudioDevice !== id) {
            this.settings.inputAudioDevice = id;
            this.debouncedInitializeAudio();
        }
    };

    public setOutputDevice = (id: number) => {
        if (this.audioDevices[id] && this.settings.outputAudioDevice !== id) {
            this.settings.outputAudioDevice = id;
            this.debouncedInitializeAudio();
        }
    };

    public setFrameSize = (frameSize: number) => {
        if (this.settings.frameSize !== frameSize) {
            this.settings.frameSize = frameSize;
            this.debouncedInitializeAudio();
        }
    };
    public setBufferSize = (bufferSize: number) => {
        if (this.settings.bufferSize !== bufferSize) {
            this.settings.bufferSize = bufferSize;
            this.debouncedInitializeAudio();
        }
    };

    public addEventHandler = (eventHandler: SoundjackEventHandler) => {
        this.eventHandler.push(eventHandler);
    };

    public removeEventHandler = (eventHandler: SoundjackEventHandler) => {
        this.eventHandler = this.eventHandler.filter((e: SoundjackEventHandler) => e !== eventHandler);
    };

    private initializeAudio = () => {
        this.websocket.send(JSON.stringify({
            type: "stopAudioEngine"
        }));
        this.websocket.send(JSON.stringify({
            audioChannelIndex: this.settings.channelConfiguration.toString(),
            bitDepth: this.settings.bitDepth.toString(),
            buchse1: "on",
            buchse2: "on",
            buchse3: "off",
            buchse4: "off",
            buchse5: "off",
            buchse6: "off",
            buchse7: "off",
            buchse8: "off",
            frameSize: this.settings.bufferSize.toString(),
            frameSizeSend: this.settings.frameSize.toString(),
            inputIndex: this.settings.inputAudioDevice.toString(),
            outputIndex: this.settings.outputAudioDevice.toString(),
            sampleRate: this.settings.sampleRate.toString(),
            type: "startAudioEngine"
        }));
    };
    private debouncedInitializeAudio = debounce(this.initializeAudio, 200);

    private attachWebSocketHandler = () => {
        this.websocket.onopen = () => {
            this.websocket.send(JSON.stringify({
                type: "standalone",
                mode: "private"
            }));
        };

        this.websocket.onmessage = (event: MessageEvent) => {
            const message: {
                type: string;
                [key: string]: any;
            } = JSON.parse(event.data);

            switch (message.type) {
                case 'standalone':
                    this.version = message.version;
                    setTimeout(() => {
                        this.websocket.send(JSON.stringify({
                            type: "probe"
                        }));
                        this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onConnected && eventHandler.onConnected());
                        this.connected = true;
                    }, 10);
                    this.websocket.send(JSON.stringify({
                        type: "bind",
                        IP: "0.0.0.0",
                        port: "50000"
                    }));
                    break;
                case 'setVideoDeviceInfo':
                    // Ignore
                    break;
                case 'setAudioDeviceInfo':
                    this.audioDevices = {
                        ...this.audioDevices,
                        [message.audioCount]: message.audioName
                    };
                    break;
                case 'streamIsHere':
                    //TODO: Handle remote streams (!)
                    if (message.ID !== "X") {
                        let stream: Stream = this.streams[message.ID];
                        if (!stream) {
                            stream = {
                                ip: message.IP,
                                port: message.port,
                                decodeFactor: message.decodeFactor,
                                channelCount: message.channelCount,
                                frameSize: message.frameSize,
                                status: "active"
                            };
                            this.streams[message.ID] = stream;
                        } else {
                            stream.ip = message.IP;
                            stream.port = message.port;
                            stream.decodeFactor = message.decodeFactor;
                            stream.frameSize = message.frameSize;
                            stream.status = "active";
                        }
                        this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onStreamAdded && eventHandler.onStreamAdded(message.ID, stream));
                    }
                    break;
                case 'setRemoteSoundLevel':
                    const handleSetRemoteSoundLevel = () => {
                        const stream: Stream = this.streams[message.data1];
                        if (stream && stream.remoteSoundLevel !== message.data2) {
                            //TODO: What is new here?
                            stream.remoteSoundLevel = message.data2;
                            this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onStreamChanged && eventHandler.onStreamChanged(message.data1, stream));
                        }
                    };
                    handleSetRemoteSoundLevel();
                    break;
                case 'streamIsGone':
                    const handleStreamIsGone = () => {
                        //TODO: Handle remote streams (!)
                        const stream: Stream = this.streams[message.data1];
                        if (stream) {
                            this.streams = omit(this.streams, message.data1);
                            this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onStreamRemoved && eventHandler.onStreamRemoved(message.data1, stream));
                        }
                    };
                    handleStreamIsGone();
                    break;
                case 'tellLatency':
                    // Only accept active streams
                    const handleTellLatency = () => {
                        const stream: Stream = this.streams[message.data1];
                        if (stream) {
                            stream.latency = message.data2;
                            this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onStreamChanged && eventHandler.onStreamChanged(message.data1, stream));
                        }
                    };
                    handleTellLatency();
                    break;
                case 'setNICOptions':
                    //TODO: Shall we store the data somewhere?
                    break;
                case 'soundCardStatus':
                    break;
                case 'setLocalSoundLevel':
                    if (this.soundLevel !== message.maxSampleValue) {
                        this.soundLevel = message.maxSampleValue;
                        this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onSoundLevelChanged && eventHandler.onSoundLevelChanged(this.soundLevel));
                    }
                    break;
                case 'tellPort':
                    this.connectionInfo = {
                        NAT: message.NAT,
                        interfaceIP: message.interfaceIP,
                        localIP: message.localIP,
                        localIP2: message.localIP2,
                        localBindPort: message.localBindPort,
                    } as ConnectionInfo;
                    this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onConnectionInfoUpdated && eventHandler.onConnectionInfoUpdated(this.connectionInfo));
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
        this.websocket.onerror = (error: Event) => {
            console.error(error);
            this.connected = false;
            this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onDisconnected && eventHandler.onDisconnected());
        };
        this.websocket.onclose = (event: CloseEvent) => {
            this.connected = false;
            this.eventHandler.forEach((eventHandler: SoundjackEventHandler) => eventHandler.onDisconnected && eventHandler.onDisconnected());
        };
    }
}
