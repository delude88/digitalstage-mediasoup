import Layout from "../../components/ui/Layout";
import {useAuth} from "../../lib/useAuth";
import Loading from "../../components/ui/Loading";
import React from "react";
import {useRouter} from "next/router";

export default () => {
    const {user, loading} = useAuth();
    const router = useRouter();

    if (loading) {
        return (
            <Loading><h1>Loading</h1></Loading>
        )
    }

    if (!user) {
        router.push("/stage/login");
    }

    return (
        <Layout>
            <h1>Account</h1>
            <ul>
                <li>
                    <strong>Name:</strong> {user.displayName}
                </li>
                <li>
                    <strong>E-Mail:</strong> {user.email} {user.emailVerified ? "(verified)" : "(not verified)"}
                </li>
                <li>
                    <strong>Phone number:</strong> {user.phoneNumber}
                </li>
                <li>
                    <strong>Photo URL:</strong> {user.photoURL}
                </li>
            </ul>
            <h3>Details:</h3>
            <p>Soon you can change your account settings here</p>
        </Layout>
    )
}
