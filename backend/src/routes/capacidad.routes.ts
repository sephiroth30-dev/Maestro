import type { FastifyInstance } from 'fastify';
import { capacidadRoutes } from '../controllers/capacidad.controller.js';

export async function registerCapacidadRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(capacidadRoutes, { prefix: '/api' });
}
