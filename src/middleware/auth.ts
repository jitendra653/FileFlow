import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { createErrorResponse } from '../utils/errorResponse';
import UserModel from '../models/user';
import dotenv from 'dotenv';


// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  logger.error('JWT_SECRET is not defined in environment variables');
  throw new Error('JWT_SECRET must be defined');
}

// Array of public paths (exact and prefix)
const PUBLIC_PATHS = [
  '/v1/files/preview',
  '/v1/plan/execute-payment',
  '/v1/plan/cancel-payment',
  '/v1/plan/webhook/paypal',
  '/v1/plan/cancel-payment'
];

function isPublicPath(path: string, originalUrl: string) {
  return PUBLIC_PATHS.some(
    publicPath => path === publicPath || originalUrl.startsWith(publicPath)
  );
}

export interface AuthRequest extends Request {
  user?: any;
  userId?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  // Skip authentication for public endpoints
  if (isPublicPath(req.path, req.originalUrl)) {
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth) {
    logger.warn('Authorization header missing');
    return res.status(401).json(createErrorResponse('Missing authorization header'));
  }

  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn('Malformed authorization header', { header: auth });
    return res.status(401).json(createErrorResponse('Malformed authorization header'));
  }

  const token = parts[1];
  try {
    logger.debug('Attempting to verify token', { tokenLength: token.length });
    const payload = jwt.verify(token, JWT_SECRET!);
    logger.debug('Token verified successfully');
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Token has expired', { error: err.message });
      return res.status(401).json(createErrorResponse('Token has expired'));
    } else if (err.name === 'JsonWebTokenError') {
      logger.warn('Invalid token signature', { error: err.message });
      return res.status(401).json(createErrorResponse('Invalid token signature'));
    } else if (err.name === 'NotBeforeError') {
      logger.warn('Token not yet valid', { error: err.message });
      return res.status(401).json(createErrorResponse('Token not yet valid'));
    }
    logger.error('Unexpected token verification error', { error: err.message, errorType: err.name });
    return res.status(401).json(createErrorResponse('Invalid token'));
  }
}

export async function enforceApiQuota(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Skip quota enforcement for public endpoints
    if (isPublicPath(req.path, req.originalUrl)) {
      return next();
    }

    // Check all possible ID fields from the JWT token
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    logger.debug('Enforcing API quota', { 
      userId,
      tokenUser: req.user,
      path: req.path
    });

    if (!userId) {
      logger.error('No user ID found in token', { user: req.user });
      return res.status(401).json(createErrorResponse('Invalid authentication token'));
    }

    // Try to find user by either _id or userId
    const user = await UserModel.findOne({ _id: userId });

    if (!user) {
      logger.error('User not found in database', { 
        userId,
        searchCriteria: [
          { _id: userId },
          { userId: Number(userId) }
        ]
      });
      return res.status(404).json(createErrorResponse('User not found in the system'));
    }
    const today = new Date();
    const endpoint = req.baseUrl + req.path;

    // Check if we need to reset the counter (new month)
    const lastReset = new Date(user.quota.lastResetDate);
    if (lastReset.getMonth() !== today.getMonth() || lastReset.getFullYear() !== today.getFullYear()) {
      user.quota.apiCallsMade = 0;
      user.quota.lastResetDate = today;
      if (!user.quota.apiUsageHistory) {
        user.quota.apiUsageHistory = [];
      }
    }

    // Check quota limit
    if (user.quota.apiCallsMade >= user.quota.apiCallLimit) {
      const resetDate = new Date(user.quota.lastResetDate);
      resetDate.setMonth(resetDate.getMonth() + 1);
      return res.status(403).json(createErrorResponse({
        message: `API call quota exceeded. Limit: ${user.quota.apiCallLimit}, Used: ${user.quota.apiCallsMade}.`,
        nextReset: resetDate,
        upgradeUrl: '/upgrade-plan',
        currentPlan: user.plan
      }));
    }

    // Update API usage tracking
    user.quota.apiCallsMade += 1;
    
    // Track endpoint usage
    const todayStr = today.toISOString().split('T')[0];
    const usageIndex = user.quota.apiUsageHistory.findIndex(
      h => h.date.toISOString().split('T')[0] === todayStr
    );

    if (usageIndex === -1) {
      // New day, create new record
      user.quota.apiUsageHistory.push({
        date: today,
        calls: 1,
        endpoints: new Map([[endpoint, 1]])
      });
    } else {
      // Update existing record
      user.quota.apiUsageHistory[usageIndex].calls += 1;
      const currentEndpoints = user.quota.apiUsageHistory[usageIndex].endpoints;
      currentEndpoints.set(endpoint, (currentEndpoints.get(endpoint) || 0) + 1);
    }

    // Keep only last 30 days of history
    if (user.quota.apiUsageHistory.length > 30) {
      user.quota.apiUsageHistory = user.quota.apiUsageHistory.slice(-30);
    }

    await user.save();
    
    // Add enhanced quota information to response headers
    res.set({
      'X-RateLimit-Limit': user.quota.apiCallLimit.toString(),
      'X-RateLimit-Remaining': (user.quota.apiCallLimit - user.quota.apiCallsMade).toString(),
      'X-RateLimit-Used': user.quota.apiCallsMade.toString(),
      'X-RateLimit-Reset': new Date(user.quota.lastResetDate).toISOString(),
      'X-Plan-Type': user.plan
    });
    
    next();
  } catch (err) {
    logger.error('Error enforcing API quota', { 
      error: err.message,
      userId: req.user?.id,
      endpoint: req.baseUrl + req.path 
    });
    res.status(500).json(createErrorResponse('Internal server error'));
  }
}
