import Redis from 'ioredis';
import logger from './logger';

let redisClient: Redis | null = null;

// Initialize Redis client if configured
if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL);
    logger.info('Redis connected for security score caching');
  } catch (error) {
    logger.error('Redis connection failed for security score cache', { error });
  }
}

const CACHE_PREFIX = 'security-score:';
const CACHE_TTL = 300; // 5 minutes in seconds

export const getSecurityScore = async (userId: string): Promise<number | null> => {
  if (!redisClient) return null;

  try {
    const score = await redisClient.get(`${CACHE_PREFIX}${userId}`);
    return score ? parseFloat(score) : null;
  } catch (error) {
    logger.error('Error fetching security score from cache', { error, userId });
    return null;
  }
};

export const setSecurityScore = async (userId: string, score: number): Promise<void> => {
  if (!redisClient) return;

  try {
    await redisClient.set(
      `${CACHE_PREFIX}${userId}`,
      score.toString(),
      'EX',
      CACHE_TTL
    );
  } catch (error) {
    logger.error('Error setting security score in cache', { error, userId });
  }
};

export const invalidateSecurityScore = async (userId: string): Promise<void> => {
  if (!redisClient) return;

  try {
    await redisClient.del(`${CACHE_PREFIX}${userId}`);
  } catch (error) {
    logger.error('Error invalidating security score cache', { error, userId });
  }
};

export const updateSecurityScoreTTL = async (userId: string): Promise<void> => {
  if (!redisClient) return;

  try {
    await redisClient.expire(`${CACHE_PREFIX}${userId}`, CACHE_TTL);
  } catch (error) {
    logger.error('Error updating security score TTL', { error, userId });
  }
};