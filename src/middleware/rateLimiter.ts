import { calculateDynamicRateLimit } from '../config/securityScores';
import { IUser } from '../models/user';
import { getSecurityScore } from '../utils/securityScoreCache';
import client from 'prom-client';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { Request, Response } from 'express';
import { calculateDynamicRateLimit } from '../config/securityScores';
import { User } from '../models/user';

// Initialize metrics
const dynamicRateLimitGauge = new client.Gauge({
  name: 'rate_limiter_dynamic_limit',
  help: 'Current rate limit value based on security score',
  labelNames: ['user_id', 'security_tier']
});

const securityScoreGauge = new client.Gauge({
  name: 'user_security_score',
  help: 'Current security score for users',
  labelNames: ['user_id']
});

const throttledRequestsCounter = new client.Counter({
  name: 'rate_limiter_throttled_requests_total',
  help: 'Total number of throttled requests',
  labelNames: ['path', 'method', 'ip']
});

// Initialize Redis client if configured
let redisClient: Redis | null = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL);
    logger.info('Redis connected for rate limiting');
  } catch (error) {
    logger.error('Redis connection failed', { error });
  }
}

// Create store based on Redis availability
const store = redisClient
  ? new RedisStore({
      // @ts-ignore - Type mismatch in RedisStore options but works at runtime
      sendCommand: (...args: any[]) => redisClient!.call(...args),
      prefix: 'rate-limit:'
    })
  : undefined; // Falls back to memory store if Redis is not available

// Create different rate limiters for different use cases
export const createRateLimiter = (options: {
  windowMs?: number;
  max?: number;
  path?: string;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  useDynamicLimit?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // Default: 15 minutes
    max: options.useDynamicLimit 
      ? async (req: Request) => {
          const user = req.user as IUser | undefined;
          if (!user?.id) return options.max || 100;
          
          // Try to get security score from cache first
          const cachedScore = await getSecurityScore(user.id);
          const score = cachedScore ?? user.securityScore ?? 60; // Default score of 60 if not found
          
          return calculateDynamicRateLimit(options.max || 100, score);
        }
      : options.max || 100, // Default: 100 requests per window
    store, // Use Redis store if available
    skipFailedRequests: options.skipFailedRequests || false,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use X-Forwarded-For header if behind proxy, otherwise use IP
      const ip = req.headers['x-forwarded-for'] || req.ip;
      return `${ip}:${options.path || req.path}`;
    }),
    handler: async (req: Request, res: Response) => {
      const user = req.user as IUser | undefined;
      
      // Record metrics if user is authenticated
      if (user?.id) {
        const cachedScore = await getSecurityScore(user.id);
        const score = cachedScore ?? user.securityScore ?? 60;
        const tier = getSecurityTier(score);
        
        // Update metrics
        securityScoreGauge.set({ user_id: user.id }, score);
        dynamicRateLimitGauge.set(
          { user_id: user.id, security_tier: tier.name },
          calculateDynamicRateLimit(options.max || 100, score)
        );
      }
      
      // Increment throttled requests counter with labels
      throttledRequestsCounter.inc({
        path: options.path || req.path,
        method: req.method,
        ip: req.ip
      });

      // Log rate limit exceeded
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: req.headers
      });

      res.status(429).json({
        error: {
          message: 'Too many requests, please try again later',
          type: 'RATE_LIMIT_EXCEEDED',
          retryAfter: res.getHeader('Retry-After')
        }
      });
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks and metrics
      return req.path === '/health' || req.path === '/metrics';
    }
  });
};

// Default rate limiter
export const rateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  useDynamicLimit: true // Enable dynamic rate limiting
});

// Strict rate limiter for sensitive endpoints
export const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes
  skipFailedRequests: true // Don't count failed requests
});

// API rate limiter
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300 // 300 requests per 15 minutes
});

export default rateLimiter;
