import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = (token: string) => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
  });

  socket.on('connect_error', (error: Error) => {
    console.error('WebSocket connection error:', error);
  });

  socket.on('disconnect', (reason: string) => {
    console.log('Disconnected from WebSocket server:', reason);
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const subscribe = (event: string, callback: (data: any) => void) => {
  if (!socket) {
    console.warn('Socket not initialized');
    return;
  }
  socket.on(event, callback);
};

export const unsubscribe = (event: string, callback: (data: any) => void) => {
  if (!socket) {
    return;
  }
  socket.off(event, callback);
};

export const emit = (event: string, data: any) => {
  if (!socket) {
    console.warn('Socket not initialized');
    return;
  }
  socket.emit(event, data);
};