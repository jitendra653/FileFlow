import { body, validationResult } from 'express-validator';
import Contact from './models/contact';
import nodemailer from 'nodemailer';
import axios from 'axios';
import os from 'os';
import child_process from 'child_process';

import session from 'express-session';

import path from 'path';
import ejs from 'ejs';
// Log all uncaught exceptions and unhandled promise rejections
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
import 'newrelic';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import logger from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import client from 'prom-client';
import './jobs/checkUserPlans';
import './jobs/resetApiQuota';
import mainRouter from './routes/index';
import { createServer } from 'http';
import initializeSocket from './config/socket';
import { apm } from './utils/apm';
import { healthMonitor } from './utils/healthMonitor';
import { configureSession, validateSession, SessionManager } from './config/session';

// Explicitly load the .env file
dotenv.config({ path: '.env' });
// dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });

const app = express();

// Use only the MongoDB-backed session for all routes
// Remove duplicate session middleware for EJS admin panel
const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/rdx_project';

// Configure CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
// Public system performance dashboard route (advanced)
app.get('/system/performance', async (req, res) => {
  const cpus = os.cpus();
  const cpuInfo = cpus.map((cpu, i) => ({
    model: cpu.model,
    speed: cpu.speed,
    user: cpu.times.user,
    sys: cpu.times.sys,
    idle: cpu.times.idle,
    nice: cpu.times.nice,
    irq: cpu.times.irq
  }));

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

  const uptime = `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`;
  const loadAverage = os.loadavg().map(n => n.toFixed(2)).join(', ');
  const platform = os.platform();
  const arch = os.arch();
  const hostname = os.hostname();
  const processCount = os.cpus().length;
  const nodeVersion = process.version;
  const lastUpdated = new Date().toLocaleString();

  // Disk usage (Linux/macOS only, fallback for Windows)
  let diskUsage = 'N/A';
  try {
    if (process.platform !== 'win32') {
      const df = child_process.execSync('df -h /').toString();
      const lines = df.split('\n');
      if (lines[1]) {
        const parts = lines[1].split(/\s+/);
        diskUsage = `${parts[2]} used / ${parts[1]} (${parts[4]})`;
      }
    } else {
      diskUsage = 'Disk usage not available on Windows';
    }
  } catch (e) {
    diskUsage = 'Error fetching disk usage';
  }

  // Network stats (show first interface with IPv4)
  const nets = os.networkInterfaces();
  let netInfo = 'N/A';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        netInfo = `${name}: ${net.address}`;
        break;
      }
    }
    if (netInfo !== 'N/A') break;
  }

  // API service health checks with dynamic login
  const apiEndpoints = [
    { name: 'Health', url: '/health' },
    { name: 'Security Scores', url: '/v1/admin/security/scores' },
    { name: 'Sessions', url: '/v1/admin/security/sessions' },
    { name: 'Blocked IPs', url: '/v1/admin/security/blocked-ips' },
    { name: 'Threats', url: '/v1/admin/security/threats' }
  ];
  const apiStatus = {};
  let token = null;
  try {
    // Login to get a fresh token
    const loginResp = await axios.post(
      `http://localhost:${port || 3000}/v1/auth/login`,
      {
        email: 'jitendrapatidar653@gmail.com',
        password: 'Admin@12345'
      },
      { timeout: 2000 }
    );
    token = loginResp.data && (loginResp.data.token || loginResp.data.accessToken);
  } catch (e) {
    // If login fails, mark all as DOWN
    apiEndpoints.forEach(api => { apiStatus[api.name] = 'DOWN (Login Failed)'; });
  }
  if (token) {
    for (const api of apiEndpoints) {
      try {
        const resp = await axios.get(api.url, {
          baseURL: `http://localhost:${port || 3000}`,
          timeout: 2000,
          headers: { Authorization: `Bearer ${token}` }
        });
        apiStatus[api.name] = resp.status === 200 ? 'UP' : 'DOWN';
      } catch (e) {
        apiStatus[api.name] = 'DOWN';
      }
    }
  }

  res.render('systemPerformance', {
    cpuUsage: (os.loadavg()[0] / os.cpus().length * 100).toFixed(2),
    cpuInfo,
    memoryUsage: (usedMem / 1024 / 1024).toFixed(0),
    memoryUsagePercent,
    freeMemory: (freeMem / 1024 / 1024).toFixed(0),
    totalMemory: (totalMem / 1024 / 1024).toFixed(0),
    uptime,
    loadAverage,
    platform,
    arch,
    hostname,
    processCount,
    nodeVersion,
    diskUsage,
    netInfo,
    lastUpdated,
    apiStatus
  });
});


