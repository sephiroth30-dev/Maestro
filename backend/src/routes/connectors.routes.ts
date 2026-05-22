import type { FastifyInstance } from 'fastify';
import { connectorRoutes } from '../controllers/connectors.controller.js';

/**
 * Registers all connector routes under /api prefix.
 */
export async function registerConnectorRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(connectorRoutes, { prefix: '/api' });
}
