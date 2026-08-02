import type { FastifyInstance } from 'fastify';
import { registerPacientesController } from '../controllers/pacientes.controller.js';

export async function registerPacientesRoutes(fastify: FastifyInstance): Promise<void> {
  await registerPacientesController(fastify);
}
