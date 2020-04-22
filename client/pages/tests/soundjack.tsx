import useSoundjack from "../../lib/useSoundjack";
import React from "react";
import {Button} from "baseui/button";
import AudioDeviceSelector from "../../components/soundjack/AudioDeviceSelector";
import {FormControl} from "baseui/form-control";
import {Slider} from "baseui/slider";

export default () => {
    const {available, ready, connected, audioDevices, settings, startStream, stopStream, streams, setFrameSize, setBufferSize, setOutputDevice, setInputDevice} = useSoundjack();

    if (!connected) {
        return (
            <div>
                <Button disabled={!ready || !available} isLoading={!ready} >Enable</Button>
            </div>
        );
    }

    return (
        <div>
            <FormControl
                label="Input device">
                <AudioDeviceSelector
                    valid={settings && settings.valid}
                    onChange={audioDevice => setInputDevice(audioDevice)}
                    audioDevice={settings && settings.inputAudioDevice}
                    availableAudioDevices={audioDevices}/>
            </FormControl>
            <FormControl
                label="Output device">
                <AudioDeviceSelector
                    valid={settings && settings.valid}
                    onChange={audioDevice => setOutputDevice(audioDevice)}
                    audioDevice={settings && settings.outputAudioDevice}
                    availableAudioDevices={audioDevices}/>
            </FormControl>
            <FormControl
                label="Samplebuffer">
                <Slider disabled={!settings.outputAudioDevice || !settings.inputAudioDevice}
                        value={[settings.frameSize]} onChange={(e) => setFrameSize(e.value[0])}
                        max={512}
                        min={64}
                        step={64}/>
            </FormControl>
            <FormControl
                label="Networkbuffer">
                <Slider value={[settings.bufferSize]} onChange={(e) => setBufferSize(e.value[0])}
                        max={512}
                        min={128}
                        step={64}/>
            </FormControl>
            <Button onClick={() => startStream("127.0.0.1", 50000)}>Start</Button>
            <ul>
                {Object.keys(streams).map((id: string) => (
                    <li>{id} {streams[id].latency} <Button onClick={() => stopStream(id)}
                                                           disabled={streams[id].status === "disconnecting"}
                                                           isLoading={streams[id].status === "disconnecting"}>STOP</Button>
                    </li>
                ))}
            </ul>
        </div>
    )
}
