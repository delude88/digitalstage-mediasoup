import React, {useEffect} from "react";
import Router from "next/router";
import firebase from "firebase/app";
import "firebase/auth"
import Loading from "../../components/ui/Loading";

export default () => {

    useEffect(() => {
        firebase.auth().signOut().then(
            () => Router.replace("/stage")
        )
    }, []);

    return (
        <Loading>
            <h1>
                Signing out..
            </h1>
        </Loading>
    );
}
