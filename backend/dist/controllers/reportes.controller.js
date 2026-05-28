"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReportesController = registerReportesController;
const zod_1 = require("zod");
const reportes_service_js_1 = require("../services/reportes.service.js");
const repo = __importStar(require("../repositories/reportes.repo.js"));
const honorarios_service_js_1 = require("../services/honorarios.service.js");
const liquidaciones_service_js_1 = require("../services/liquidaciones.service.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
// ─── Constants ────────────────────────────────────────────────────────────────
const REPORTES_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'];
// ─── Zod schemas ──────────────────────────────────────────────────────────────
const now = new Date();
const DEFAULT_MES = now.getMonth() + 1;
const DEFAULT_ANIO = now.getFullYear();
const mesAnioSchema = zod_1.z.object({
    mes_idx: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : DEFAULT_MES))
        .pipe(zod_1.z.number().min(1).max(12)),
    anio: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : DEFAULT_ANIO))
        .pipe(zod_1.z.number().min(2020).max(2100)),
});
const diaSemanaField = zod_1.z.string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined))
    .pipe(zod_1.z.number().min(2).max(6).optional()); // MySQL DAYOFWEEK: 2=Lun … 6=Vie
const kpisQuerySchema = mesAnioSchema.extend({
    entidad_id: zod_1.z.string().optional(),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dia_semana: diaSemanaField,
});
const mesAnioDateSchema = mesAnioSchema.extend({
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dia_semana: diaSemanaField,
});
const tendenciaQuerySchema = zod_1.z.object({
    meses: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 6))
        .pipe(zod_1.z.number().min(1).max(36)),
});
const patchEntidadBodySchema = zod_1.z
    .object({
    es_grupo_caja: zod_1.z.boolean().optional(),
    tipo: zod_1.z.enum(['EPS', 'ARL', 'CONVENIO', 'PARTICULAR', 'OTRO']).optional(),
    nombres_raw: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
})
    .refine((d) => d.es_grupo_caja !== undefined || d.tipo !== undefined || d.nombres_raw !== undefined, {
    message: 'Se requiere al menos un campo: es_grupo_caja, tipo o nombres_raw',
});
const presupuestoBodySchema = zod_1.z.object({
    anio: zod_1.z.number().int().min(2020).max(2100),
    mes: zod_1.z.number().int().min(1).max(12),
    monto: zod_1.z.number().positive(),
    notas: zod_1.z.string().optional(),
});
// ─── Controller registration ──────────────────────────────────────────────────
async function registerReportesController(fastify) {
    // GET /api/reportes/kpis
    fastify.get('/api/reportes/kpis', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const parsed = kpisQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const { mes_idx, anio, entidad_id, start_date, end_date, dia_semana } = parsed.data;
        const result = await reportes_service_js_1.reportesService.getKpis({
            mesIdx: mes_idx,
            anio,
            entidadId: entidad_id,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
            diaSemana: dia_semana,
        });
        return reply.send(result);
    });
    // GET /api/reportes/entidades
    fastify.get('/api/reportes/entidades', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const parsed = mesAnioDateSchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const { mes_idx, anio, start_date, end_date, dia_semana } = parsed.data;
        const result = await reportes_service_js_1.reportesService.getEntidades({
            mesIdx: mes_idx,
            anio,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
            diaSemana: dia_semana,
        });
        return reply.send(result);
    });
    // GET /api/reportes/cumplimiento/semanal
    fastify.get('/api/reportes/cumplimiento/semanal', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const parsed = mesAnioDateSchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const { mes_idx, anio, start_date, end_date } = parsed.data;
        const result = await reportes_service_js_1.reportesService.getCumplimientoSemanal({
            mesIdx: mes_idx,
            anio,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
        });
        return reply.send(result);
    });
    // GET /api/reportes/dias-semana
    fastify.get('/api/reportes/dias-semana', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const parsed = mesAnioDateSchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const { mes_idx, anio, start_date, end_date } = parsed.data;
        const result = await reportes_service_js_1.reportesService.getDiasSemana({
            mesIdx: mes_idx,
            anio,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
        });
        return reply.send(result);
    });
    // GET /api/reportes/tendencia
    fastify.get('/api/reportes/tendencia', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const parsed = tendenciaQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const result = await reportes_service_js_1.reportesService.getTendencia({ meses: parsed.data.meses });
        return reply.send(result);
    });
    // GET /api/reportes/servicios
    fastify.get('/api/reportes/servicios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const serviciosQuerySchema = mesAnioDateSchema.extend({
            entidad_id: zod_1.z.string().optional(),
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
        const result = await reportes_service_js_1.reportesService.getServicios({
            mesIdx: mes_idx,
            anio,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
            entidadId: entidad_id,
            diaSemana: dia_semana,
        });
        return reply.send(result);
    });
    // GET /api/reportes/servicios/diagnostico (ADMIN — seed status + classification coverage)
    fastify.get('/api/reportes/servicios/diagnostico', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const diag = await repo.getServiciosDiagnostico();
        return reply.send(diag);
    });
    // GET /api/reportes/diagnostico (ADMIN — totals per connector per month for validation)
    fastify.get('/api/reportes/diagnostico', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const rows = await repo.getDiagnosticoConectores();
        return reply.send(rows);
    });
    // GET /api/diagnostico/sin-servicio (ADMIN — unclassified service descriptions)
    fastify.get('/api/diagnostico/sin-servicio', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const rows = await repo.getSinServicioDiagnostico();
        return reply.send(rows);
    });
    // POST /api/admin/reclasificar-servicios (ADMIN — re-run service classification on all atenciones)
    fastify.post('/api/admin/reclasificar-servicios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const result = await repo.reclasificarServicios();
        return reply.send(result);
    });
    // GET /api/profesionales (ADMIN — list all with specialty)
    fastify.get('/api/profesionales', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const rows = await repo.listProfesionales();
        return reply.send(rows);
    });
    // PATCH /api/profesionales/:id (ADMIN — set especialidad and/or nombre_completo)
    fastify.patch('/api/profesionales/:id', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const fields = {};
        if ('especialidad' in body) {
            const allowed = ['NEUROLOGIA', 'FISIATRIA', 'OTRO', null];
            if (!allowed.includes(body.especialidad ?? null)) {
                return reply.status(400).send({ error: 'Bad Request', message: 'especialidad must be NEUROLOGIA, FISIATRIA, OTRO or null', statusCode: 400 });
            }
            fields.especialidad = (body.especialidad ?? null);
        }
        if ('nombre_completo' in body) {
            const nc = body.nombre_completo;
            fields.nombre_completo = (typeof nc === 'string' && nc.trim() !== '') ? nc.trim() : null;
        }
        await repo.patchProfesional(id, fields);
        return reply.send({ ok: true });
    });
    // GET /api/diagnostico/sin-entidad (ADMIN — unmatched entity names breakdown)
    fastify.get('/api/diagnostico/sin-entidad', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
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
    });
    // GET /api/entidades (catalog for config UI — ADMIN only)
    fastify.get('/api/entidades', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const rows = await repo.listEntidades();
        return reply.send(rows);
    });
    // PATCH /api/entidades/:id (toggle es_grupo_caja — ADMIN only)
    fastify.patch('/api/entidades/:id', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { id } = request.params;
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
    });
    // GET /api/servicios (catalog for config UI — ADMIN only)
    fastify.get('/api/servicios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const rows = await repo.listServiciosCatalog();
        return reply.send(rows);
    });
    // PATCH /api/servicios/:id (update tipo_conteo and/or nombre_display — ADMIN only)
    fastify.patch('/api/servicios/:id', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const fields = {};
        if ('tipo_conteo' in body) {
            const parsed = zod_1.z.enum(['unidad', 'sesion']).safeParse(body.tipo_conteo);
            if (!parsed.success)
                return reply.status(400).send({ error: 'Bad Request', message: 'tipo_conteo must be unidad or sesion', statusCode: 400 });
            fields.tipo_conteo = parsed.data;
        }
        if ('nombre_display' in body) {
            const nd = body.nombre_display;
            fields.nombre_display = (typeof nd === 'string' && nd.trim() !== '') ? nd.trim() : null;
        }
        await repo.patchServicio(id, fields);
        return reply.status(200).send({ ok: true });
    });
    // GET /api/diagnostico/servicio-agrupaciones (ADMIN — actual raw descriptions per service)
    fastify.get('/api/diagnostico/servicio-agrupaciones', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const data = await repo.getServicioAgrupaciones();
        return reply.send(data);
    });
    // GET /api/reportes/presupuestos
    fastify.get('/api/reportes/presupuestos', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (_request, reply) => {
        const result = await repo.listPresupuestos();
        return reply.send(result);
    });
    // POST /api/reportes/presupuestos (ADMIN only)
    fastify.post('/api/reportes/presupuestos', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
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
    });
    // GET /api/honorarios?mes_idx=1&anio=2026
    fastify.get('/api/honorarios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN', 'FACTURACION', 'GERENCIA', 'DIRECCION')] }, async (request, reply) => {
        const parsed = mesAnioSchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ error: 'Bad Request', statusCode: 400 });
        }
        const { mes_idx, anio } = parsed.data;
        const result = await (0, honorarios_service_js_1.calcularHonorarios)(mes_idx, anio);
        return reply.send(result);
    });
    // ─── Liquidaciones ────────────────────────────────────────────────────────
    const rangoSchema = zod_1.z.object({
        fecha_desde: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fecha_hasta: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    });
    const HON_ROLES = ['ADMIN', 'FACTURACION', 'GERENCIA', 'DIRECCION'];
    // GET /api/liquidaciones?fecha_desde=2026-05-01&fecha_hasta=2026-05-31
    fastify.get('/api/liquidaciones', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...HON_ROLES)] }, async (request, reply) => {
        const parsed = rangoSchema.safeParse(request.query);
        if (!parsed.success)
            return reply.status(400).send({ error: 'Bad Request' });
        const rows = await (0, liquidaciones_service_js_1.getLiquidacionesByPeriodo)(parsed.data.fecha_desde, parsed.data.fecha_hasta);
        return reply.send(rows);
    });
    // POST /api/liquidaciones/generar  { fecha_desde, fecha_hasta }
    fastify.post('/api/liquidaciones/generar', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...HON_ROLES)] }, async (request, reply) => {
        const parsed = rangoSchema.safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ error: 'Bad Request' });
        const rows = await (0, liquidaciones_service_js_1.generarLiquidaciones)(parsed.data.fecha_desde, parsed.data.fecha_hasta);
        return reply.status(200).send(rows);
    });
    // POST /api/liquidaciones/:id/aprobar
    fastify.post('/api/liquidaciones/:id/aprobar', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN', 'GERENCIA', 'DIRECCION')] }, async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        const liq = await (0, liquidaciones_service_js_1.aprobarLiquidacion)(id, user.sub);
        if (!liq)
            return reply.status(404).send({ error: 'No encontrada o ya aprobada' });
        return reply.send(liq);
    });
    // POST /api/liquidaciones/:id/pagar   { notas?: string }
    fastify.post('/api/liquidaciones/:id/pagar', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN', 'GERENCIA', 'DIRECCION')] }, async (request, reply) => {
        const { id } = request.params;
        const user = request.user;
        const body = zod_1.z.object({ notas: zod_1.z.string().optional() }).safeParse(request.body);
        const notas = body.success ? body.data.notas : undefined;
        const liq = await (0, liquidaciones_service_js_1.pagarLiquidacion)(id, user.sub, notas);
        if (!liq)
            return reply.status(404).send({ error: 'No encontrada o no está aprobada' });
        return reply.send(liq);
    });
    // POST /api/liquidaciones/aprobar-lote  { ids: string[] }
    fastify.post('/api/liquidaciones/aprobar-lote', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN', 'GERENCIA', 'DIRECCION')] }, async (request, reply) => {
        const parsed = zod_1.z.object({ ids: zod_1.z.array(zod_1.z.string()).min(1) }).safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ error: 'Bad Request' });
        const user = request.user;
        await (0, liquidaciones_service_js_1.aprobarLote)(parsed.data.ids, user.sub);
        return reply.send({ ok: true });
    });
    // POST /api/liquidaciones/pagar-lote  { ids: string[] }
    fastify.post('/api/liquidaciones/pagar-lote', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN', 'GERENCIA', 'DIRECCION')] }, async (request, reply) => {
        const parsed = zod_1.z.object({ ids: zod_1.z.array(zod_1.z.string()).min(1) }).safeParse(request.body);
        if (!parsed.success)
            return reply.status(400).send({ error: 'Bad Request' });
        const user = request.user;
        await (0, liquidaciones_service_js_1.pagarLote)(parsed.data.ids, user.sub);
        return reply.send({ ok: true });
    });
    // GET /api/liquidaciones/:id/pdf
    fastify.get('/api/liquidaciones/:id/pdf', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...HON_ROLES)] }, async (request, reply) => {
        const { id } = request.params;
        try {
            const buf = await (0, liquidaciones_service_js_1.generarPDFLiquidacion)(id);
            return reply
                .header('Content-Type', 'application/pdf')
                .header('Content-Disposition', `attachment; filename="honorarios-${id.substring(0, 8)}.pdf"`)
                .send(buf);
        }
        catch {
            return reply.status(404).send({ error: 'Liquidación no encontrada' });
        }
    });
}
//# sourceMappingURL=reportes.controller.js.map