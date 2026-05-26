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

const diaSemanaField = z.string()
  .optional()
  .transform((v) => (v ? parseInt(v, 10) : undefined))
  .pipe(z.number().min(2).max(6).optional()); // MySQL DAYOFWEEK: 2=Lun … 6=Vie

const kpisQuerySchema = mesAnioSchema.extend({
  entidad_id: z.string().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dia_semana: diaSemanaField,
});

const mesAnioDateSchema = mesAnioSchema.extend({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dia_semana: diaSemanaField,
});

const tendenciaQuerySchema = z.object({
  meses: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 6))
    .pipe(z.number().min(1).max(36)),
});

const patchEntidadBodySchema = z
  .object({
    es_grupo_caja: z.boolean().optional(),
    tipo: z.enum(['EPS', 'ARL', 'CONVENIO', 'PARTICULAR', 'OTRO']).optional(),
  })
  .refine((d) => d.es_grupo_caja !== undefined || d.tipo !== undefined, {
    message: 'Se requiere al menos un campo: es_grupo_caja o tipo',
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

      const { mes_idx, anio, entidad_id, start_date, end_date, dia_semana } = parsed.data;
      const result = await reportesService.getKpis({
        mesIdx: mes_idx,
        anio,
        entidadId: entidad_id,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
        diaSemana: dia_semana,
      });
      return reply.send(result);
    }
  );

  // GET /api/reportes/entidades
  fastify.get(
    '/api/reportes/entidades',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioDateSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio, start_date, end_date, dia_semana } = parsed.data;
      const result = await reportesService.getEntidades({
        mesIdx: mes_idx,
        anio,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
        diaSemana: dia_semana,
      });
      return reply.send(result);
    }
  );

  // GET /api/reportes/cumplimiento/semanal
  fastify.get(
    '/api/reportes/cumplimiento/semanal',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioDateSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio, start_date, end_date } = parsed.data;
      const result = await reportesService.getCumplimientoSemanal({
        mesIdx: mes_idx,
        anio,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate: end_date ? new Date(end_date) : undefined,
      });
      return reply.send(result);
    }
  );

  // GET /api/reportes/dias-semana
  fastify.get(
    '/api/reportes/dias-semana',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioDateSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio, start_date, end_date } = parsed.data;
      const result = await reportesService.getDiasSemana({
        mesIdx: mes_idx,
        anio,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate:   end_date   ? new Date(end_date)   : undefined,
      });
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

  // GET /api/reportes/servicios
  fastify.get(
    '/api/reportes/servicios',
    { preHandler: [requireAuth, requireRole(...REPORTES_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioDateSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio, start_date, end_date } = parsed.data;
      const result = await reportesService.getServicios({
        mesIdx: mes_idx,
        anio,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate:   end_date   ? new Date(end_date)   : undefined,
      });
      return reply.send(result);
    }
  );

  // GET /api/reportes/servicios/diagnostico (ADMIN — seed status + classification coverage)
  fastify.get(
    '/api/reportes/servicios/diagnostico',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const diag = await repo.getServiciosDiagnostico();
      return reply.send(diag);
    }
  );

  // GET /api/reportes/diagnostico (ADMIN — totals per connector per month for validation)
  fastify.get(
    '/api/reportes/diagnostico',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rows = await repo.getDiagnosticoConectores();
      return reply.send(rows);
    }
  );

  // GET /api/diagnostico/sin-entidad (ADMIN — unmatched entity names breakdown)
  fastify.get(
    '/api/diagnostico/sin-entidad',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
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
      const rows = await repo.getSinEntidadDiagnostico(mes_idx, anio);
      return reply.send(rows);
    }
  );

  // GET /api/entidades (catalog for config UI — ADMIN only)
  fastify.get(
    '/api/entidades',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rows = await repo.listEntidades();
      return reply.send(rows);
    }
  );

  // PATCH /api/entidades/:id (toggle es_grupo_caja — ADMIN only)
  fastify.patch(
    '/api/entidades/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = patchEntidadBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }
      await repo.patchEntidad(id, {
        es_grupo_caja: parsed.data.es_grupo_caja,
        tipo: parsed.data.tipo,
      });
      return reply.status(200).send({ ok: true });
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
