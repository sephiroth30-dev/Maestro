import mysql from 'mysql2/promise';
import { logger } from './logger.js';

export const pool = mysql.createPool({
  uri: process.env['DATABASE_URL'] ?? '',
  dateStrings: true,
});

// No-op: mysql2 pool auto-reconnects — no Rust engine to renew
export function renewPrismaClient(): void {
  logger.info('DB pool auto-manages reconnection (mysql2 — no Rust engine)');
}

export async function connectDatabase(): Promise<void> {
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  logger.info('Database connected (mysql2 pool — no Rust engine)');
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database disconnected');
  } catch {
    // ignore
  }
}
