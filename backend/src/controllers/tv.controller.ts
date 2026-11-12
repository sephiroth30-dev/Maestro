import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { obtenerEstadoTv } from '../services/tv.service.js';

// Los mismos roles que ven los reportes. ADMISIONES NO: su acceso está limitado al mes
// en curso y a otras restricciones que este resumen (con el presupuesto y la proyección) no respeta.
const TV_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA'] as const;

export async function tvRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/tv/estado — todo lo que muestra la pantalla de TV, en una sola lectura.
  fastify.get('/tv/estado', { preHandler: [requireAuth, requireRole(...TV_ROLES)] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send(await obtenerEstadoTv());
  });
}
