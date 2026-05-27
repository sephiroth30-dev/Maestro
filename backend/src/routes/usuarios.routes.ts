import type { FastifyInstance } from 'fastify';
import { usuariosRoutes } from '../controllers/usuarios.controller.js';

export async function registerUsuariosRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(usuariosRoutes, { prefix: '/api' });
}
