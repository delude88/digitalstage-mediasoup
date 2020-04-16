import React, {Component, RefObject} from "react";
import SocketIOClient from "socket.io-client";
import * as mediasoup from 'mediasoup-client';
import {Device} from 'mediasoup-client';
import {extend, SocketWithRequest} from "../lib/socket.io-promise";
import {Producer} from "mediasoup-client/lib/Producer";

class Index extends Component<{}, {
    roomName: string,
    room?: any,
    connected: boolean
}> {
    device: Device = null;
    socket: any = null;
    stream: any = null;
    videoRef: RefObject<HTMLVideoElement>;
    producer: Producer = null;

    constructor(props) {
        super(props);
        this.state = {
            roomName: "myroom",
            connected: false
        };
        this.videoRef = React.createRef<HTMLVideoElement>();
    }

    joinRoom = async (socket: SocketIOClient.Socket, roomName: string) => {
        socket.emit("join", {
            room: roomName
        });
    };
    makeOffer = async (user) => {
        console.log("Make offer");
    };
    handleAnswerMade = async () => {
        console.log("Answer made");
    };
    handleOfferMade = async () => {
        console.log("Offer made");
    };
    handleCandidateSent = async () => {
        console.log("Candidate sent");
    };
    handleAddUsers = async (data) => {
        console.log("add-user");
        console.log(data);
        this.makeOffer(data.users[0]);
    };

    private loadDevice = async (routerRtpCapabilities) => {
        try {
            this.device = new mediasoup.Device();
        } catch (error) {
            if (error.name === 'UnsupportedError') {
                console.error('browser not supported');
            }
        }
        await this.device.load({routerRtpCapabilities});
    };

    private connect = async (roomName: string) => {
        const socket: SocketWithRequest = extend(SocketIOClient("localhost:3001"));

        socket.on("connect", async () => {
            console.log("Connected!");
            // 1. Get router rtp capabilities
            const serverRtpCapabilities = await socket.request('getRouterRtpCapabilities');
            console.log("Have answer");
            console.log(serverRtpCapabilities);
            await this.loadDevice(serverRtpCapabilities);
            const transportData = await socket.request('create-producer-transport', {
                forceTcp: false,
                rtpCapabilities: this.device.rtpCapabilities,
            });
            if (transportData.error) {
                console.error(transportData.error);
                return;
            }
            const transport = this.device.createSendTransport(transportData);
            // ADD TRANSPORT HANDLER
            transport.on('connect', async ({dtlsParameters}, callback, errback) => {
                console.log("transport connect");
                socket.request('connect-producer-transport', {dtlsParameters})
                    .then(callback)
                    .catch(errback);
            });
            transport.on('produce', async ({kind, rtpParameters}, callback, errback) => {
                console.log("produce");
                try {
                    const {id} = await socket.request('produce', {
                        transportId: transport.id,
                        kind,
                        rtpParameters,
                    });
                    callback({id});
                } catch (err) {
                    errback(err);
                }
            });
            transport.on('connectionstatechange', (state) => {
                switch (state) {
                    case 'connecting':
                        this.setState({connected: false});
                        console.log("publishing...");
                        break;

                    case 'connected':
                        this.setState({connected: true});
                        this.videoRef.current.srcObject = this.stream;
                        console.log("published");
                        break;

                    case 'failed':
                        transport.close();
                        console.log("failed");
                        break;

                    default:
                        break;
                }
            });
            let stream;
            try {
                stream = await this.getUserMedia(transport);
                const track = stream.getVideoTracks()[0];
                const params: any = {track};
                params.encodings = [
                    {maxBitrate: 100000},
                    {maxBitrate: 300000},
                    {maxBitrate: 900000},
                ];
                params.codecOptions = {
                    videoGoogleStartBitrate: 1000
                };
                this.producer = await transport.produce(params);
            } catch (err) {
                console.error(err);
            }
        });
        socket.on('disconnect', () => {
            //TODO: Implement disconnect handling
        });
        socket.on('connect_error', (error) => {
            console.error(error);
            //TODO: Implement connection error handling
        });
        socket.on('producer-added', () => {
            //TODO: Implement new producer
        });

        socket.on('answer-made', this.handleAnswerMade);

        socket.on('offer-made', this.handleOfferMade);

        socket.on('candidate-sent', this.handleCandidateSent);

        socket.on('add-users', this.handleAddUsers);
    };

    componentDidMount(): void {
        this.device = new mediasoup.Device();
    }

    getUserMedia = async (transport) => {
        if (!this.device.canProduce('video')) {
            console.error('cannot produce video');
            return;
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({video: true})
        } catch (err) {
            console.error('getUserMedia() failed:', err.message);
            throw err;
        }
        return stream;
    };

    render() {
        return (
            <div>
                <input type="text" value={this.state.roomName}
                       onChange={(e) => this.setState({roomName: e.target.value})}/>
                <button onClick={() => this.connect(this.state.roomName)}>connect</button>
                {this.state.room && (
                    <div>
                        <h1>Connected</h1>
                        <video ref={this.videoRef}/>
                    </div>
                )}
            </div>
        );
    }
}

export default Index;
