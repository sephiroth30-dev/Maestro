import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/prisma.js';
import { buildApp } from './app.js';
import { initCron, stopCron } from './services/cron.service.js';
import { disconnectRedis } from './config/redis.js';

async function start(): Promise<void> {
  const fastify = await buildApp();

  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    process.exit(1);
  }

  try {
    await fastify.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
    logger.info(`Server running on port ${env.PORT}`, {
      environment: env.NODE_ENV,
      port: env.PORT,
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }

  // ─── Cron jobs ────────────────────────────────────────────────────────────
  await initCron();

  // ─── Graceful shutdown ────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down gracefully`);

    stopCron();

    try {
      await fastify.close();
      logger.info('HTTP server closed');
    } catch (error) {
      logger.error('Error closing HTTP server', { error });
    }

    try {
      await disconnectDatabase();
    } catch (error) {
      logger.error('Error disconnecting from database', { error });
    }

    try {
      await disconnectRedis();
    } catch (error) {
      logger.error('Error disconnecting from Redis', { error });
    }

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { reason });
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    process.exit(1);
  });
}

void start();
