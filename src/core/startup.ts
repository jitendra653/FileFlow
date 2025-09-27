import mongoose from 'mongoose';
import logger from '../utils/logger';

export function connectDatabase(MONGO: string) {
  mongoose.connect(MONGO).then(() => {
    console.log('Connected to MongoDB');
  }).catch(err => {
    console.warn('MongoDB connection failed, continuing without DB:', err.message || err);
  });
}

export function setupProcessHandlers() {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
      message: err && err.message ? err.message : String(err),
      stack: err && err.stack ? err.stack : undefined,
      error: err
    });
  });
  process.on('unhandledRejection', (reason) => {
    let message = '';
    let stack = undefined;
    if (reason && typeof reason === 'object' && 'message' in reason) {
      message = (reason as any).message;
      stack = (reason as any).stack;
    } else {
      message = JSON.stringify(reason);
    }
    logger.error('Unhandled Rejection', {
      message,
      stack,
      reason
    });
  });
}
