import {Member} from "./Member";

export interface Server {
    ip: string;
    port: number;
    members: Member[];  // Members signed in to that server
}
