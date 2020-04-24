import React, {useCallback, useState} from "react";
import DigitalStageConnection, {Participant} from "../../lib/api/DigitalStageConnection";
import * as config from "../../env";
import {useAuth} from "../../lib/useAuth";
import {Button} from "baseui/button";
import Layout from "../../components/ui/Layout";
import VideoPlayer from "../../components/VideoPlayer";

export default () => {
    const [connected, setConnected] = useState<boolean>(false);
    const [localStream, setLocalStream] = useState<MediaStream>();
    const {user, loading} = useAuth();
    const [digitalStage] = useState(new DigitalStageConnection());
    const [participants, setParticipants] = useState<{ [uid: string]: Participant }>({});

    const establishConnection = useCallback(() => {
        digitalStage.addEventHandler({
            onConnected: () => {
                setConnected(true); // Not only "connected" here, but this is just testing
            },
            onParticipantAdded: (participant: Participant) => {
                setParticipants(prevState => ({
                    ...prevState,
                    [participant.uid]: participant
                }));
            }
        });
        console.log("1. Connect to digital stage");
        digitalStage.connect({
            hostname: config.SERVER_URL,
            port: parseInt(config.SERVER_PORT)
        })
            .then(() => {
                console.log("2. Join existing stage");
                digitalStage.joinStage(user, "VmaFVwEGz9CO7odY0Vbw", "hello")
                    .then(() => {
                    })
            });
    }, [digitalStage, user]);

    const shareWebCamAndMic = useCallback(() => {
        console.log("3. Get webcam + mic");
        navigator.mediaDevices.getUserMedia({video: true, audio: true})
            .then((stream: MediaStream) => {
                console.log("4. Publish stream");
                setLocalStream(stream);
                stream.getTracks().forEach(
                    (track: MediaStreamTrack, index: number) => {
                        console.log("4." + index + ": Publish " + track.kind + " track");
                        digitalStage.publishTrack(track, "mediasoup").catch(
                            (error) => console.error(error)
                        )
                    }
                );

            });
    }, [digitalStage]);

    if (!connected) {
        return (
            <Layout>
                <Button onClick={establishConnection}>Connect</Button>
            </Layout>
        )
    }

    return (
        <Layout>
            <div>
                <Button onClick={shareWebCamAndMic}>Share mic + cam</Button>
            </div>
            <h2>Participants</h2>
            {localStream && <VideoPlayer stream={localStream}/>}
            <ul>
                {Object.keys(participants).map((uid: string) => (
                    <li>
                        {participants[uid].uid}: {participants[uid].name}
                    </li>
                ))}
            </ul>
        </Layout>
    );
}
