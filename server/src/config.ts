module.exports = {
    listenIp: "0.0.0.0",
    listenPort: 3001,
    sslCrt: "/etc/letsencrypt/live/www.thepanicure.de/fullchain.pem",
    sslKey: "/etc/letsencrypt/live/www.thepanicure.de/privkey.pem",
    mediasoup: {
        // Worker settings
        worker: {
            rtcMinPort: 40000,
            rtcMaxPort: 49999,
            logLevel: "warn",
            logTags: [
                "info",
                "ice",
                "dtls",
                "rtp",
                "srtp",
                "rtcp",
                // 'rtx',
                // 'bwe',
                // 'score',
                // 'simulcast',
                // 'svc'
            ],
        },
        // Router settings
        router: {
            mediaCodecs:
                [
                    {
                        kind: "audio",
                        mimeType: "audio/opus",
                        clockRate: 48000,
                        channels: 2
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/VP8',
                        clockRate: 90000,
                        parameters:
                            {
                                'x-google-start-bitrate': 1000
                            }
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/VP9',
                        clockRate: 90000,
                        parameters:
                            {
                                'profile-id': 2,
                                'x-google-start-bitrate': 1000
                            }
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/h264',
                        clockRate: 90000,
                        parameters:
                            {
                                'packetization-mode': 1,
                                'profile-level-id': '4d0032',
                                'level-asymmetry-allowed': 1,
                                'x-google-start-bitrate': 1000
                            }
                    },
                    {
                        kind: 'video',
                        mimeType: 'video/h264',
                        clockRate: 90000,
                        parameters:
                            {
                                'packetization-mode': 1,
                                'profile-level-id': '42e01f',
                                'level-asymmetry-allowed': 1,
                                'x-google-start-bitrate': 1000
                            }
                    }
                ]
        },
        // WebRtcTransport settings
        webRtcTransport: {
            listenIps: [
                {
                    ip: "167.172.168.55",
                    announcedIp: null,
                }
            ],
            maxIncomingBitrate: 1500000,
            initialAvailableOutgoingBitrate: 1000000,
            minimumAvailableOutgoingBitrate: 600000,
            maxSctpMessageSize: 262144
        }
    }
};
