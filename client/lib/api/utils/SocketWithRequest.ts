export interface SocketWithRequest extends SocketIOClient.Socket {
    request: (type: string, data?: any) => Promise<any>
}

export const extend = (socket: SocketIOClient.Socket): SocketWithRequest => {
    const extendedSocket = socket as SocketWithRequest;
    extendedSocket.request = (type: string, data: any = {}): Promise<any> => {
        return new Promise(resolve => {
            socket.emit(type, data, resolve)
        })
    };
    return extendedSocket;
};

