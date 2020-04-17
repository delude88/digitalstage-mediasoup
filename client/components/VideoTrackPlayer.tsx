import React, {useEffect, useRef} from "react";
import {styled} from "baseui";

const Video = styled('video', {
    backgroundColor: 'black'
});

export default (props: {
    track: MediaStreamTrack
}) => {
    const videoRef = useRef<HTMLVideoElement>();

    useEffect(() => {
        if (props.track) {
            videoRef.current.srcObject = new MediaStream([props.track]);
            videoRef.current.play();
        } else {
            videoRef.current.srcObject = null;
        }
    }, [props.track]);

    return (
        <Video ref={videoRef} autoPlay={true} muted={true} playsInline={true}/>
    )
};

