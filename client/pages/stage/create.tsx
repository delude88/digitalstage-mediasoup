import Layout from "../../components/ui/Layout";
import {FormControl} from "baseui/form-control";
import {Input} from "baseui/input";
import {Button} from "baseui/button";
import React, {useEffect, useState} from "react";
import {fixWebRTC} from "../../lib/api/utils/fixWebRTC";
import * as config from "../../env";
import {useAuth} from "../../lib/useAuth";
import Loading from "../../components/ui/Loading";
import {useRouter} from "next/router";
import {Participant} from "../../lib/api/DigitalStageConnection";
import {useStage} from "../../lib/useStage";

export default () => {
    const {user, loading} = useAuth();
    const {stage, createStage, participants, connect} = useStage();
    const [stageName, setStageName] = useState<string>("stage1");
    const router = useRouter();
    const [password, setPassword] = useState<string>("");


    useEffect(() => {
        fixWebRTC();
        connect(config.SERVER_URL, parseInt(config.SERVER_PORT));
    }, [connect, user]);

    if (loading) {
        return (
            <Loading><h1>Loading</h1></Loading>
        )
    }
    if (!user) {
        router.push("/stage/login");
    }

    if (stage) {
        return (
            <Layout>
                <h1>Stage</h1>
                <p>
                    Share this id:
                </p>
                <p>
                    <li>
                        ID: {stage.id}
                    </li>
                    {stage.password && (
                        <li>Password: {stage.password}</li>
                    )}
                </p>
                <ul>
                    {participants.map((participant: Participant) => (
                        <li>
                            {participant.soundjack}
                        </li>
                    ))}
                </ul>
            </Layout>
        )
    }

    return (
        <Layout>
            <h1>Create stage</h1>
            <FormControl label={"Stage name"}>
                <Input value={stageName} onChange={e => setStageName(e.currentTarget.value)}/>
            </FormControl>
            <FormControl label={"Passwort"}
                         caption={"Optional"}>
                <Input type="password" value={password} onChange={e => setPassword(e.currentTarget.value)}/>
            </FormControl>
            <Button onClick={() => createStage(user, stageName, password)}>Create</Button>
        </Layout>
    );
};
