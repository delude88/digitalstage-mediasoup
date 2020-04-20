import React from "react";
import {OnChangeParams, Select, Value} from "baseui/select";

interface Option {
    id: string;
    label: string;
}

export default (props: {
    options: Option[];
    placeholder?: string;
    initialValue?: Option;
    onChange: (option: Option) => void
}) => {
    const [value, setValue] = React.useState<Value>([]);


    return <Select
        value={value}
        onChange={(params: OnChangeParams) => {
            setValue(params.value);
            props.onChange(params.value[0] as Option);
        }}
        options={props.options}
    />

}
