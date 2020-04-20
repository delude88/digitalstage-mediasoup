import * as mediasoup from "mediasoup-client";
import P2PConnections from "./P2PConnections";

export default interface Actor {
    uid: string;
    name: string;
    audioTracks: MediaStreamTrack[];
    videoTracks: MediaStreamTrack[];
    role: "actor" | "director";
    socketId: string;
    _p2pConnection?: P2PConnections;
    _mediasoup?: {
        producerIds: string[]
        consumers: mediasoup.types.Consumer[]
    }
}
