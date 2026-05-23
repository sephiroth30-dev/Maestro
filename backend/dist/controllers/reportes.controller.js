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
const kpisQuerySchema = mesAnioSchema.extend({
    entidad_id: zod_1.z.string().optional(),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const mesAnioDateSchema = mesAnioSchema.extend({
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const tendenciaQuerySchema = zod_1.z.object({
    meses: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 6))
        .pipe(zod_1.z.number().min(1).max(36)),
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
        const { mes_idx, anio, entidad_id, start_date, end_date } = parsed.data;
        const result = await reportes_service_js_1.reportesService.getKpis({
            mesIdx: mes_idx,
            anio,
            entidadId: entidad_id,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
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
        const { mes_idx, anio, start_date, end_date } = parsed.data;
        const result = await reportes_service_js_1.reportesService.getEntidades({
            mesIdx: mes_idx,
            anio,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
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
        const parsed = mesAnioSchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const { mes_idx, anio } = parsed.data;
        const result = await reportes_service_js_1.reportesService.getDiasSemana({ mesIdx: mes_idx, anio });
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
}
//# sourceMappingURL=reportes.controller.js.map