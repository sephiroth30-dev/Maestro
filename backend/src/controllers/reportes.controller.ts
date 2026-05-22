import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { reportesService } from '../services/reportes.service.js';
import * as repo from '../repositories/reportes.repo.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORTES_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'] as const;

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const now = new Date();
const DEFAULT_MES = now.getMonth() + 1;
const DEFAULT_ANIO = now.getFullYear();

const mesAnioSchema = z.object({
  mes_idx: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : DEFAULT_MES))
    .pipe(z.number().min(1).max(12)),
  anio: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : DEFAULT_ANIO))
    .pipe(z.number().min(2020).max(2100)),
});

const kpisQuerySchema = mesAnioSchema.extend({
  entidad_id: z.string().optional(),
});

const tendenciaQuerySchema = z.object({
  meses: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 6))
    .pipe(z.number().min(1).max(36)),
});

const presupuestoBodySchema = z.object({
  anio: z.number().int().min(2020).max(2100),
  mes: z.number().int().min(1).max(12),
  monto: z.number().positive(),
  notas: z.string().optional(),
});

// ─── Controller registration ──────────────────────────────────────────────────

export async function registerReportesController(fastify: FastifyInstance): Promise<void> {
  // GET /api/reportes/kpis
  fastify.get(
    '/api/reportes/kpis',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = kpisQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio, entidad_id } = parsed.data;
      const result = await reportesService.getKpis({ mesIdx: mes_idx, anio, entidadId: entidad_id });
      return reply.send(result);
    }
  );

  // GET /api/reportes/entidades
  fastify.get(
    '/api/reportes/entidades',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio } = parsed.data;
      const result = await reportesService.getEntidades({ mesIdx: mes_idx, anio });
      return reply.send(result);
    }
  );

  // GET /api/reportes/cumplimiento/semanal
  fastify.get(
    '/api/reportes/cumplimiento/semanal',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio } = parsed.data;
      const result = await reportesService.getCumplimientoSemanal({ mesIdx: mes_idx, anio });
      return reply.send(result);
    }
  );

  // GET /api/reportes/dias-semana
  fastify.get(
    '/api/reportes/dias-semana',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio } = parsed.data;
      const result = await reportesService.getDiasSemana({ mesIdx: mes_idx, anio });
      return reply.send(result);
    }
  );

  // GET /api/reportes/tendencia
  fastify.get(
    '/api/reportes/tendencia',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = tendenciaQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const result = await reportesService.getTendencia({ meses: parsed.data.meses });
      return reply.send(result);
    }
  );

  // GET /api/reportes/presupuestos
  fastify.get(
    '/api/reportes/presupuestos',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await repo.listPresupuestos();
      return reply.send(result);
    }
  );

  // POST /api/reportes/presupuestos (ADMIN only)
  fastify.post(
    '/api/reportes/presupuestos',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = presupuestoBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { anio, mes, monto, notas } = parsed.data;
      const result = await repo.upsertPresupuesto(anio, mes, monto, notas);
      return reply.status(200).send(result);
    }
  );
}
