import admin from "firebase-admin";
import {Member} from "../models/Member";
import {Artist} from "../models/Artist";
import {Group, Kind} from "../models/Group";
import {Server} from "../models/Server";

const serviceAccount = require("./../../firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://digitalstage-wirvsvirus.firebaseio.com"
});

export const publishServer = (server: Server) => {
    admin.firestore().collection("server").doc(server.ip + ":" + server.port).set(
        server
    );
};

export const addMemberToServer = (member: Member, server: Server): Promise<admin.firestore.WriteResult> => {
    return admin.firestore().doc("servers/" + server.ip + ":" + server.port).collection("member").doc(member.uuid).set(member);
};
export const removeMemberFromServer = (member: Member, server: Server): Promise<admin.firestore.WriteResult> => {
    return admin.firestore().doc("servers/" + server.ip + ":" + server.port).collection("member").doc(member.uuid).delete();
};
export const addArtistToGroup = (artist: Artist, groupUuid: string): Promise<admin.firestore.WriteResult> => {
    return admin.firestore().doc("groups/" + groupUuid).collection("artists").doc(artist.uuid).set(artist);
};
export const removeArtistFromGroup = (artist: Artist, groupUuid: string): Promise<admin.firestore.WriteResult> => {
    return admin.firestore().doc("groups/" + groupUuid).collection("artists").doc(artist.uuid).delete();
};
export const createGroup = (directorUuid: string, kind: Kind): Promise<Group> => {
    return admin.firestore().collection("groups").add({
        director: {
            uuid: directorUuid
        },
        artists: [],
        kind: kind
    })
        .then(docRef => docRef.get())
        .then(snapshot => snapshot.data() as Group);
};
export const deleteGroup = (groupUuid: string): Promise<admin.firestore.WriteResult> => {
    return admin.firestore().collection("groups").doc(groupUuid).delete();
};
