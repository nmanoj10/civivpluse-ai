import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const connectSocket = (token: string): Socket => {
  if (socket) {
    if (socket.connected) return socket;
    socket.connect();
    return socket;
  }

  // Connect to backend server — using relative URL so it proxies correctly in Vite dev server (or fallback to port 6000)
  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true
  });

  socket.on('connect', () => {
    console.log('Socket.IO successfully connected to server');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket.IO connection error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = (): Socket | null => {
  return socket;
};
