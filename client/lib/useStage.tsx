import {useCallback, useEffect, useState} from "react";
import DigitalStageConnection, {Participant, Stage} from "./api/DigitalStageConnection";

export default () => {
    const [connection, setConnection] = useState<DigitalStageConnection>();
    const [stage, setStage] = useState<Stage>();
    const [participants, setParticipants] = useState<Participant[]>([]);

    useEffect(() => {
        setConnection(new DigitalStageConnection());
    }, []);

    const connect = useCallback((hostname: string, port: number) => {
        connection.connect({hostname, port})
            .then(() => {
                console.log("connected");
            })
    }, [connection]);

    const createStage = useCallback(() => {
    }, [connection]);

    const joinStage = useCallback(() => {
    }, [connection]);

    return {
        connect,
        createStage,
        joinStage,
        stage,
        participants
    };
};
