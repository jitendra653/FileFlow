import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from '../middleware/errorHandler';
import mainRouter from '../routes/index';
import { configureSession, validateSession } from '../config/session';
import logger from '../utils/logger';
import '../jobs/checkUserPlans';
import '../jobs/resetApiQuota';
import 'newrelic';
import { systemPerformanceHandler } from './systemPerformance';
import contactRouter from '../contact';
import { metricsMiddleware, metricsRoute } from './metrics';
import cookieParser from 'cookie-parser';

dotenv.config({ path: '.env' });

const app = express();

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/rdx_project';
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));
app.use(express.static('public'));
app.use(express.json());
app.use(cookieParser());

const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: 'FileFlow.sid',
  mongoUrl: MONGO,
  ttl: 24 * 60 * 60, // 24 hours
  maxInactivity: 30 * 60 // 30 minutes
};
app.use(configureSession(sessionConfig));
app.use(validateSession);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(metricsMiddleware);

app.get('/system/performance', systemPerformanceHandler);
app.use(contactRouter);
app.use('/', mainRouter);
app.use('/metrics', metricsRoute);

app.use(errorHandler);

export default app;
