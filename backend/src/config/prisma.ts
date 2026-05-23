import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(retries = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      logger.info('Database connected successfully');
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt < retries) {
        logger.warn(`DB connect attempt ${attempt}/${retries} failed — retrying in ${delayMs}ms`, { message });
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2;
      } else {
        logger.error('Failed to connect to database after all retries', { error });
        throw error;
      }
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
