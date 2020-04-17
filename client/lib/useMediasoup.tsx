import {useCallback, useEffect, useState} from "react";
import * as mediasoup from 'mediasoup-client';


const useMediasoup = () => {
    const [device, setDevice] = useState<mediasoup.Device>();

    useEffect(() => {
        try {
            const device = new mediasoup.Device();
            setDevice(device);
        } catch (e) {
            if (e.name === 'UnsupportedError') {
                console.error('browser not supported for video calls');
                return;
            } else {
                console.error(e);
            }
        }
    }, []);

    const joinRoom = useCallback((roomName: string) => {

    }, [device]);


    return {
        joinRoom
    };
};

export default useMediasoup;
