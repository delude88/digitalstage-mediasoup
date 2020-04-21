import React from "react";
import {Select} from "baseui/select";

export default (props: {
    valid: boolean;
    audioDevice?: number,
    availableAudioDevices: {
        [id: number]: string
    },
    onChange: (id: number) => void
}) => {
    return <Select error={!props.valid}
                   options={Object.entries(props.availableAudioDevices).map(([id, value]) => ({id: id, label: value}))}
                   value={props.audioDevice && [{
                       id: props.audioDevice
                   }]}
                   onChange={(e: any) => props.onChange(e.value[0].id)}/>
};
