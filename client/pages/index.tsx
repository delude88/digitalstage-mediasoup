import {Component} from "react";
import * as mediasoup from 'mediasoup-client';
import SocketIOClient from "socket.io-client";
import {extend, SocketWithRequest} from "../lib/socket.io-promise";
import {Button} from "baseui/button";
import {fixWebRTC} from "../lib/fixWebRTC";
import {Transport} from "mediasoup-client/lib/Transport";
import VideoPlayer from "../components/VideoPlayer";
import VideoTrackPlayer from "../components/VideoTrackPlayer";
import AudioTrackPlayer from "../components/AudioTrackPlayer";

class Index extends Component<{}, {
    device?: mediasoup.Device;
    sendTransport?: mediasoup.types.Transport;
    receiveTransport?: mediasoup.types.Transport;
    videoProducer: mediasoup.types.Producer[];
    audioProducer: mediasoup.types.Producer[];
    consumer: mediasoup.types.Consumer[];
    localStream?: MediaStream;
}> {

    constructor(props) {
        super(props);
        this.state = {
            consumer: [],
            videoProducer: [],
            audioProducer: []
        };
    }

    componentDidMount(): void {
        fixWebRTC();
        console.log("Creating mediasoup device");
        this.setState({
            device: new mediasoup.Device()
        });
    }

    createLocalProducer = (): Promise<void> => {
        if (!this.state.sendTransport)
            return;
        if (!this.state.device.canProduce('video')) {
            console.error('cannot produce video');
            return;
        }
        if (!this.state.device.canProduce('audio')) {
            console.error('cannot produce audio');
            return;
        }
        return navigator.mediaDevices.getUserMedia({
            video: true,
            //TODO: Implement more audio options
            audio: true
        })
            .then((stream: MediaStream) => {
                stream.getVideoTracks().forEach(
                    (track: MediaStreamTrack) => {
                        console.log("Created a new producer for video");
                        this.state.sendTransport.produce({track: track}).then(
                            (producer: mediasoup.types.Producer) => {
                                this.setState(prevState => ({
                                    videoProducer: [...prevState.videoProducer, producer]
                                }));
                            }
                        );
                    }
                );
                stream.getAudioTracks().forEach(
                    (track: MediaStreamTrack) => {
                        console.log("Created a new producer for audio");
                        this.state.sendTransport.produce({track: track}).then(
                            (producer: mediasoup.types.Producer) => {
                                this.setState(prevState => ({
                                    audioProducer: [...prevState.audioProducer, producer]
                                }));
                            }
                        ).catch((error) => {
                            console.error(error);
                        });
                    }
                );
                this.setState({
                    localStream: stream
                });
            });
    };

    connect = async (memberId: string, roomName: string, isDirector: boolean = false) => {
        if (!this.state.device) {
            throw new Error("Mediasoup device is not ready");
        }
        const socket: SocketWithRequest = extend(SocketIOClient("thepanicure.de:3001"));

        console.log("connect 1: join room");
        const routerRtpCapabilities = await socket.request('join-room', {
            memberId: memberId,
            roomName: roomName,
            isDirector: isDirector
        });
        if (!routerRtpCapabilities) {
            console.log("Error joining the room");
            return;
        }
        await this.state.device.load({routerRtpCapabilities});


        /** CONNECT 2: Create send transport **/
        console.log("connect 2: create send transport");
        const sendTransportOptions = await socket.request('create-send-transport', {
            forceTcp: false,
            rtpCapabilities: this.state.device.rtpCapabilities,
        });
        if (sendTransportOptions.error) {
            throw new Error("connect 2: " + sendTransportOptions.error);
        }
        const sendTransport: Transport = this.state.device.createSendTransport(sendTransportOptions);
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

        /** CONNECT 3: Create receive transport **/
        console.log("connect 3: create receive transport");
        const receiveTransportOptions = await socket.request('create-receive-transport', {
            forceTcp: false,
            rtpCapabilities: this.state.device.rtpCapabilities,
        });
        if (receiveTransportOptions.error) {
            throw new Error("connect 3: " + receiveTransportOptions.error);
        }
        const receiveTransport: Transport = this.state.device.createRecvTransport(receiveTransportOptions);
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


        // Handle incoming consume reports
        socket.on('producer-added', async (data: {
            id: string
        }) => {
            console.log("new producer" + data.id);

            const consumerOptions = await socket.request('consume', {
                producerId: data.id,
                transportId: receiveTransport.id,
                rtpCapabilities: this.state.device.rtpCapabilities
            });
            const consumer: mediasoup.types.Consumer = await receiveTransport.consume(consumerOptions);
            await socket.request('finish-consume', {
                id: consumerOptions.id
            });
            consumer.resume();
            this.setState(prevState => ({consumer: [...prevState.consumer, consumer]}));
        });


        this.setState({
            sendTransport: sendTransport,
            receiveTransport: receiveTransport
        });
    };

    render() {
        return (
            <div>
                <Button onClick={() => this.connect('myname', 'myroom')}>Connect</Button>
                {this.state.sendTransport && (
                    <Button onClick={this.createLocalProducer}>Share video + audio</Button>
                )}
                {this.state.localStream && (
                    <VideoPlayer stream={this.state.localStream}/>
                )}
                {this.state.consumer && this.state.consumer.map((consumer: mediasoup.types.Consumer) => (
                    <div>
                        <h1>{consumer.id}</h1>
                        {consumer.kind === "video" && (
                            <VideoTrackPlayer track={consumer.track}/>
                        )}
                        {consumer.kind === "audio" && (
                            <AudioTrackPlayer track={consumer.track}/>
                        )}
                    </div>
                ))}
            </div>
        );
    }
}

export default Index;
