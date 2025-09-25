import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { apm } from '../utils/apm';
import { initSocketEvents } from '../utils/socketEvents';

export default function initializeSocket(server: Server) {
  const io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
    },
    allowEIO3: true,
    transports: ['websocket', 'polling']
  });

  // Initialize socket events manager
  initSocketEvents(io);

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      socket.data.user = decoded;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  // Handle connection
  io.on('connection', (socket) => {
    const userId = socket.data.user?.id;
    logger.info(`User connected to WebSocket: ${userId}`);

    // Record connection event in APM
    apm.instrumentWebSocket('connection', {
      userId,
      userRole: socket.data.user?.role,
      socketId: socket.id
    });

    // Join user-specific room for private updates
    socket.join(`user:${userId}`);

    // Join admin room if user is admin
    if (socket.data.user?.role === 'admin') {
      socket.join('admin');
      apm.recordCustomEvent({
        eventType: 'AdminConnection',
        attributes: {
          userId,
          socketId: socket.id,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Monitor events
    socket.onAny((eventName, ...args) => {
      apm.instrumentWebSocket('event', {
        eventName,
        userId,
        socketId: socket.id,
        args: JSON.stringify(args)
      });
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected from WebSocket: ${userId}`);
      apm.instrumentWebSocket('disconnect', {
        userId,
        socketId: socket.id,
        duration: Date.now() - socket.handshake.issued
      });
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error('Socket error:', error);
      apm.noticeError(error instanceof Error ? error : new Error(String(error)), {
        userId,
        socketId: socket.id
      });
    });
  });

  return io;
}