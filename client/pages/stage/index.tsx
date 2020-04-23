import {Input} from "baseui/input";
import React, {useEffect, useState} from "react";
import {FormControl} from "baseui/form-control";
import {Button} from "baseui/button";
import Layout from "../../components/ui/Layout";
import {useAuth} from "../../lib/useAuth";
import LoginForm from "../../components/LoginForm";
import Loading from "../../components/ui/Loading";
import {fixWebRTC} from "../../lib/api/utils/fixWebRTC";
import * as config from "../../env";
import useStage from "../../lib/useStage";

export default () => {
    const {user, loading} = useAuth();
    const [localStream, setLocalStream] = useState<MediaStream>();
    const {connect, joinStage, stage, participants} = useStage();
    const [stageId, setStageId] = useState<string>("VmaFVwEGz9CO7odY0Vbw");
    const [password, setPassword] = useState<string>("hello");

    useEffect(() => {
        fixWebRTC();
        if (user)
            connect(config.SERVER_URL, parseInt(config.SERVER_PORT))
                .then(() => console.log("connected?"))
    }, [connect, user]);


    if (loading) {
        return (
            <Loading><h1>Loading</h1></Loading>
        )
    }

    if (!user) {
        return (
            <Layout>
                <h1>Login</h1>
                <LoginForm/>
            </Layout>
        );
    }

    if (!stage) {
        return (
            <Layout>
                <h1>Join stage</h1>
                <FormControl label={"Stage ID"}>
                    <Input value={stageId} onChange={e => setStageId(e.currentTarget.value)}/>
                </FormControl>
                <FormControl label={"Passwort"}
                             caption={"Ask your director or creator of the stage for the password"}>
                    <Input type="password" value={password} onChange={e => setPassword(e.currentTarget.value)}/>
                </FormControl>
                <Button onClick={() => {
                    joinStage(user, stageId, password).catch(
                        (error) => alert(error)
                    );
                }}>Join</Button>
            </Layout>
        );
    }

    return (
        <Layout>
            <h1>{stage.name}</h1>
        </Layout>
    )
}
