import {WebRtcTransport} from "mediasoup/lib/WebRtcTransport";
import {Producer} from "mediasoup/lib/Producer";
import {Consumer} from "mediasoup/lib/Consumer";

export interface Actor {
    uid: string;
    name: string;
    role: "actor" | "director";
    socketId: string;
    transports: {
        [id: string]: WebRtcTransport;
    };
    producers: {
        [id: string]: Producer;
    };
    consumers: {
        [id: string]: Consumer;
    };
}


export interface Stage {
    id: string;
    name: string;
    communication: "p2p" | "server";
    type: "theater" | "music" | "conference";
    actors: Actor[];
}

interface StageRepositoryEventHandler {
    onStageCreated: (stage: Stage) => void
}

export class StageRepository {
    stages: Stage[];
    eventHandler: StageRepositoryEventHandler[];

    public addEventHanlder = (eventHandler: StageRepositoryEventHandler) => {
        this.eventHandler.push(eventHandler);
    };
    public removeEventHanlder = (eventHandler: StageRepositoryEventHandler) => {
        //TODO: Check if this works:
        this.eventHandler = this.eventHandler.filter((e: StageRepositoryEventHandler) => e !== eventHandler);
    };

    public createStage = () => {

    };

    public getStage = (id: string): Stage | undefined => this.stages.find((stage: Stage) => stage.id === id);
}
