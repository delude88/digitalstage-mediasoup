import admin from "firebase-admin";
import {RoomKind} from "../models/RoomKind";
import Room from "../models/Room";
import TimeSignature from "../models/TimeSignature";

const serviceAccount = require("../firebase-adminsdk.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://digitalstage-wirvsvirus.firebaseio.com"
});


export const createRoom = (user: admin.auth.UserInfo, name: string, kind: RoomKind): Promise<Room> => {
    return admin.firestore().collection("rooms").add({
        director: {
            id: user.uid,
            displayName: user.displayName
        },
        click: {
            bpm: 120,
            timeSignature: {
                beats: 4,
                measure: 4
            } as TimeSignature,
            active: false,
        },
        name: name,
        kind: kind
    })
        .then(docRef => docRef.get())
        .then(snapshot => ({
            ...snapshot.data(),
            id: snapshot.id
        } as Room));
};
