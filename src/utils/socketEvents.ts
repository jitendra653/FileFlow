import { Server as SocketServer } from 'socket.io';
import logger from './logger';

let io: SocketServer | null = null;

export const initSocketEvents = (socketServer: SocketServer) => {
  io = socketServer;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToAdmin = (event: string, data: any) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }
  io.to('admin').emit(event, data);
};

export const emitToAll = (event: string, data: any) => {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }
  io.emit(event, data);
};

// File Events
export const fileEvents = {
  UPLOAD_STARTED: 'file:upload:started',
  UPLOAD_PROGRESS: 'file:upload:progress',
  UPLOAD_COMPLETED: 'file:upload:completed',
  UPLOAD_FAILED: 'file:upload:failed',
  TRANSFORM_STARTED: 'file:transform:started',
  TRANSFORM_PROGRESS: 'file:transform:progress',
  TRANSFORM_COMPLETED: 'file:transform:completed',
  TRANSFORM_FAILED: 'file:transform:failed',
  DELETE: 'file:deleted',
};

// User Events
export const userEvents = {
  PROFILE_UPDATED: 'user:profile:updated',
  PLAN_UPDATED: 'user:plan:updated',
  QUOTA_WARNING: 'user:quota:warning',
  QUOTA_EXCEEDED: 'user:quota:exceeded',
};

// Admin Events
export const adminEvents = {
  USER_CREATED: 'admin:user:created',
  USER_UPDATED: 'admin:user:updated',
  USER_DELETED: 'admin:user:deleted',
  SYSTEM_ALERT: 'admin:system:alert',
  METRICS_UPDATE: 'admin:metrics:update',
};