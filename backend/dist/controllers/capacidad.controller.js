"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capacidadRoutes = capacidadRoutes;
const zod_1 = require("zod");
const capacidad_repo_js_1 = require("../repositories/capacidad.repo.js");
const auditoria_repo_js_1 = require("../repositories/auditoria.repo.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
// ─── Roles ────────────────────────────────────────────────────────────────────
const READ_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'];
// ─── Schemas ──────────────────────────────────────────────────────────────────
const upsertSchema = zod_1.z.object({
    grupo: zod_1.z.string().min(1).max(50),
    nombre: zod_1.z.string().min(1).max(150),
    anio: zod_1.z.number().int().min(2020).max(2100),
    mesIdx: zod_1.z.number().int().min(1).max(12),
    capacidad: zod_1.z.number().int().min(0).max(32767),
    recursos: zod_1.z.string().max(5000).nullable().optional(),
});
const bulkSchema = zod_1.z.object({
    rows: zod_1.z.array(upsertSchema).min(1).max(200),
});
// ─── Controller ───────────────────────────────────────────────────────────────
async function capacidadRoutes(fastify) {
    // GET /api/capacidad?anio=2026
    fastify.get('/capacidad', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...READ_ROLES)] }, async (request, reply) => {
        const query = request.query;
        const anio = parseInt(query.anio ?? '', 10);
        if (!anio || isNaN(anio)) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Se requiere el parámetro anio', statusCode: 400 });
        }
        const rows = await capacidad_repo_js_1.capacidadRepo.findByAnio(anio);
        return reply.send(rows);
    });
    // GET /api/capacidad/utilizacion?anio=2026&mes_idx=1
    fastify.get('/capacidad/utilizacion', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...READ_ROLES)] }, async (request, reply) => {
        const query = request.query;
        const anio = parseInt(query.anio ?? '', 10);
        const mesIdx = parseInt(query.mes_idx ?? '', 10);
        if (!anio || isNaN(anio) || !mesIdx || isNaN(mesIdx) || mesIdx < 1 || mesIdx > 12) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Se requieren los parámetros anio y mes_idx (1-12)', statusCode: 400 });
        }
        const rows = await capacidad_repo_js_1.capacidadRepo.getUtilizacion(anio, mesIdx);
        return reply.send(rows);
    });
    // POST /api/capacidad — upsert single row
    fastify.post('/capacidad', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const parsed = upsertSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const row = await capacidad_repo_js_1.capacidadRepo.upsert(parsed.data);
        void auditoria_repo_js_1.auditoriaRepo.insert({
            usuarioId: request.authenticatedUser.id,
            accion: auditoria_repo_js_1.ACCION.CAPACIDAD_CONFIGURADA,
            entidadTipo: 'capacidad_instalada',
            entidadId: row.id,
            ip: request.ip,
            detalle: { grupo: parsed.data.grupo, anio: parsed.data.anio, mesIdx: parsed.data.mesIdx, capacidad: parsed.data.capacidad },
        }).catch(() => { });
        return reply.status(201).send(row);
    });
    // POST /api/capacidad/bulk — upsert multiple rows
    fastify.post('/capacidad/bulk', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const parsed = bulkSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const results = await Promise.all(parsed.data.rows.map((r) => capacidad_repo_js_1.capacidadRepo.upsert(r)));
        void auditoria_repo_js_1.auditoriaRepo.insert({
            usuarioId: request.authenticatedUser.id,
            accion: auditoria_repo_js_1.ACCION.CAPACIDAD_CONFIGURADA,
            entidadTipo: 'capacidad_instalada',
            entidadId: null,
            ip: request.ip,
            detalle: { count: results.length, grupos: parsed.data.rows.map((r) => r.grupo) },
        }).catch(() => { });
        return reply.status(201).send(results);
    });
    // DELETE /api/capacidad/:grupo/:anio/:mesIdx
    fastify.delete('/capacidad/:grupo/:anio/:mesIdx', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const params = request.params;
        const anio = parseInt(params.anio, 10);
        const mesIdx = parseInt(params.mesIdx, 10);
        if (isNaN(anio) || isNaN(mesIdx) || mesIdx < 1 || mesIdx > 12) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Parámetros de ruta inválidos', statusCode: 400 });
        }
        await capacidad_repo_js_1.capacidadRepo.deleteOne(params.grupo, anio, mesIdx);
        void auditoria_repo_js_1.auditoriaRepo.insert({
            usuarioId: request.authenticatedUser.id,
            accion: auditoria_repo_js_1.ACCION.CAPACIDAD_ELIMINADA,
            entidadTipo: 'capacidad_instalada',
            entidadId: null,
            ip: request.ip,
            detalle: { grupo: params.grupo, anio, mesIdx },
        }).catch(() => { });
        return reply.status(200).send({ ok: true });
    });
}
//# sourceMappingURL=capacidad.controller.js.map