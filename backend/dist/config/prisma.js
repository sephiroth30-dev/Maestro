"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.renewPrismaClient = renewPrismaClient;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const promise_1 = __importDefault(require("mysql2/promise"));
const logger_js_1 = require("./logger.js");
exports.pool = promise_1.default.createPool({
    uri: process.env['DATABASE_URL'] ?? '',
    dateStrings: true,
});
// No-op: mysql2 pool auto-reconnects — no Rust engine to renew
function renewPrismaClient() {
    logger_js_1.logger.info('DB pool auto-manages reconnection (mysql2 — no Rust engine)');
}
async function connectDatabase() {
    const conn = await exports.pool.getConnection();
    await conn.ping();
    conn.release();
    logger_js_1.logger.info('Database connected (mysql2 pool — no Rust engine)');
}
async function disconnectDatabase() {
    try {
        await exports.pool.end();
        logger_js_1.logger.info('Database disconnected');
    }
    catch {
        // ignore
    }
}
//# sourceMappingURL=prisma.js.map