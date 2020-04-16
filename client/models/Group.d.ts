import {Director} from "./Director";
import {Artist} from "./Artist";

export enum Kind {
    MUSICAL,
    THEATER,
    CONFERENCE
}

export interface TimeSignature {
    beats: number,
    measure: number
}

export interface Beat {
    bpm: number;
    signature: TimeSignature
}

export interface Playback {
    label: string;
    url: string;    // Firebase Storage URL
}

export interface Group {
    uuid: string;
    director: Director;
    artists: Artist[];
    kind: Kind;
    beat?: Beat;
    playbacks?: Playback[];
}
