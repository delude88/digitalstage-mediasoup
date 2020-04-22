import {Button} from "baseui/button";
import React, {useCallback, useEffect, useState} from "react";
import {FormControl} from "baseui/form-control";
import {Input} from "baseui/input";
import {Checkbox} from "baseui/checkbox";
import VideoPlayer from "../../components/VideoPlayer";
import Container from "../../components/ui/Container";
import {fixWebRTC} from "../../lib/api/fixWebRTC";
import VideoTrackPlayer from "../../components/VideoTrackPlayer";
import * as config from "../../env";
import AudioQualitySettings from "../../models/AudioQualitySettings";
import useStage from '../../lib/deprecated/useStage';
import {useAuth} from "../../lib/useAuth";
import Actor from "../../lib/deprecated/useStage/types/Actor";
import Loading from "../../components/ui/Loading";

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
    const [isDirector, setDirector] = useState<boolean>(false);
    const [userName, setUserName] = useState<string>("name");
    const [roomId, setRoomId] = useState<string>("myroom");
    const [useHighAudioQuality, setHighAudioQuality] = useState<boolean>(false);
    const {user, loading} = useAuth();
    const {connect, joinStage, isConnected, actors, streamTrack} = useStage(config.SERVER_URL, parseInt(config.SERVER_PORT));
    const [localStream, setLocalStream] = useState<MediaStream>();

    useEffect(() => {
        fixWebRTC();
        connect();
    }, []);

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
            }
        );
    }, [streamTrack]);

    if (loading)
        return <Loading><h1>Loading ...</h1></Loading>;

    if (!isConnected) {
        return (
            <Container>
                <FormControl label="Username">
                    <Input value={userName} onChange={(e) => setUserName(e.currentTarget.value)}/>
                </FormControl>
                <FormControl label="Room ID">
                    <Input value={roomId} onChange={(e) => setRoomId(e.currentTarget.value)}/>
                </FormControl>
                <FormControl>
                    <Checkbox onChange={e => setHighAudioQuality(e.currentTarget.checked)}
                              checked={useHighAudioQuality}>
                        High Audio Quality
                    </Checkbox>
                </FormControl>
                <FormControl>
                    <Checkbox onChange={e => setDirector(e.currentTarget.checked)} checked={isDirector}>
                        is director
                    </Checkbox>
                </FormControl>
                <FormControl>
                    <Button onClick={() => joinStage(user, roomId)}>CONNECT</Button>
                </FormControl>
            </Container>
        );
    }

    return (
        <Container>
            <Button onClick={shareVideoAndAudio}>SHARE VIDEO</Button>
            {localStream && (
                <VideoPlayer stream={localStream}/>
            )}
            {actors && actors.map((actor: Actor) => (
                <div>
                    <h1>{actor.name}</h1>
                    {actor.videoTracks.map((track: MediaStreamTrack) => (
                        <VideoTrackPlayer track={track}/>
                    ))}
                </div>
            ))}
        </Container>
    )
}
