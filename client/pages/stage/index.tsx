import {Input} from "baseui/input";
import React, {useCallback, useEffect, useState} from "react";
import {FormControl} from "baseui/form-control";
import {Button, SIZE} from "baseui/button";
import Layout from "../../components/ui/Layout";
import {useAuth} from "../../lib/useAuth";
import LoginForm from "../../components/LoginForm";
import Loading from "../../components/ui/Loading";
import {fixWebRTC} from "../../lib/api/utils/fixWebRTC";
import * as config from "../../env";
import {Checkbox} from "baseui/checkbox";
import AudioQualitySettings from "../../models/AudioQualitySettings";
import VideoPlayer from "../../components/VideoPlayer";
import Actor from "../../lib/deprecated/useStage/types/Actor";
import VideoTrackPlayer from "../../components/VideoTrackPlayer";
import useStage from "../../lib/useStage";

const HighAudioQualitySettings: AudioQualitySettings = {
    autoGainControl: false,
    channelCount: 1,
    echoCancellation: false,
    latency: 0,
    noiseSuppression: false,
    sampleRate: 48000,
    sampleSize: 16,
    volume: 1.0
};

export default () => {
    const [stageId, setStageId] = useState<string>("stage1");
    const [password, setPassword] = useState<string>("");
    const {user, loading} = useAuth();
    const [useHighAudioQuality, setHighAudioQuality] = useState<boolean>(false);
    const {connect, joinStage, stage, participants} = useStage();
    const [localStream, setLocalStream] = useState<MediaStream>();

    useEffect(() => {
        fixWebRTC();
        if (user)
            connect(config.SERVER_URL, parseInt(config.SERVER_PORT));
    }, [user]);


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
                <FormControl label={"Stage name"}>
                    <Input value={stageId} onChange={e => setStageId(e.currentTarget.value)}/>
                </FormControl>
                <FormControl label={"Passwort"}
                             caption={"Ask your director or creator of the stage for the password"}>
                    <Input type="password" value={password} onChange={e => setPassword(e.currentTarget.value)}/>
                </FormControl>
                <FormControl>
                    <Checkbox onChange={e => setHighAudioQuality(e.currentTarget.checked)}
                              checked={useHighAudioQuality}>
                        High Audio Quality
                    </Checkbox>
                </FormControl>
            </Layout>
        );
    }

    return (
        <Layout>
            <h1>{stage.name}</h1>
        </Layout>
    )
}
