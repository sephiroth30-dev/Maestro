import { PrismaClient } from '@prisma/client';
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

// Lightweight ping — uses lazy connection instead of explicit $connect().
// Avoids the race condition where two processes call $connect() simultaneously.
export async function connectDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  logger.info('Database ping OK');
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch {
    // Ignore disconnect errors during shutdown
  }
}
