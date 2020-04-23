import {SocketWithRequest} from "./utils/SocketWithRequest";
import * as mediasoup from 'mediasoup-client';

export interface MediasoupEventHandler {
    onConnected: () => void;
    onDisconnected: () => void;
    onConsumerAdded: (consumer: mediasoup.types.Consumer) => void;
    onConsumerRemoved: (consumer: mediasoup.types.Consumer) => void;
}

export default class MediasoupConnection {
    private readonly socket: SocketWithRequest;
    private device: mediasoup.Device | null = null;
    private sendTransport: mediasoup.types.Transport | null = null;
    private receiveTransport: mediasoup.types.Transport | null = null;
    private producers: mediasoup.types.Producer[] = [];
    private consumers: mediasoup.types.Consumer[] = [];
    private eventHandler: MediasoupEventHandler[] = [];

    constructor(socket: SocketWithRequest) {
        this.socket = socket;
    }

    public connect = (): Promise<void> => {
        return new Promise<void>(async (resolve, reject) => {
            try {
                this.device = new mediasoup.Device();
                // Step 1: Get RTP Capabilities
                const routerRtpCapabilities = await this.socket.request('ms-get-rtp-capabilities', {});
                if (!routerRtpCapabilities)
                    throw new Error("Error retrieving the RTP Capabilities");
                await this.device.load({routerRtpCapabilities});

                // Step 2: Create send transport
                const sendTransportOptions = await this.socket.request('ms-create-send-transport', {
                    forceTcp: false,
                    rtpCapabilities: this.device.rtpCapabilities,
                });
                if (!sendTransportOptions)
                    throw new Error("Error retrieving the send transport options");
                this.sendTransport = this.device.createSendTransport(sendTransportOptions);
                this.sendTransport.on('connect', async ({dtlsParameters}, callback, errCallback) => {
                    console.log("sendTransport: connect");
                    this.socket.request('ms-connect-transport', {
                        transportId: sendTransportOptions.id,
                        dtlsParameters
                    })
                        .then(callback)
                        .catch(errCallback);
                });
                this.sendTransport.on('produce', async ({kind, rtpParameters, appData}, callback) => {
                    console.log("sendTransport: produce");
                    const result = await this.socket.request('ms-send-track', {
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
                this.sendTransport.on('connectionstatechange', async (state) => {
                    console.log("sendTransport: connectionstatechange " + state);
                    if (state === 'closed' || state === 'failed' || state === 'disconnected') {
                        console.error("Disconnect by server side");
                    }
                });

                // Step 3: Create receive transport
                const receiveTransportOptions = await this.socket.request('ms-create-receive-transport', {
                    forceTcp: false,
                    rtpCapabilities: this.device.rtpCapabilities,
                });
                if (!receiveTransportOptions) {
                    throw new Error("Error retrieving the receive transport options");
                }
                this.receiveTransport = this.device.createRecvTransport(receiveTransportOptions);
                this.receiveTransport.on('connect', async ({dtlsParameters}, callback, errCallback) => {
                    console.log("receiveTransport: connect");
                    await this.socket.request('ms-connect-transport', {
                        transportId: receiveTransportOptions.id,
                        dtlsParameters
                    })
                        .then(callback)
                        .catch(errCallback);
                });
                this.receiveTransport.on('connectionstatechange', async (state) => {
                    console.log("receiveTransport: connectionstatechange " + state);
                    if (state === 'closed' || state === 'failed' || state === 'disconnected') {
                        console.error("Disconnect by server side");
                        this.eventHandler.forEach((eventHandler: MediasoupEventHandler) => eventHandler.onDisconnected && eventHandler.onDisconnected());
                    }
                });

                // Step 4: Add handler for new producers (create a consumer and start consuming them)
                this.socket.on('ms-producer-added', async (data: {
                    userId: string,
                    producerId: string
                }) => {
                    console.log("new producer" + data.producerId);

                    const consumerOptions = await this.socket.request('consume', {
                        producerId: data.producerId,
                        transportId: this.receiveTransport.id,
                        rtpCapabilities: this.device.rtpCapabilities
                    });
                    const consumer: mediasoup.types.Consumer = await this.receiveTransport.consume(consumerOptions);
                    await this.socket.request('finish-consume', {
                        id: consumerOptions.id
                    });
                    consumer.resume();
                    this.consumers.push(consumer);
                    this.eventHandler.forEach((eventHandler: MediasoupEventHandler) => eventHandler.onConsumerAdded && eventHandler.onConsumerAdded(consumer));
                });

                this.eventHandler.forEach((eventHandler: MediasoupEventHandler) => eventHandler.onConnected && eventHandler.onConnected());
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    };

    public disconnect = () => {
        //TODO: Replace with methods, that also handles the internal state
        this.producers.forEach((producer: mediasoup.types.Producer) => producer.close());
        this.consumers.forEach((consumer: mediasoup.types.Consumer) => consumer.close());
        this.sendTransport.close();
        this.receiveTransport.close();
        this.sendTransport = null;
        this.receiveTransport = null;
        this.device = null;
        this.eventHandler.forEach((eventHandler: MediasoupEventHandler) => eventHandler.onDisconnected && eventHandler.onDisconnected());
    };

    public publishTrack(track: MediaStreamTrack): Promise<void> {
        return this.sendTransport.produce({track: track}).then(
            (producer: mediasoup.types.Producer) => {
                if (track.kind === 'audio' || track.kind === 'video') {
                    this.producers.push(producer);
                } else {
                    // Are there other kinds of tracks?
                    throw new Error("Unknown kind of track: " + track.kind);
                }
                return;
            }
        );
    }

    public unpublishTrack(track: MediaStreamTrack) {
        const producer: mediasoup.types.Producer = this.findProducerForTrack(track);
        if (producer) {
            producer.close();
        } else {
            throw new Error("Could not find any publication of track with id=" + track.id);
        }
    }

    public addEventHandler = (eventHandler: MediasoupEventHandler) => {
        this.eventHandler.push(eventHandler);
    };

    public removeEventHandler = (eventHandler: MediasoupEventHandler) => {
        this.eventHandler = this.eventHandler.filter((e: MediasoupEventHandler) => e !== eventHandler);
    };

    private findProducerForTrack = (track: MediaStreamTrack): mediasoup.types.Producer | null => {
        return this.producers.find((producer: mediasoup.types.Producer) => producer.track != null && producer.track.id === track.id);
    }
}
