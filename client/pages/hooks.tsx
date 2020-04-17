import useMediasoup from "../lib/useMediasoup";
import * as mediasoup from 'mediasoup-client';
import {Button} from "baseui/button";
import React, {useCallback, useEffect, useState} from "react";
import {FormControl} from "baseui/form-control";
import {Input} from "baseui/input";
import {Checkbox} from "baseui/checkbox";
import VideoPlayer from "../components/VideoPlayer";
import Container from "../components/ui/Container";
import {fixWebRTC} from "../lib/fixWebRTC";
import VideoTrackPlayer from "../components/VideoTrackPlayer";

export default () => {
    const [isDirector, setDirector] = useState<boolean>(false);
    const [userName, setUserName] = useState<string>("");
    const [roomName, setRoomName] = useState<string>("myroom");
    const {connect, connected, consumers, sendStream} = useMediasoup();
    const [localStream, setLocalStream] = useState<MediaStream>();

    useEffect(() => {
        fixWebRTC();
    }, []);

    const shareVideoAndAudio = useCallback(() => {
        if (localStream)
            return;
        return navigator.mediaDevices.getUserMedia({
            video: true,
            //TODO: Implement more audio options
            audio: true
        }).then(
            (stream: MediaStream) => {
                setLocalStream(stream);
                sendStream(stream)
            }
        );
    }, [sendStream]);

    if (!connected) {
        return (
            <Container>
                <FormControl label="Username">
                    <Input value={userName} onChange={(e) => setUserName(e.currentTarget.value)}/>
                </FormControl>
                <FormControl label="Room">
                    <Input value={roomName} onChange={(e) => setRoomName(e.currentTarget.value)}/>
                </FormControl>
                <FormControl>
                    <Checkbox onChange={e => setDirector(e.currentTarget.checked)} checked={isDirector}>
                        is director
                    </Checkbox>
                </FormControl>
                <FormControl>
                    <Button onClick={() => connect(userName, roomName, isDirector)}>CONNECT</Button>
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
            {consumers && consumers.map((consumer: mediasoup.types.Consumer) => (
                <div>
                    <h1>{consumer.id}</h1>
                    {consumer.track.kind === "video" && (
                        <VideoTrackPlayer track={consumer.track}/>
                    )}
                </div>
            ))}
        </Container>
    )
}
