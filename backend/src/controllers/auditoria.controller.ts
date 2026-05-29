import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { auditoriaRepo } from '../repositories/auditoria.repo.js';

export async function auditoriaRoutes(fastify: FastifyInstance): Promise<void> {
  const guard = [requireAuth, requireRole('ADMIN', 'FACTURACION')] as const;

  // GET /api/auditoria
  fastify.get(
    '/api/auditoria',
    { preHandler: [...guard] },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const querySchema = z.object({
        page:      z.coerce.number().int().min(1).optional(),
        limit:     z.coerce.number().int().min(1).max(200).optional(),
        usuarioId: z.string().uuid().optional(),
        accion:    z.string().optional(),
        desde:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        hasta:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        await reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message ?? 'Parámetros inválidos',
          statusCode: 400,
        });
        return;
      }

      const { rows, total } = await auditoriaRepo.findMany(parsed.data);
      await reply.send({
        data:  rows,
        total,
        page:  parsed.data.page  ?? 1,
        limit: parsed.data.limit ?? 50,
      });
    }
  );

  // GET /api/auditoria/acciones — distinct action list for filter dropdown
  fastify.get(
    '/api/auditoria/acciones',
    { preHandler: [...guard] },
    async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const acciones = await auditoriaRepo.listAcciones();
      await reply.send(acciones);
    }
  );
}
