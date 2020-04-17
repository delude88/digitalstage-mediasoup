import React, {useEffect, useRef} from "react";
import {styled} from "baseui";

const Video = styled('video', {
    backgroundColor: 'black'
});

export default (props: {
    stream: MediaStream
}) => {
    const videoRef = useRef<HTMLVideoElement>();

    useEffect(() => {
        videoRef.current.srcObject = props.stream;
    }, [props.stream]);

    return (
        <Video ref={videoRef} autoPlay={true} muted={true} playsInline={true}/>
    )
};

