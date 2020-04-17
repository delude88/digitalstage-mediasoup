import firebase from "firebase/app";
import {FIREBASE_CONFIG} from "../env";

export default () => {
    if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
    }
};
