import type { FastifyInstance } from 'fastify';
import { registerReportesController } from '../controllers/reportes.controller.js';

export async function registerReportesRoutes(fastify: FastifyInstance): Promise<void> {
  await registerReportesController(fastify);
}
