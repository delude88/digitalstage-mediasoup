import React, {useEffect, useState} from "react";
import {Slider} from "baseui/slider";
import {Checkbox} from "baseui/checkbox";
import {AudioContext, IAudioNode, IGainNode, IMediaStreamTrackAudioSourceNode} from 'standardized-audio-context';
import {IAudioContext} from "standardized-audio-context/build/es2019/interfaces";

interface AudioTrack {
    id: string;
    mediaStreamTrack: MediaStreamTrack;
    gainNode: IGainNode<IAudioContext>;
    volume: number;
    muted: boolean;
}

export default (props: {
    mediaStreamTracks: MediaStreamTrack[];
    onStreamAvailable?: (stream: MediaStream) => void;
    audioContext: IAudioContext;
    targets: IAudioNode<IAudioContext>[];
}) => {
    const [audioContext, setAudioContext] = useState<AudioContext>(props.audioContext);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

    useEffect(() => {
        if (!audioContext) {
            const audioContext = new AudioContext();
            setAudioContext(audioContext);
        }
    }, []);

    useEffect(() => {
        const currentAudioTrack: AudioTrack[] = audioTracks.filter((audioTrack: AudioTrack) => props.mediaStreamTracks.find((mediaStreamTrack: MediaStreamTrack) => mediaStreamTrack.id === audioTrack.id));
        props.mediaStreamTracks.forEach(
            (mediaStreamTrack: MediaStreamTrack) => {
                let audioTrack: AudioTrack | undefined = currentAudioTrack.find((audioTrack: AudioTrack) => audioTrack.id === mediaStreamTrack.id);
                if (!audioTrack) {
                    const gainNode: IGainNode<IAudioContext> = props.audioContext.createGain();
                    const stream: IMediaStreamTrackAudioSourceNode<IAudioContext> = props.audioContext.createMediaStreamTrackSource(mediaStreamTrack);
                    stream.connect(gainNode);
                    props.targets.forEach(
                        (target: IAudioNode<IAudioContext>) => gainNode.connect(target)
                    );
                    currentAudioTrack.push({
                        id: mediaStreamTrack.id,
                        mediaStreamTrack: mediaStreamTrack,
                        gainNode: gainNode,
                        volume: gainNode.gain.value,
                        muted: true
                    });
                }
            }
        );
        setAudioTracks(currentAudioTrack);
    }, [props.mediaStreamTracks]);

    const muteAudioTrack = (id: string, muted: boolean) => {
        setAudioTracks(
            prev => prev.map((audioTrack: AudioTrack) => {
                if (audioTrack.id === id) {
                    audioTrack.muted = muted;
                    if (audioTrack.muted) {
                        audioTrack.gainNode.gain.setValueAtTime(0, props.audioContext.currentTime);
                    } else {
                        audioTrack.gainNode.gain.setValueAtTime(audioTrack.volume, props.audioContext.currentTime);
                    }
                }
                return audioTrack;
            })
        )
    };

    const changeAudioTrackVolume = (id: string, volume: number) => {
        setAudioTracks(
            prev => prev.map((audioTrack: AudioTrack) => {
                if (audioTrack.id === id) {
                    audioTrack.volume = volume;
                    if (audioTrack.muted) {
                        audioTrack.gainNode.gain.setValueAtTime(0, props.audioContext.currentTime);
                    } else {
                        audioTrack.gainNode.gain.setValueAtTime(volume, props.audioContext.currentTime);
                    }
                }
                return audioTrack;
            })
        )
    };

    return (
        <div>
            {audioTracks.map((audioTrack: AudioTrack) => (
                <div>
                    Audiotrack: {audioTrack.id}
                    <Checkbox checked={audioTrack.muted}
                              onChange={(e) => muteAudioTrack(audioTrack.id, e.currentTarget.checked)}>
                        Mute
                    </Checkbox>
                    <Slider value={[audioTrack.volume]}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(s) => changeAudioTrackVolume(audioTrack.id, s.value[0])}/>
                </div>
            ))}
        </div>
    )
};
