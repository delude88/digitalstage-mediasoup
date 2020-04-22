import SocketIO from "socket.io";

export default class WebRTCHandler {

    public initialize = async () => {
        console.log("Initialized WebRTCHandler");
    };

    public initializeSingleSocket = async (socket: SocketIO.Socket, room: string, uid: string) => {
        socket.broadcast.to(room).emit("p2p-peer-added", {
            uid: uid,
            socketId: socket.id
        });

        socket.on("p2p-make-offer", (data: {
            uid: string;
            socketId: string;
            targetSocketId: string;
            offer: RTCSessionDescriptionInit;
        }) => {
            socket.to(data.targetSocketId).emit("p2p-offer-made", {
                uid: uid,
                socketId: socket.id,
                offer: data.offer
            });
        });

        socket.on("p2p-make-answer", (data: {
            uid: string;
            socketId: string;
            targetSocketId: string;
            answer: RTCSessionDescriptionInit;
        }) => {
            socket.to(data.targetSocketId).emit("p2p-answer-made", {
                uid: uid,
                socketId: socket.id,
                answer: data.answer
            });
        });

        socket.on("p2p-send-candidate", (data) => {
            socket.to(data.targetSocketId).emit("p2p-candidate-sent", {
                uid: uid,
                socketId: socket.id,
                candidate: data.candidate
            });
        });
    };
}
