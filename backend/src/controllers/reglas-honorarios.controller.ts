import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import {
  findAllReglas, upsertRegla, deleteRegla,
  findAllReglasEspeciales, updateReglaEspecial,
} from '../repositories/reglas-honorarios.repo.js';

type PutBody = {
  profesional_nombre: string;
  categoria: string;
  tipo: 'fijo' | 'pct';
  valor_entidad: number;
  valor_particular: number;
  notas?: string | null;
};

type IdParam = { id: string };

type PatchBody = { valor: number; descripcion?: string | null };

export async function registerReglasHonorariosRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/reglas-honorarios — lista completa de reglas estándar + especiales
  fastify.get(
    '/api/reglas-honorarios',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_req: FastifyRequest, reply: FastifyReply) => {
      const [reglas, especiales] = await Promise.all([
        findAllReglas(),
        findAllReglasEspeciales(),
      ]);
      return reply.send({ reglas, especiales });
    }
  );

  // PUT /api/reglas-honorarios — crear o actualizar una regla estándar
  fastify.put<{ Body: PutBody }>(
    '/api/reglas-honorarios',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request, reply: FastifyReply) => {
      const { profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas } = request.body;
      if (!profesional_nombre || !categoria || !tipo) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Faltan campos requeridos', statusCode: 400 });
      }
      await upsertRegla(profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas ?? null);
      const reglas = await findAllReglas();
      return reply.send({ reglas });
    }
  );

  // DELETE /api/reglas-honorarios/:id — desactivar una regla
  fastify.delete<{ Params: IdParam }>(
    '/api/reglas-honorarios/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request, reply: FastifyReply) => {
      await deleteRegla(request.params.id);
      return reply.status(204).send();
    }
  );

  // PATCH /api/reglas-honorarios/especiales/:id — actualizar valor de regla especial
  fastify.patch<{ Params: IdParam; Body: PatchBody }>(
    '/api/reglas-honorarios/especiales/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request, reply: FastifyReply) => {
      const { valor, descripcion } = request.body;
      await updateReglaEspecial(request.params.id, valor, descripcion ?? null);
      const especiales = await findAllReglasEspeciales();
      return reply.send({ especiales });
    }
  );
}
