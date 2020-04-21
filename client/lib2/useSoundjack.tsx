import {useCallback, useEffect, useState} from "react";
import {AudioDevice} from "../lib/useSoundjack";

export interface SoundjackSettings {
    valid: boolean;
    inputAudioDevice?: AudioDevice;
    outputAudioDevice?: AudioDevice;
    channelConfiguration: number; // 0 = mono, 1 = dual mono, 2 = stereo
    bitDepth: number;
    sampleRate: number;
    bufferSize: number;
    frameSize: number;  // networkBlockSize
}

const InitialSettings: SoundjackSettings = {
    valid: true,
    bitDepth: 16,
    sampleRate: 48000,
    bufferSize: 64,
    frameSize: 128,
    channelConfiguration: 0
};

const restartSoundcard = (socket: WebSocket, settings: SoundjackSettings) => {
    console.log("restartSoundcard");
    console.log("stopAudioEngine");
    socket.send(JSON.stringify({
        type: "stopAudioEngine"
    }));
    console.log("startAudioEngine");
    socket.send(JSON.stringify({
        type: "startAudioEngine",
        inputIndex: settings.inputAudioDevice ? settings.inputAudioDevice.id.toString() : "0",
        outputIndex: settings.outputAudioDevice ? settings.outputAudioDevice.id.toString() : "0",
        audioChannelIndex: settings.channelConfiguration,
        bitDepth: settings.bitDepth.toString(),
        sampleRate: settings.sampleRate.toString(),
        frameSize: settings.bufferSize.toString(),
        frameSizeSend: settings.frameSize.toString(),
    }));
};
const initialize = (socket: WebSocket, settings: SoundjackSettings) => {
    setTimeout(() => {
        console.log("probe");
        socket.send(JSON.stringify({
            type: "probe"
        }));
    }, 10);
    setTimeout(() => {
        console.log("restartSoundcard with timeout");
        restartSoundcard(socket, settings);
    }, 200);
    console.log("bind");
    socket.send(JSON.stringify({
        type: "bind",
        IP: "0.0.0.0",
        port: 50000
    }));
};


export default (host: string = "127.0.0.1", port: number = 1234) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [settings, setSettings] = useState<SoundjackSettings>(InitialSettings);
    const [socket, setSocket] = useState<WebSocket>();

    const connect = useCallback(() => {
        // Create socket
        const websocket: WebSocket = new WebSocket("ws://" + host + ":" + port);

        websocket.onmessage = (event: MessageEvent) => {
            const message: {
                type: string;
                [key: string]: any;
            } = JSON.parse(event.data);

            switch (message.type) {
                case 'standalone':
                    // Handshake with soundjack
                    initialize(websocket, settings);
                    break;
                default:
                    break;
            }
        };

        websocket.onopen = (() => {
            setSocket(websocket);
        });

        websocket.onclose = () => {
            setSocket(undefined);
        }
    }, []);

    useEffect(() => {
        if (socket) {
            // Handshake with soundjack

        }
    }, [socket]);

    return (
        loading
    );
}
