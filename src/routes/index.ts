import express from 'express';
import { Router } from 'express';

import authRouter from './auth';
import adminSecurityDashboardRouter from './adminSecurityDashboard';
import filesRouter from './files';
import adminRouter from './admin';
import adminFilesRouter from './adminFiles';
import userProfileRouter from './userProfile';
import docsRouter from './docs';
import transformRouter from './transform';
import uploadRouter from './upload';
import userPlanRouter from './userPlan';
import analyticsRouter from './analytics';
import healthRouter from './health';
import twoFactorAuthRouter from './twoFactorAuth';
import sessionRouter from './sessions';

// Middleware imports
import requestLogger from '../middleware/requestLogger';
import { errorHandler } from '../middleware/errorHandler';
import requestTrace from '../middleware/requestTrace';
import { rateLimiter, strictRateLimiter, apiRateLimiter } from '../middleware/rateLimiter';
import { enforceApiQuota, requireAuth } from '../middleware/auth';
import { ipWhitelist } from '../middleware/ipWhitelist';
import { require2FA } from '../middleware/require2FA';

const router = express.Router();

// API Version prefix
const API_VERSION = '/v1';


// Create route groups
const publicRoutes = Router();
const authRoutes = Router();
const userRoutes = Router();
const adminRoutes = Router();
const fileRoutes = Router();

// Apply base middleware to all routes
router.use(requestTrace);
router.use(requestLogger);
router.use(rateLimiter); // Default rate limiter for unspecified routes

/**
 * Public Routes
 * No authentication required, basic rate limiting
 */
publicRoutes.use('/docs', docsRouter);

/**
 * Authentication Routes
 * Strict rate limiting to prevent brute force
 */
publicRoutes.use('/auth', strictRateLimiter, authRouter);

/**
 * User Routes
 * Requires user authentication, API rate limiting
 */
userRoutes.use('/profile', requireAuth, enforceApiQuota, userProfileRouter);
userRoutes.use('/plan', requireAuth, enforceApiQuota, userPlanRouter);

/**
 * Admin Routes
 * Requires admin authentication, strict rate limiting
 */
adminRoutes.use('/', requireAuth, enforceApiQuota, ipWhitelist, require2FA, adminRouter);
adminRoutes.use('/files', requireAuth, enforceApiQuota, ipWhitelist, require2FA, adminFilesRouter);
adminRoutes.use('/security', requireAuth, enforceApiQuota, ipWhitelist, require2FA, adminSecurityDashboardRouter);

/**
 * File Operation Routes
 * Requires user authentication, API rate limiting
 * Higher limits for file operations
 */
fileRoutes.use('/files', requireAuth, enforceApiQuota, filesRouter);
fileRoutes.use('/transform', requireAuth, enforceApiQuota, transformRouter);
fileRoutes.use('/upload', requireAuth, enforceApiQuota, uploadRouter);

// Mount route groups with version prefix and rate limits
router.use(`${API_VERSION}`, publicRoutes); // Basic rate limiting
router.use(`${API_VERSION}/auth`, strictRateLimiter, authRoutes); // Strict rate limiting for auth
router.use(`${API_VERSION}/analytics`, apiRateLimiter, requireAuth, enforceApiQuota, analyticsRouter); // Analytics routes with auth
router.use(`${API_VERSION}/health`, strictRateLimiter, healthRouter); // Health monitoring routes
router.use(`${API_VERSION}`, apiRateLimiter, userRoutes); // API rate limiting for user routes
router.use(`${API_VERSION}`, apiRateLimiter, fileRoutes); // API rate limiting for file operations
router.use(`${API_VERSION}/admin`, strictRateLimiter, adminRoutes); // Strict rate limiting for admin routes
router.use(`${API_VERSION}/2fa`, apiRateLimiter, requireAuth, twoFactorAuthRouter); // 2FA management routes
router.use(`${API_VERSION}/sessions`, apiRateLimiter, requireAuth, sessionRouter); // Session management routes

/**
 * Health check endpoint
// Mount route groups with version prefix and rate limits
router.use(`${API_VERSION}`, publicRoutes); // Basic rate limiting
router.use(`${API_VERSION}/auth`, strictRateLimiter, authRoutes); // Strict rate limiting for auth
router.use(`${API_VERSION}`, apiRateLimiter, userRoutes); // API rate limiting for user routes
router.use(`${API_VERSION}`, apiRateLimiter, fileRoutes); // API rate limiting for file operations
router.use(`${API_VERSION}/admin`, strictRateLimiter, adminRoutes); // Strict rate limiting for admin routes

// Mount Swagger UI
router.use('/api-docs', swaggerRouter); // API Documentation

/**
 * Health check endpoint
 * No rate limiting applied
 */
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString()
  });
});

import client from 'prom-client';

/**
 * Metrics endpoint
 * No rate limiting, available for monitoring systems
 */
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Apply error handler last
router.use(errorHandler);

export default router;
