export const p2pConfiguration: RTCConfiguration = {
    iceServers: [
        {
            urls: ["stun:u3.xirsys.com"]
        }, {
            username: "A9V03PuTW8N9A3K8aEFra1taQjecR5LHlhW9DrjvZj1SvoGtMyhkj3XJLrYzAQpdAAAAAF6IzZ10b2JpYXM=",
            credential: "95ddd1a4-769f-11ea-a962-bea250b72c66",
            urls: [
                "turn:u3.xirsys.com:80?transport=udp",
                "turn:u3.xirsys.com:3478?transport=udp",
                "turn:u3.xirsys.com:80?transport=tcp",
                "turn:u3.xirsys.com:3478?transport=tcp",
                "turns:u3.xirsys.com:443?transport=tcp",
                "turns:u3.xirsys.com:5349?transport=tcp"
            ]
        }/*
        {
            urls: [
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302'
            ]
        },/*
        {
            urls: 'turn:v22019048220387295.hotsrv.de:3478',
            username: ' digitalstage',
            credential: 'digitalstage'
        },
        {
            urls: 'turn:numb.viagenie.ca',
            username: ' tobias.hegemann@googlemail.com',
            credential: 'SE6q6nA5kSiKk4Z'
        }/*,
        {
            urls: 'turn:numb.viagenie.ca',
            username: ' tobias.hegemann@googlemail.com',
            credential: 'SE6q6nA5kSiKk4Z'
        }*/
    ],
    iceCandidatePoolSize: 10,
};
