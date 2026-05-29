import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { reportesService } from '../services/reportes.service.js';
import * as repo from '../repositories/reportes.repo.js';
import { calcularHonorarios } from '../services/honorarios.service.js';
import {
  generarLiquidaciones,
  aprobarLiquidacion, aprobarLote,
  pagarLiquidacion,  pagarLote,
  revertirLiquidacion,
  getLiquidacionesByPeriodo,
  generarPDFLiquidacion,
} from '../services/liquidaciones.service.js';
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
    nombres_raw: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((d) => d.es_grupo_caja !== undefined || d.tipo !== undefined || d.nombres_raw !== undefined, {
    message: 'Se requiere al menos un campo: es_grupo_caja, tipo o nombres_raw',
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
      const serviciosQuerySchema = mesAnioDateSchema.extend({
        entidad_id: z.string().optional(),
      });
      const parsed = serviciosQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { mes_idx, anio, start_date, end_date, entidad_id, dia_semana } = parsed.data;
      const result = await reportesService.getServicios({
        mesIdx: mes_idx,
        anio,
        startDate: start_date ? new Date(start_date) : undefined,
        endDate:   end_date   ? new Date(end_date)   : undefined,
        entidadId: entidad_id,
        diaSemana: dia_semana,
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

  // GET /api/diagnostico/sin-servicio (ADMIN — unclassified service descriptions)
  fastify.get(
    '/api/diagnostico/sin-servicio',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rows = await repo.getSinServicioDiagnostico();
      return reply.send(rows);
    }
  );

  // POST /api/admin/reclasificar-servicios (ADMIN — re-run service classification on all atenciones)
  fastify.post(
    '/api/admin/reclasificar-servicios',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const result = await repo.reclasificarServicios();
      return reply.send(result);
    }
  );

  // GET /api/profesionales (ADMIN — list all with specialty)
  fastify.get(
    '/api/profesionales',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rows = await repo.listProfesionales();
      return reply.send(rows);
    }
  );

  // PATCH /api/profesionales/:id (ADMIN — set especialidad and/or nombre_completo)
  fastify.patch(
    '/api/profesionales/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { especialidad?: string | null; nombre_completo?: string | null };
      const fields: Parameters<typeof repo.patchProfesional>[1] = {};
      if ('especialidad' in body) {
        const allowed = ['NEUROLOGIA', 'FISIATRIA', 'OTRO', null];
        if (!allowed.includes(body.especialidad ?? null)) {
          return reply.status(400).send({ error: 'Bad Request', message: 'especialidad must be NEUROLOGIA, FISIATRIA, OTRO or null', statusCode: 400 });
        }
        fields.especialidad = (body.especialidad ?? null) as 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO' | null;
      }
      if ('nombre_completo' in body) {
        const nc = body.nombre_completo;
        fields.nombre_completo = (typeof nc === 'string' && nc.trim() !== '') ? nc.trim() : null;
      }
      await repo.patchProfesional(id, fields);
      return reply.send({ ok: true });
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
        nombres_raw: parsed.data.nombres_raw,
      });
      return reply.status(200).send({ ok: true });
    }
  );

  // GET /api/servicios (catalog for config UI — ADMIN only)
  fastify.get(
    '/api/servicios',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const rows = await repo.listServiciosCatalog();
      return reply.send(rows);
    }
  );

  // PATCH /api/servicios/:id (update tipo_conteo and/or nombre_display — ADMIN only)
  fastify.patch(
    '/api/servicios/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { tipo_conteo?: string; nombre_display?: string | null };
      const fields: Parameters<typeof repo.patchServicio>[1] = {};
      if ('tipo_conteo' in body) {
        const parsed = z.enum(['unidad', 'sesion']).safeParse(body.tipo_conteo);
        if (!parsed.success) return reply.status(400).send({ error: 'Bad Request', message: 'tipo_conteo must be unidad or sesion', statusCode: 400 });
        fields.tipo_conteo = parsed.data;
      }
      if ('nombre_display' in body) {
        const nd = body.nombre_display;
        fields.nombre_display = (typeof nd === 'string' && nd.trim() !== '') ? nd.trim() : null;
      }
      await repo.patchServicio(id, fields);
      return reply.status(200).send({ ok: true });
    }
  );

  // GET /api/diagnostico/servicio-agrupaciones (ADMIN — actual raw descriptions per service)
  fastify.get(
    '/api/diagnostico/servicio-agrupaciones',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const data = await repo.getServicioAgrupaciones();
      return reply.send(data);
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

  // GET /api/honorarios?mes_idx=1&anio=2026
  fastify.get(
    '/api/honorarios',
    { preHandler: [requireAuth, requireRole('ADMIN', 'FACTURACION', 'GERENCIA', 'DIRECCION')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = mesAnioSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Bad Request', statusCode: 400 });
      }
      const { mes_idx, anio } = parsed.data;
      const result = await calcularHonorarios(mes_idx, anio);
      return reply.send(result);
    }
  );

  // ─── Liquidaciones ────────────────────────────────────────────────────────

  const rangoSchema = z.object({
    fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  const HON_ROLES = ['ADMIN', 'FACTURACION', 'GERENCIA', 'DIRECCION'] as const;

  // GET /api/liquidaciones?fecha_desde=2026-05-01&fecha_hasta=2026-05-31
  fastify.get(
    '/api/liquidaciones',
    { preHandler: [requireAuth, requireRole(...HON_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = rangoSchema.safeParse(request.query);
      if (!parsed.success) return reply.status(400).send({ error: 'Bad Request' });
      const rows = await getLiquidacionesByPeriodo(parsed.data.fecha_desde, parsed.data.fecha_hasta);
      return reply.send(rows);
    }
  );

  // POST /api/liquidaciones/generar  { fecha_desde, fecha_hasta }
  fastify.post(
    '/api/liquidaciones/generar',
    { preHandler: [requireAuth, requireRole(...HON_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = rangoSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Bad Request' });
      const rows = await generarLiquidaciones(parsed.data.fecha_desde, parsed.data.fecha_hasta);
      return reply.status(200).send(rows);
    }
  );

  // POST /api/liquidaciones/:id/aprobar
  fastify.post(
    '/api/liquidaciones/:id/aprobar',
    { preHandler: [requireAuth, requireRole('ADMIN', 'GERENCIA', 'DIRECCION')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as FastifyRequest & { user: { sub: string } }).user;
      const liq = await aprobarLiquidacion(id, user.sub);
      if (!liq) return reply.status(404).send({ error: 'No encontrada o ya aprobada' });
      return reply.send(liq);
    }
  );

  // POST /api/liquidaciones/:id/pagar   { notas?: string }
  fastify.post(
    '/api/liquidaciones/:id/pagar',
    { preHandler: [requireAuth, requireRole('ADMIN', 'GERENCIA', 'DIRECCION')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as FastifyRequest & { user: { sub: string } }).user;
      const body = z.object({ notas: z.string().optional() }).safeParse(request.body);
      const notas = body.success ? body.data.notas : undefined;
      const liq = await pagarLiquidacion(id, user.sub, notas);
      if (!liq) return reply.status(404).send({ error: 'No encontrada o no está aprobada' });
      return reply.send(liq);
    }
  );

  // POST /api/liquidaciones/aprobar-lote  { ids: string[] }
  fastify.post(
    '/api/liquidaciones/aprobar-lote',
    { preHandler: [requireAuth, requireRole('ADMIN', 'GERENCIA', 'DIRECCION')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = z.object({ ids: z.array(z.string()).min(1) }).safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Bad Request' });
      const user = (request as FastifyRequest & { user: { sub: string } }).user;
      await aprobarLote(parsed.data.ids, user.sub);
      return reply.send({ ok: true });
    }
  );

  // POST /api/liquidaciones/pagar-lote  { ids: string[] }
  fastify.post(
    '/api/liquidaciones/pagar-lote',
    { preHandler: [requireAuth, requireRole('ADMIN', 'GERENCIA', 'DIRECCION')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = z.object({ ids: z.array(z.string()).min(1) }).safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Bad Request' });
      const user = (request as FastifyRequest & { user: { sub: string } }).user;
      await pagarLote(parsed.data.ids, user.sub);
      return reply.send({ ok: true });
    }
  );

  // POST /api/liquidaciones/:id/revertir  { razon: string }
  fastify.post(
    '/api/liquidaciones/:id/revertir',
    { preHandler: [requireAuth, requireRole('ADMIN', 'GERENCIA', 'DIRECCION')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const user = (request as FastifyRequest & { user: { sub: string } }).user;
      const body = z.object({ razon: z.string().min(5, 'La razón es obligatoria (mín. 5 caracteres)') }).safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.issues[0].message });
      const liq = await revertirLiquidacion(id, user.sub, body.data.razon);
      if (!liq) return reply.status(404).send({ error: 'No encontrada o ya está en estado PAGADO' });
      return reply.send(liq);
    }
  );

  // GET /api/liquidaciones/:id/pdf
  fastify.get(
    '/api/liquidaciones/:id/pdf',
    { preHandler: [requireAuth, requireRole(...HON_ROLES)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      try {
        const buf = await generarPDFLiquidacion(id);
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', `attachment; filename="honorarios-${id.substring(0,8)}.pdf"`)
          .send(buf);
      } catch {
        return reply.status(404).send({ error: 'Liquidación no encontrada' });
      }
    }
  );
}
