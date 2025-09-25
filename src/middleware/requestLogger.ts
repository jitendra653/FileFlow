import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

// Create a write stream (in append mode) for logging to a file
const logStream = fs.createWriteStream(path.join(__dirname, '../../logs/access.log'), { flags: 'a' });

// Configure morgan to log requests with method, URL, status, and response time
const requestLogger = morgan(':method :url :status :res[content-length] - :response-time ms', {
  stream: logStream,
});

export default requestLogger;
