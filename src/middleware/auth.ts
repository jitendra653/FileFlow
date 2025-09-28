import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';
import { createErrorResponse, ErrorType } from '../utils/errorResponse';
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

  let token: string | undefined;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.split(' ')[1];
  } else if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }

  if (!token) {
    logger.warn('No JWT found in Authorization header or cookie');
    return res.status(401).json(createErrorResponse({
      code: 'AUTH_TOKEN_MISSING',
      message: 'Authentication token missing',
      type: ErrorType.AUTHENTICATION
    }));
  }

  try {
    logger.debug('Attempting to verify token', { tokenLength: token.length });
    const payload = jwt.verify(token, JWT_SECRET!);
    logger.debug('Token verified successfully');
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      logger.warn('Token has expired', { error: err.message });
      return res.status(401).json(createErrorResponse({
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
        type: ErrorType.AUTHENTICATION
      }));
    } else if (err.name === 'JsonWebTokenError') {
      logger.warn('Invalid token signature', { error: err.message });
      return res.status(401).json(createErrorResponse({
        code: 'TOKEN_SIGNATURE_INVALID',
        message: 'Invalid token signature',
        type: ErrorType.AUTHENTICATION
      }));
    } else if (err.name === 'NotBeforeError') {
      logger.warn('Token not yet valid', { error: err.message });
      return res.status(401).json(createErrorResponse({
        code: 'TOKEN_NOT_YET_VALID',
        message: 'Token not yet valid',
        type: ErrorType.AUTHENTICATION
      }));
    }
    logger.error('Unexpected token verification error', { error: err.message, errorType: err.name });
    return res.status(401).json(createErrorResponse({
      code: 'TOKEN_INVALID',
      message: 'Invalid token',
      type: ErrorType.AUTHENTICATION
    }));
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
  return res.status(401).json(createErrorResponse({
    code: 'AUTH_TOKEN_INVALID',
    message: 'Invalid authentication token',
  type: ErrorType.AUTHENTICATION
  }));
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
  return res.status(404).json(createErrorResponse({
    code: 'USER_NOT_FOUND',
    message: 'User not found in the system',
  type: ErrorType.NOT_FOUND
  }));
    }
    const today = new Date();
    const endpoint = req.baseUrl + req.path;

    // Check if we need to reset the counter (new month)
  // Defensive: ensure quota properties exist
  // Defensive: ensure quota properties exist (cast to any to avoid TS error)
  const quota: any = user.quota;
  if (!quota.lastResetDate) quota.lastResetDate = new Date();
  if (!quota.apiUsageHistory) quota.apiUsageHistory = [];
  const lastReset = new Date(quota.lastResetDate);
    if (lastReset.getMonth() !== today.getMonth() || lastReset.getFullYear() !== today.getFullYear()) {
      quota.apiCallsMade = 0;
      quota.lastResetDate = today;
      if (!quota.apiUsageHistory) {
        quota.apiUsageHistory = [];
      }
    }

    // Check quota limit
    if (quota.apiCallsMade >= quota.apiCallLimit) {
      const resetDate = new Date(quota.lastResetDate);
      resetDate.setMonth(resetDate.getMonth() + 1);
      return res.status(403).json(createErrorResponse({
        code: 'API_QUOTA_EXCEEDED',
        message: `API call quota exceeded. Limit: ${quota.apiCallLimit}, Used: ${quota.apiCallsMade}.`,
  type: ErrorType.RATE_LIMIT,
        details: [
          { code: 'NEXT_RESET', message: 'Next quota reset', value: resetDate },
          { code: 'UPGRADE_URL', message: 'Upgrade URL', value: '/upgrade-plan' },
          { code: 'CURRENT_PLAN', message: 'Current plan', value: user.plan }
        ]
      }));
    }

    // Update API usage tracking
  quota.apiCallsMade += 1;
    
    // Track endpoint usage
    const todayStr = today.toISOString().split('T')[0];
    const usageIndex = quota.apiUsageHistory.findIndex(
      (h: any) => h.date.toISOString().split('T')[0] === todayStr
    );

    if (usageIndex === -1) {
      // New day, create new record
      quota.apiUsageHistory.push({
        date: today,
        calls: 1,
        endpoints: new Map([[endpoint, 1]])
      });
    } else {
      // Update existing record
      quota.apiUsageHistory[usageIndex].calls += 1;
      const currentEndpoints = quota.apiUsageHistory[usageIndex].endpoints;
      currentEndpoints.set(endpoint, (currentEndpoints.get(endpoint) || 0) + 1);
    }

    // Keep only last 30 days of history
    if (quota.apiUsageHistory.length > 30) {
      quota.apiUsageHistory = quota.apiUsageHistory.slice(-30);
    }

    await user.save();
    
    // Add enhanced quota information to response headers
    res.set({
      'X-RateLimit-Limit': quota.apiCallLimit.toString(),
      'X-RateLimit-Remaining': (quota.apiCallLimit - quota.apiCallsMade).toString(),
      'X-RateLimit-Used': quota.apiCallsMade.toString(),
      'X-RateLimit-Reset': new Date(quota.lastResetDate).toISOString(),
      'X-Plan-Type': user.plan
    });
    
    next();
  } catch (err) {
    logger.error('Error enforcing API quota', { 
      error: err.message,
      userId: req.user?.id,
      endpoint: req.baseUrl + req.path 
    });
  res.status(500).json(createErrorResponse({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  type: ErrorType.SERVER_ERROR
  }));
  }
}
