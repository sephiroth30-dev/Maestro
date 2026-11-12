import type { FastifyInstance } from 'fastify';
import { tvRoutes } from '../controllers/tv.controller.js';

export async function registerTvRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(tvRoutes, { prefix: '/api' });
}
