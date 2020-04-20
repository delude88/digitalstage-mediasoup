import TimeSignature from "./TimeSignature";
import {RoomKind} from "./RoomKind";
import Director from "./Director";
import Participant from "./Participant";

export default interface Room {
    id: string;
    name: string;
    click: {
        bpm: number;
        timeSignature: TimeSignature;
        startTime: number;
        active: boolean;
    };
    tracks: AudioTrack[];
    participants: Participant[];
    director?: Director;
    kind: RoomKind;
}
