import {Input} from "baseui/input";
import React, {useCallback, useEffect, useState} from "react";
import {FormControl} from "baseui/form-control";
import {Button, SIZE} from "baseui/button";
import Layout from "../../components/ui/Layout";
import {useAuth} from "../../lib/useAuth";
import LoginForm from "../../components/LoginForm";
import Loading from "../../components/ui/Loading";
import {fixWebRTC} from "../../lib/api/fixWebRTC";
import useStage from "../../lib/deprecated/useStage";
import * as config from "../../env";
import {Checkbox} from "baseui/checkbox";
import AudioQualitySettings from "../../models/AudioQualitySettings";
import VideoPlayer from "../../components/VideoPlayer";
import Actor from "../../lib/deprecated/useStage/types/Actor";
import VideoTrackPlayer from "../../components/VideoTrackPlayer";

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
    const {connect, joinStage, stage, actors, streamTrack} = useStage(config.SERVER_URL, parseInt(config.SERVER_PORT));
    const [localStream, setLocalStream] = useState<MediaStream>();

    useEffect(() => {
        fixWebRTC();
        if (user)
            connect();
    }, [user]);

    const shareVideoAndAudio = useCallback(() => {
        if (localStream)
            return;
        return navigator.mediaDevices.getUserMedia({
            video: {
                width: config.WEBCAM_WIDTH,
                height: config.WEBCAM_HEIGHT
            },
            //TODO: Implement more audio options
            audio: useHighAudioQuality ? HighAudioQualitySettings : true
        }).then(
            (stream: MediaStream) => {
                stream.getTracks().forEach((track: MediaStreamTrack) => streamTrack(track));
                setLocalStream(stream);
            }
        );
    }, [streamTrack]);

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
                <Button size={SIZE.large} onClick={() => joinStage(user, stageId)}>
                    Join
                </Button>
            </Layout>
        );
    }

    return (
        <Layout>
            <h1>{stage.name}</h1>
            {localStream ?
                <VideoPlayer stream={localStream}/> :
                <Button onClick={shareVideoAndAudio}>SHARE VIDEO</Button>
            }
            {actors && actors.map((actor: Actor) => (
                <div>
                    <h1>{actor.name}</h1>
                    {actor.videoTracks.map((track: MediaStreamTrack) => (
                        <VideoTrackPlayer track={track}/>
                    ))}
                </div>
            ))}
        </Layout>
    )
}
