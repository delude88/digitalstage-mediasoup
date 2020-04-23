import React, {Context, createContext, useCallback, useEffect, useState} from "react";
import DigitalStageConnection, {Participant, Stage} from "./api/DigitalStageConnection";
import firebase from "firebase/app";

interface StageContextProps {
    stage?: Stage;
    participants: Participant[],
    connect: (hostname: string, port: number) => Promise<void>,
    disconnect: () => Promise<void>,
    createStage: (user: firebase.User, name: string, password?: string, type?: 'theater' | 'music' | 'conference') => Promise<void>,
    joinStage: (user: firebase.User, stageId: string, password?: string) => Promise<void>
}

const StageContext: Context<StageContextProps> = createContext(undefined);


export const StageProvider = (props: {
    children: React.ReactNode
}) => {
    const [api] = useState<DigitalStageConnection>(new DigitalStageConnection());

    const connect = useCallback((hostname: string, port: number) => {
        return new Promise<void>((resolve, reject) => {
            if (api) {
                console.log("Connecting...");
                return api.connect({hostname, port});
            }
            console.log(api);
            reject("API not ready...")
        });
    }, [api]);

    const disconnect = useCallback(async () => {
        return new Promise<void>(resolve => {
            api.disconnect();
            resolve();
        });
    }, [api]);

    const createStage = useCallback(async (user: firebase.User, name: string, password?: string, type: 'theater' | 'music' | 'conference' = 'theater') => {
        if (api) {
            return api.createStage(user, name, password, type)
                .then((stage: Stage) => {
                    console.log("Created stage!");
                    setState(prevState => ({
                        ...prevState,
                        stage: stage
                    }));
                });
        }
    }, [api]);

    const joinStage = useCallback(async (user: firebase.User, stageId: string, password?: string) => {
        if (api) {
            return api.joinStage(user, stageId, password)
                .then((stage: Stage) => {
                    console.log("Joined stage!");
                    setState(prevState => ({
                        ...prevState,
                        stage: stage
                    }));
                });
        }
    }, [api]);
    const [state, setState] = useState<StageContextProps>({
        participants: [],
        connect: connect,
        disconnect: disconnect,
        createStage: createStage,
        joinStage: joinStage
    });
    return (
        <StageContext.Provider value={state}>
            {props.children}
        </StageContext.Provider>
    );
};

export const useStage = (): StageContextProps => React.useContext<StageContextProps>(StageContext);
export default useStage;
