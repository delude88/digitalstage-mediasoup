module.exports = {
    listenIp: "0.0.0.0",
    listenPort: 3001,
    sslCrt: "/etc/letsencrypt/csr/0000_csr-certbot.pem",
    sslKey: "/etc/letsencrypt/keys/0000_csr-certbot.pem",
    mediasoup: {
        // Worker settings
        worker: {
            rtcMinPort: 40000,
            rtcMaxPort: 40999,
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
                        kind: "video",
                        mimeType: "video/VP8",
                        clockRate: 90000,
                        parameters:
                            {
                                "x-google-start-bitrate": 1000
                            }
                    },
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
        }
    }
};
