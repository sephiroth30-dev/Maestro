import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { capacidadRepo } from '../repositories/capacidad.repo.js';
import { auditoriaRepo, ACCION } from '../repositories/auditoria.repo.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

// ─── Roles ────────────────────────────────────────────────────────────────────

const READ_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const upsertSchema = z.object({
  grupo:     z.string().min(1).max(50),
  nombre:    z.string().min(1).max(150),
  anio:      z.number().int().min(2020).max(2100),
  mesIdx:    z.number().int().min(1).max(12),
  capacidad: z.number().int().min(0).max(32767),
  recursos:  z.string().max(5000).nullable().optional(),
});

const bulkSchema = z.object({
  rows: z.array(upsertSchema).min(1).max(200),
});

// ─── Controller ───────────────────────────────────────────────────────────────

export async function capacidadRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/capacidad?anio=2026
  fastify.get(
    '/capacidad',
    { preHandler: [requireAuth, requireRole(...READ_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string>;
      const anio = parseInt(query.anio ?? '', 10);
      if (!anio || isNaN(anio)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Se requiere el parámetro anio', statusCode: 400 });
      }
      const rows = await capacidadRepo.findByAnio(anio);
      return reply.send(rows);
    }
  );

  // GET /api/capacidad/utilizacion?anio=2026&mes_idx=1
  fastify.get(
    '/capacidad/utilizacion',
    { preHandler: [requireAuth, requireRole(...READ_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string>;
      const anio   = parseInt(query.anio ?? '', 10);
      const mesIdx = parseInt(query.mes_idx ?? '', 10);
      if (!anio || isNaN(anio) || !mesIdx || isNaN(mesIdx) || mesIdx < 1 || mesIdx > 12) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Se requieren los parámetros anio y mes_idx (1-12)', statusCode: 400 });
      }
      const rows = await capacidadRepo.getUtilizacion(anio, mesIdx);
      return reply.send(rows);
    }
  );

  // POST /api/capacidad — upsert single row
  fastify.post(
    '/capacidad',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = upsertSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }
      const row = await capacidadRepo.upsert(parsed.data);
      void auditoriaRepo.insert({
        usuarioId: request.authenticatedUser.id,
        accion: ACCION.CAPACIDAD_CONFIGURADA,
        entidadTipo: 'capacidad_instalada',
        entidadId: row.id,
        ip: request.ip,
        detalle: { grupo: parsed.data.grupo, anio: parsed.data.anio, mesIdx: parsed.data.mesIdx, capacidad: parsed.data.capacidad },
      }).catch(() => {});
      return reply.status(201).send(row);
    }
  );

  // POST /api/capacidad/bulk — upsert multiple rows
  fastify.post(
    '/capacidad/bulk',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = bulkSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }
      const results = await Promise.all(parsed.data.rows.map((r) => capacidadRepo.upsert(r)));
      void auditoriaRepo.insert({
        usuarioId: request.authenticatedUser.id,
        accion: ACCION.CAPACIDAD_CONFIGURADA,
        entidadTipo: 'capacidad_instalada',
        entidadId: null,
        ip: request.ip,
        detalle: { count: results.length, grupos: parsed.data.rows.map((r) => r.grupo) },
      }).catch(() => {});
      return reply.status(201).send(results);
    }
  );

  // DELETE /api/capacidad/:grupo/:anio/:mesIdx
  fastify.delete(
    '/capacidad/:grupo/:anio/:mesIdx',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { grupo: string; anio: string; mesIdx: string };
      const anio   = parseInt(params.anio, 10);
      const mesIdx = parseInt(params.mesIdx, 10);
      if (isNaN(anio) || isNaN(mesIdx) || mesIdx < 1 || mesIdx > 12) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Parámetros de ruta inválidos', statusCode: 400 });
      }
      await capacidadRepo.deleteOne(params.grupo, anio, mesIdx);
      void auditoriaRepo.insert({
        usuarioId: request.authenticatedUser.id,
        accion: ACCION.CAPACIDAD_ELIMINADA,
        entidadTipo: 'capacidad_instalada',
        entidadId: null,
        ip: request.ip,
        detalle: { grupo: params.grupo, anio, mesIdx },
      }).catch(() => {});
      return reply.status(200).send({ ok: true });
    }
  );
}
