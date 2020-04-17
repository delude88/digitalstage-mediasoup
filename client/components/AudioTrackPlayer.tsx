import React, {useEffect, useRef} from "react";
import {styled} from "baseui";

const Player = styled('audio', {
    backgroundColor: 'black'
});

export default (props: {
    track: MediaStreamTrack
}) => {
    const audioRef = useRef<HTMLAudioElement>();

    useEffect(() => {
        if (props.track) {
            audioRef.current.srcObject = new MediaStream([props.track.clone()]);
            audioRef.current.play();
        } else {
            audioRef.current.srcObject = null;
        }
    }, [props.track]);

    return (
        <Player ref={audioRef} controls={true} autoPlay={true} muted={true} playsInline={true}/>
    )
};