// Contact form route
app.get('/contact', (req, res) => {
  res.render('contactus', { success: null, error: null });
});

app.post('/contact',
  [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('message').notEmpty().withMessage('Message is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('contactus', {
        success: null,
        error: errors.array().map(e => e.msg).join(', ')
      });
    }
    try {
      // Save to DB
      const contact = new Contact({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        subject: req.body.subject,
        message: req.body.message
      });
      await contact.save();

      // Send email to admin
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || 'youradminemail@gmail.com',
          pass: process.env.SMTP_PASS || 'yourpassword'
        }
      });
      const mailOptions = {
        from: req.body.email,
        to: process.env.ADMIN_EMAIL || 'youradminemail@gmail.com',
        subject: `Contact Form: ${req.body.subject}`,
        text: `Name: ${req.body.firstName} ${req.body.lastName}\nEmail: ${req.body.email}\nSubject: ${req.body.subject}\nMessage: ${req.body.message}`
      };
      await transporter.sendMail(mailOptions);

      res.render('contactus', {
        success: 'Your message has been sent successfully!',
        error: null
      });
    } catch (err) {
      logger.error('Contact form error', { error: err });
      res.render('contactus', {
        success: null,
        error: 'Failed to send message. Please try again later.'
      });
    }
  }
);



// Serve static files from the public directory
app.use(express.static('public'));
app.use(express.json());

// Configure session middleware
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: 'FileFlow.sid',
  mongoUrl: MONGO,
  ttl: 24 * 60 * 60, // 24 hours
  maxInactivity: 30 * 60 // 30 minutes
};

app.use(configureSession(sessionConfig));
app.use(validateSession);

// Add APM middleware
// import { apmMiddleware } from './middleware/apmMiddleware';
// app.use(apmMiddleware);
// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Add request metrics middleware before routes
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationInSeconds = seconds + nanoseconds / 1e9;

    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.url, res.statusCode.toString())
      .observe(durationInSeconds);
    
    requestCounter
      .labels(req.method, req.route?.path || req.url, res.statusCode.toString())
      .inc();

    if (res.statusCode >= 200 && res.statusCode < 300) {
      successCounter.labels(req.method, req.route?.path || req.url).inc();
    } else if (res.statusCode >= 400) {
      failureCounter.labels(req.method, req.route?.path || req.url).inc();
    }
  });
  next();
});

// Initialize main application router
app.use('/', mainRouter);

// Initialize Prometheus metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 1.5],
});

const requestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

const successCounter = new client.Counter({
  name: 'http_requests_success_total',
  help: 'Total number of successful HTTP requests',
  labelNames: ['method', 'route'],
});

const failureCounter = new client.Counter({
  name: 'http_requests_failure_total',
  help: 'Total number of failed HTTP requests',
  labelNames: ['method', 'route'],
});

app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationInSeconds = seconds + nanoseconds / 1e9;

    httpRequestDurationMicroseconds.labels(req.method, req.route?.path || req.url, res.statusCode.toString()).observe(durationInSeconds);
    requestCounter.labels(req.method, req.route?.path || req.url, res.statusCode.toString()).inc();

    if (res.statusCode >= 200 && res.statusCode < 300) {
      successCounter.labels(req.method, req.route?.path || req.url).inc();
    } else if (res.statusCode >= 400) {
      failureCounter.labels(req.method, req.route?.path || req.url).inc();
    }
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// centralized error handler
app.use(errorHandler);

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const logLevel = process.env.LOG_LEVEL || 'info';
logger.level = logLevel;

logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
logger.info(`Server running on port: ${port}`);
// logger.info(`MongoDB URI: ${MONGO}`);
logger.info(`Log level: ${logLevel}`);

mongoose.connect(MONGO).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.warn('MongoDB connection failed, continuing without DB:', err.message || err);
});

const httpServer = createServer(app);
const io = initializeSocket(httpServer);
logger.info('WebSocket server initialized');

const server = httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  logger.info('WebSocket server initialized');
});

// Initialize health monitoring
healthMonitor.on('alerts', (alerts) => {
  alerts.forEach(alert => {
    if (alert.type === 'critical') {
      logger.error('Critical system alert:', alert);
      // Here you could add notification logic (email, SMS, etc.)
    } else {
      logger.warn('System warning:', alert);
    }
  });
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down...`);

  // Stop health monitoring
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

export { app };
