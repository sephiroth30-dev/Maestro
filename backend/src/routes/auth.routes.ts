import type { FastifyInstance } from 'fastify';
import { authRoutes } from '../controllers/auth.controller.js';

/**
 * Registers all authentication routes under /api prefix.
 * Actual route definitions live in auth.controller.ts so the
 * controller file stays the single source of truth for paths.
 */
export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(authRoutes, { prefix: '/api' });
}
