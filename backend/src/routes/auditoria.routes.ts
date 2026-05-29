import type { FastifyInstance } from 'fastify';
import { auditoriaRoutes } from '../controllers/auditoria.controller.js';

export async function registerAuditoriaRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(auditoriaRoutes);
}
