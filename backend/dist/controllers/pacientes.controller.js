"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPacientesController = registerPacientesController;
const zod_1 = require("zod");
const pacientes_service_js_1 = require("../services/pacientes.service.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
const REPORTES_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA', 'ADMISIONES'];
/**
 * El detalle va completo en memoria, de ahí al navegador y de ahí al generador.
 * 5.000 filas son ~5 MB de JSON y unas 170 páginas de PDF: por encima de eso la
 * pestaña se congela al generar.
 */
const DETALLE_MAX = 5_000;
/**
 * Los valores por defecto se calculan por petición, no al cargar el módulo: un
 * proceso que sigue vivo al cambiar de mes seguiría respondiendo con el mes
 * anterior.
 */
const querySchema = zod_1.z.object({
    mes_idx: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : new Date().getMonth() + 1))
        .pipe(zod_1.z.number().min(1).max(12)),
    anio: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : new Date().getFullYear()))
        .pipe(zod_1.z.number().min(2020).max(2100)),
    start_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    entidad_id: zod_1.z.string().optional(),
    dia_semana: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : undefined))
        .pipe(zod_1.z.number().min(2).max(6).optional()),
});
const detalleSchema = querySchema.extend({
    limit: zod_1.z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : DETALLE_MAX))
        .pipe(zod_1.z.number().min(1).max(DETALLE_MAX)),
});
/**
 * ADMISIONES sólo ve el mes en curso.
 *
 * Es imprescindible anular también `start_date`/`end_date`: `buildDateWhere`
 * PREFIERE el rango y descarta `mes_idx`/`anio` cuando ambas fechas vienen, así
 * que sobrescribir solo el mes deja el candado abierto — bastaría pedir
 * `?start_date=2020-01-01&end_date=2030-12-31` para llevarse el histórico
 * completo, y en `/detalle-atenciones` eso son nombres y documentos de paciente.
 */
function enforceAdmisionesPeriod(rol, params) {
    if (rol !== 'ADMISIONES')
        return params;
    const hoy = new Date();
    return {
        ...params,
        mes_idx: hoy.getMonth() + 1,
        anio: hoy.getFullYear(),
        start_date: undefined,
        end_date: undefined,
    };
}
async function registerPacientesController(fastify) {
    // GET /api/reportes/pacientes
    fastify.get('/api/reportes/pacientes', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const parsed = querySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const rol = request.user?.rol ?? '';
        const { mes_idx, anio, start_date, end_date } = enforceAdmisionesPeriod(rol, parsed.data);
        const { entidad_id, dia_semana } = parsed.data;
        const result = await (0, pacientes_service_js_1.getPacientes)({
            mesIdx: mes_idx,
            anio,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
            entidadId: entidad_id,
            diaSemana: dia_semana,
        });
        return reply.send(result);
    });
    // GET /api/reportes/detalle-atenciones — una fila por atención del período.
    fastify.get('/api/reportes/detalle-atenciones', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...REPORTES_ROLES)] }, async (request, reply) => {
        const parsed = detalleSchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const rol = request.user?.rol ?? '';
        const { mes_idx, anio, start_date, end_date } = enforceAdmisionesPeriod(rol, parsed.data);
        const { entidad_id, dia_semana, limit } = parsed.data;
        const result = await (0, pacientes_service_js_1.getDetalleAtenciones)({
            mesIdx: mes_idx,
            anio,
            startDate: start_date ? new Date(start_date) : undefined,
            endDate: end_date ? new Date(end_date) : undefined,
            entidadId: entidad_id,
            diaSemana: dia_semana,
        }, limit);
        return reply.send({ ...result, limite: limit, truncado: result.total > result.rows.length });
    });
}
//# sourceMappingURL=pacientes.controller.js.map