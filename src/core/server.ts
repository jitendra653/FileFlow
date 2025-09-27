import logger from '../utils/logger';
import { createServer } from 'http';
import initializeSocket from '../config/socket';
import { healthMonitor } from '../utils/healthMonitor';
import app from './app';
import { setupShutdown } from './shutdown';
import { connectDatabase, setupProcessHandlers } from './startup';

setupProcessHandlers();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
logger.level = process.env.LOG_LEVEL || 'info';
connectDatabase(process.env.MONGO_URI || 'mongodb://localhost:27017/rdx_project');

const httpServer = createServer(app);
initializeSocket(httpServer);
if (require.main === module) {
  const server = httpServer.listen(port, () => {
    logger.info(`Server running on port: ${port}`);
  });
  healthMonitor.on('alerts', (alerts) => {
    alerts.forEach(alert => {
      if (alert.type === 'critical') logger.error('Critical system alert:', alert);
      else logger.warn('System warning:', alert);
    });
  });
  setupShutdown(server);
}
