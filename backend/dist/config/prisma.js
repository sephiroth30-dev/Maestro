"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.renewPrismaClient = renewPrismaClient;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
const promise_1 = require("mysql2/promise");
const logger_js_1 = require("./logger.js");
function makeClient() {
    return new client_1.PrismaClient({
        log: [
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
        ],
    });
}
// Mutable export — TypeScript CJS output updates exports.prisma on every reassignment,
// so all importers see the renewed instance after a panic recovery.
exports.prisma = makeClient();
// Called after a PrismaClientRustPanicError to get a fresh Tokio runtime.
function renewPrismaClient() {
    const old = exports.prisma;
    exports.prisma = makeClient();
    void old.$disconnect().catch(() => undefined);
    logger_js_1.logger.info('PrismaClient renewed');
}
// Startup connectivity check — uses mysql2 first (pure JS, no Rust) so Prisma's
// Tokio runtime is NOT touched during the fragile multi-process startup window.
// Once the mysql2 ping succeeds we know only one process is running, so we can
// safely warm up Prisma's connection pool via $connect().
async function connectDatabase() {
    const url = process.env['DATABASE_URL'] ?? '';
    const conn = await (0, promise_1.createConnection)(url);
    await conn.ping();
    await conn.end();
    logger_js_1.logger.info('Database ping OK (mysql2)');
    // Pre-warm Prisma pool so the first API request doesn't pay the connection cost.
    await exports.prisma.$connect();
    logger_js_1.logger.info('Prisma connection pool ready');
}
async function disconnectDatabase() {
    try {
        await exports.prisma.$disconnect();
        logger_js_1.logger.info('Database disconnected');
    }
    catch {
        // Ignore disconnect errors during shutdown
    }
}
//# sourceMappingURL=prisma.js.map