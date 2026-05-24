"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_js_1 = require("./config/env.js");
const logger_js_1 = require("./config/logger.js");
const prisma_js_1 = require("./config/prisma.js");
const app_js_1 = require("./app.js");
const cron_service_js_1 = require("./services/cron.service.js");
const redis_js_1 = require("./config/redis.js");
const migrations_service_js_1 = require("./services/migrations.service.js");
// Earliest possible log — antes de cualquier inicialización
console.log('[BOOT] index.ts loaded, Node', process.version, 'PORT env:', process.env.PORT);
// ─── Crash handlers ───────────────────────────────────────────────────────────
// Intercept Prisma Rust panics BEFORE they become a process.exit(1).
// A panic means the Tokio runtime inside the library engine died; we renew the
// client so the next request gets a fresh runtime, and we skip the exit.
function isPrismaRustPanic(err) {
    if (!(err instanceof Error))
        return false;
    return (err.constructor.name === 'PrismaClientRustPanicError' ||
        err.message.includes('PANIC') ||
        err.message.includes('timer has gone away'));
}
process.on('unhandledRejection', (reason) => {
    if (isPrismaRustPanic(reason)) {
        logger_js_1.logger.warn('Prisma Rust panic (unhandledRejection) — renewing client', {
            error: reason instanceof Error ? reason.message : String(reason),
        });
        (0, prisma_js_1.renewPrismaClient)();
        return; // Do NOT exit — server keeps running
    }
    // console.error is synchronous — guarantees the message is flushed before exit
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    console.error('[FATAL] Unhandled rejection:', msg);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    if (isPrismaRustPanic(error)) {
        logger_js_1.logger.warn('Prisma Rust panic (uncaughtException) — renewing client', {
            error: error.message,
        });
        (0, prisma_js_1.renewPrismaClient)();
        return; // Do NOT exit
    }
    console.error('[FATAL] Uncaught exception:', error.stack ?? error.message);
    process.exit(1);
});
// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
    const fastify = await (0, app_js_1.buildApp)();
    // ── 1. Bind HTTP server FIRST ─────────────────────────────────────────────
    // Hostinger's watchdog expects a bound port within a few seconds of process
    // start. If we wait for the DB first, the watchdog spawns a second process,
    // both race on $connect(), Tokio timer panics, and the crash loop begins.
    // Binding first ensures only one process is ever running before any DB work.
    console.log(`[BOOT] Starting HTTP server on 0.0.0.0:${env_js_1.env.PORT}...`);
    try {
        await fastify.listen({ port: env_js_1.env.PORT, host: '0.0.0.0' });
        console.log(`[BOOT] HTTP server listening on port ${env_js_1.env.PORT}`);
        logger_js_1.logger.info(`Server running on port ${env_js_1.env.PORT}`, {
            environment: env_js_1.env.NODE_ENV,
            port: env_js_1.env.PORT,
        });
    }
    catch (error) {
        logger_js_1.logger.error('Failed to start HTTP server', { error });
        process.exit(1);
    }
    // ── 2. Connect to DB + init cron in background — never crashes the server ──
    // Cron runs AFTER DB is confirmed ready so conectoresRepo.findAllActive()
    // doesn't trigger a cold Prisma connection on the first API request.
    const dbUrl = (process.env.DATABASE_URL ?? 'NOT SET').replace(/:([^:@]+)@/, ':***@');
    console.log('[BOOT] DATABASE_URL:', dbUrl);
    void connectInBackground();
    // ── 3. Graceful shutdown ──────────────────────────────────────────────────
    const shutdown = async (signal) => {
        logger_js_1.logger.info(`${signal} received — shutting down gracefully`);
        (0, cron_service_js_1.stopCron)();
        try {
            await fastify.close();
            logger_js_1.logger.info('HTTP server closed');
        }
        catch (error) {
            logger_js_1.logger.error('Error closing HTTP server', { error });
        }
        try {
            await (0, prisma_js_1.disconnectDatabase)();
        }
        catch (error) {
            logger_js_1.logger.error('Error disconnecting from database', { error });
        }
        try {
            await (0, redis_js_1.disconnectRedis)();
        }
        catch (error) {
            logger_js_1.logger.error('Error disconnecting from Redis', { error });
        }
        logger_js_1.logger.info('Shutdown complete');
        process.exit(0);
    };
    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
    process.on('SIGINT', () => { void shutdown('SIGINT'); });
}
// Connects to the DB with exponential backoff (max 30 s between attempts).
// Renews the Prisma client on Rust panics so the engine recovers in-process.
// Once the DB is ready, schedules cron jobs (non-fatal).
async function connectInBackground() {
    let attempt = 0;
    let delay = 2_000;
    while (true) {
        attempt++;
        try {
            console.log(`[DB] Connect attempt ${attempt}...`);
            await (0, prisma_js_1.connectDatabase)();
            console.log('[DB] Connected successfully');
            // Apply entity catalog migration (idempotent — safe to run every startup).
            await (0, migrations_service_js_1.runEntityMigration)();
            // Schedule cron jobs only after the pool is warm — avoids a cold
            // Prisma lazy-connect on the very first API request.
            try {
                await (0, cron_service_js_1.initCron)();
            }
            catch (cronErr) {
                logger_js_1.logger.warn('Cron init failed (non-fatal)', {
                    error: cronErr instanceof Error ? cronErr.message : String(cronErr),
                });
            }
            return;
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (isPrismaRustPanic(error)) {
                logger_js_1.logger.warn('[DB] Rust panic during connect — renewing client and retrying', { attempt, msg });
                (0, prisma_js_1.renewPrismaClient)();
            }
            else {
                logger_js_1.logger.warn('[DB] Connect failed — retrying', { attempt, delayMs: delay, msg });
            }
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(Math.round(delay * 1.5), 30_000);
        }
    }
}
void start();
//# sourceMappingURL=index.js.map