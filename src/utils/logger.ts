import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Get environment information
const environmentInfo = {
  nodeEnv: process.env.NODE_ENV || 'development',
  nodeVersion: process.version,
  platform: process.platform,
  hostname: os.hostname(),
  cpus: os.cpus().length,
  memory: Math.floor(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
  startTime: new Date().toISOString()
};

// Custom format for metadata enrichment
const enrichMetadata = winston.format((info) => {
  info.environment = environmentInfo;
  info.timestamp = new Date().toISOString();
  
  // Add process information
  info.process = {
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };

  // Clean and structure error objects
  if (info instanceof Error || (info.error && info.error instanceof Error)) {
    const error = (info.error || info) as Error & { code?: string; details?: unknown };
    info.error = {
      name: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      code: error.code,
      details: error.details
    };
  }

  return info;
});

// Define log format
const logFormat = winston.format.combine(
  enrichMetadata(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info: any) => {
    // Format the base log message
    let log = `${info.timestamp} [${info.level}] ${info.message}`;

    // Add request context if available
    if (info.requestId) {
      log = `${log} [ReqID: ${info.requestId}]`;
    }
    if (info.traceId) {
      log = `${log} [TraceID: ${info.traceId}]`;
    }

    // Add performance timing if available
    if (info.duration) {
      log = `${log} [Duration: ${info.duration}ms]`;
    }

    // Add error details
    if (info.error) {
      const { name, code, message: errMessage } = info.error;
      log = `${log}\nError: ${name}${code ? ` (${code})` : ''} - ${errMessage}`;
      if (info.error.stack && process.env.NODE_ENV !== 'production') {
        log = `${log}\nStack: ${info.error.stack}`;
      }
    }

    // Add remaining metadata as JSON
    const metaWithoutBasic = { ...info };
    delete metaWithoutBasic.requestId;
    delete metaWithoutBasic.traceId;
    delete metaWithoutBasic.duration;
    delete metaWithoutBasic.error;

    if (Object.keys(metaWithoutBasic).length > 0) {
      log += `\nContext: ${JSON.stringify(metaWithoutBasic, null, 2)}`;
    }

    return log;
  })
);

// Create custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf((info: any) => {
    let log = `${info.timestamp} ${info.level}: ${info.message}`;
    
    // Add request context
    if (info.requestId || info.traceId) {
      log += ' |';
      if (info.requestId) log += ` ReqID:${info.requestId}`;
      if (info.traceId) log += ` TraceID:${info.traceId}`;
    }

    // Add error information
    if (info.error) {
      log += `\n  Error: ${info.error.name}`;
      if (info.error.code) log += ` (${info.error.code})`;
      log += ` - ${info.error.message}`;
      if (info.error.stack && process.env.NODE_ENV !== 'production') {
        log += `\n  Stack: ${info.error.stack}`;
      }
    }

    // Add performance metrics
    if (info.duration) {
      log += `\n  Duration: ${info.duration}ms`;
    }

    return log;
  })
);

// Configure the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      format: consoleFormat
    }),

    // Application logs - Contains all log levels
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info'
    }),

    // Error logs - Contains only error and higher
    new DailyRotateFile({
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    }),

    // Debug logs - Contains debug and higher (non-production only)
    ...(process.env.NODE_ENV !== 'production' ? [
      new DailyRotateFile({
        dirname: 'logs',
        filename: 'debug-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '7d',
        level: 'debug'
      })
    ] : [])
  ]
});

// Add performance monitoring
logger.on('error', (error) => {
  console.error('Logger internal error:', error);
});

// Export logger with type safety
export default logger;

// Export helper functions for consistent logging
export const logWithContext = (level: string, message: string, context: Record<string, unknown> = {}) => {
  logger.log(level, message, context);
};

export const logWithRequestContext = (
  level: string,
  message: string,
  requestId: string,
  traceId?: string,
  context: Record<string, unknown> = {}
) => {
  logger.log(level, message, {
    ...context,
    requestId,
    traceId
  });
};
