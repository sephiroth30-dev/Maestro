import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase, renewPrismaClient } from './config/prisma.js';
import { buildApp } from './app.js';
import { initCron, stopCron } from './services/cron.service.js';
import { disconnectRedis } from './config/redis.js';
import { autoSeedEntidades } from './services/entity-seed.service.js';
import { runSchemaMigrations } from './services/schema-migrations.service.js';

// Earliest possible log — antes de cualquier inicialización
console.log('[BOOT] index.ts loaded, Node', process.version, 'PORT env:', process.env.PORT);

// ─── Crash handlers ───────────────────────────────────────────────────────────
// Intercept Prisma Rust panics BEFORE they become a process.exit(1).
// A panic means the Tokio runtime inside the library engine died; we renew the
// client so the next request gets a fresh runtime, and we skip the exit.

function isPrismaRustPanic(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.constructor.name === 'PrismaClientRustPanicError' ||
    err.message.includes('PANIC') ||
    err.message.includes('timer has gone away')
  );
}

process.on('unhandledRejection', (reason) => {
  if (isPrismaRustPanic(reason)) {
    logger.warn('Prisma Rust panic (unhandledRejection) — renewing client', {
      error: reason instanceof Error ? reason.message : String(reason),
    });
    renewPrismaClient();
    return; // Do NOT exit — server keeps running
  }
  // console.error is synchronous — guarantees the message is flushed before exit
  const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  console.error('[FATAL] Unhandled rejection:', msg);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  if (isPrismaRustPanic(error)) {
    logger.warn('Prisma Rust panic (uncaughtException) — renewing client', {
      error: error.message,
    });
    renewPrismaClient();
    return; // Do NOT exit
  }
  console.error('[FATAL] Uncaught exception:', error.stack ?? error.message);
  process.exit(1);
});

// ─── Startup ──────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  const fastify = await buildApp();

  // ── 1. Bind HTTP server FIRST ─────────────────────────────────────────────
  // Hostinger's watchdog expects a bound port within a few seconds of process
  // start. If we wait for the DB first, the watchdog spawns a second process,
  // both race on $connect(), Tokio timer panics, and the crash loop begins.
  // Binding first ensures only one process is ever running before any DB work.
  console.log(`[BOOT] Starting HTTP server on 0.0.0.0:${env.PORT}...`);
  try {
    await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    console.log(`[BOOT] HTTP server listening on port ${env.PORT}`);
    logger.info(`Server running on port ${env.PORT}`, {
      environment: env.NODE_ENV,
      port: env.PORT,
    });
  } catch (error) {
    logger.error('Failed to start HTTP server', { error });
    process.exit(1);
  }

  // ── 2. Connect to DB + init cron in background — never crashes the server ──
  // Cron runs AFTER DB is confirmed ready so conectoresRepo.findAllActive()
  // doesn't trigger a cold Prisma connection on the first API request.
  const dbUrl = (process.env.DATABASE_URL ?? 'NOT SET').replace(/:([^:@]+)@/, ':***@');
  console.log('[BOOT] DATABASE_URL:', dbUrl);
  void connectInBackground();

  // ── 3. Graceful shutdown ──────────────────────────────────────────────────
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
}

// Connects to the DB with exponential backoff (max 30 s between attempts).
// Renews the Prisma client on Rust panics so the engine recovers in-process.
// Once the DB is ready, schedules cron jobs (non-fatal).
async function connectInBackground(): Promise<void> {
  let attempt = 0;
  let delay = 2_000;

  while (true) {
    attempt++;
    try {
      console.log(`[DB] Connect attempt ${attempt}...`);
      await connectDatabase();
      console.log('[DB] Connected successfully');
      // Run schema migrations (idempotent) before seeding entities
      try {
        await runSchemaMigrations();
      } catch (migrationErr) {
        logger.warn('Schema migrations failed (non-fatal)', {
          error: migrationErr instanceof Error ? migrationErr.message : String(migrationErr),
        });
      }
      // Sync entity catalog on every startup so deploys automatically pick up new entities
      try {
        await autoSeedEntidades();
      } catch (seedErr) {
        logger.warn('Entity seed failed (non-fatal)', {
          error: seedErr instanceof Error ? seedErr.message : String(seedErr),
        });
      }
      // Schedule cron jobs only after the pool is warm — avoids a cold
      // Prisma lazy-connect on the very first API request.
      try {
        await initCron();
      } catch (cronErr) {
        logger.warn('Cron init failed (non-fatal)', {
          error: cronErr instanceof Error ? cronErr.message : String(cronErr),
        });
      }
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (isPrismaRustPanic(error)) {
        logger.warn('[DB] Rust panic during connect — renewing client and retrying', { attempt, msg });
        renewPrismaClient();
      } else {
        logger.warn('[DB] Connect failed — retrying', { attempt, delayMs: delay, msg });
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(Math.round(delay * 1.5), 30_000);
    }
  }
}

void start();
