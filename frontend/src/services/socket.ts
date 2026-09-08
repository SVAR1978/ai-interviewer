import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

let socket: Socket | null = null;

export const getInterviewSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: false,
    });
  }
  return socket;
};

export const disconnectInterviewSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
