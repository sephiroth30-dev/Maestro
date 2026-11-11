import type { FastifyInstance } from 'fastify';
import { agendaRoutes } from '../controllers/agenda.controller.js';

export async function registerAgendaRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(agendaRoutes, { prefix: '/api' });
}
