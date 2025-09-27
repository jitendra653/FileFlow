import logger from '../utils/logger';
import mongoose from 'mongoose';
import { healthMonitor } from '../utils/healthMonitor';

export function setupShutdown(server: any) {
  function shutdown(signal: string) {
    logger.info(`Received ${signal}, shutting down...`);
    healthMonitor.stop();
    logger.info('Health monitoring stopped');
    server.close(() => {
      logger.info('HTTP server closed');
      mongoose.connection.close(false).then(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
      }).catch(err => {
        logger.error('Error closing MongoDB connection', { error: err });
        process.exit(1);
      });
    });
    setTimeout(() => {
      logger.warn('Forcing shutdown');
      process.exit(1);
    }, 10000).unref();
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
