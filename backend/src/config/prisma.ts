import { PrismaClient } from '@prisma/client';
import { createConnection } from 'mysql2/promise';
import { logger } from './logger.js';

function makeClient(): PrismaClient {
  return new PrismaClient({
    log: [
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  });
}

// Mutable export — TypeScript CJS output updates exports.prisma on every reassignment,
// so all importers see the renewed instance after a panic recovery.
export let prisma: PrismaClient = makeClient();

// Called after a PrismaClientRustPanicError to get a fresh Tokio runtime.
export function renewPrismaClient(): void {
  const old = prisma;
  prisma = makeClient();
  void old.$disconnect().catch(() => undefined);
  logger.info('PrismaClient renewed');
}

// Startup connectivity check — uses mysql2 (pure JS, no Rust) so Prisma's
// Tokio runtime is NOT touched during the fragile multi-process startup window.
// Prisma lazy-connects on the first API query, well after only one process is running.
export async function connectDatabase(): Promise<void> {
  const url = process.env['DATABASE_URL'] ?? '';
  const conn = await createConnection(url);
  await conn.ping();
  await conn.end();
  logger.info('Database ping OK (mysql2)');
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch {
    // Ignore disconnect errors during shutdown
  }
}
