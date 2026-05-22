import Redis from 'ioredis';
import { logger } from './logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient) return redisClient;

  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: (times: number) => {
      if (times >= 3) {
        logger.warn('Redis connection failed after 3 retries — cache will be disabled');
        return null;
      }
      return Math.min(times * 200, 1000);
    },
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected');
  });

  redisClient.on('error', (err: Error) => {
    logger.warn('Redis error', { message: err.message });
  });

  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected');
  }
}
