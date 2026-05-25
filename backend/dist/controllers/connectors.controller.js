"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorRoutes = connectorRoutes;
const zod_1 = require("zod");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
const connector_service_js_1 = require("../services/connector.service.js");
const sync_service_js_1 = require("../services/sync.service.js");
const logger_js_1 = require("../config/logger.js");
const prisma_js_1 = require("../config/prisma.js");
const redis_js_1 = require("../config/redis.js");
// ─── Request schemas ──────────────────────────────────────────────────────────
const CreateConnectorSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1, 'nombre es requerido').max(100),
    tipo: zod_1.z.enum(['GOOGLE_SHEETS', 'REST_API', 'POSTGRESQL', 'CSV']),
    config: zod_1.z.record(zod_1.z.unknown()),
    frecuenciaSync: connector_service_js_1.FrecuenciaSyncSchema.optional(),
});
const UpdateConnectorSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1).max(100).optional(),
    config: zod_1.z.record(zod_1.z.unknown()).optional(),
    activo: zod_1.z.boolean().optional(),
    frecuenciaSync: connector_service_js_1.FrecuenciaSyncSchema.optional(),
});
const TestNewConnectorSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(1),
    tipo: zod_1.z.enum(['GOOGLE_SHEETS', 'REST_API', 'POSTGRESQL', 'CSV']),
    config: zod_1.z.record(zod_1.z.unknown()),
});
// ─── Routes ───────────────────────────────────────────────────────────────────
async function connectorRoutes(fastify) {
    const adminOnly = [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')];
    const adminOrBilling = [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN', 'FACTURACION')];
    // GET /api/connectors
    fastify.get('/connectors', { preHandler: [...adminOnly] }, async (_req, reply) => {
        const list = await connector_service_js_1.connectorService.list();
        await reply.send(list);
    });
    // POST /api/connectors
    fastify.post('/connectors', { preHandler: [...adminOnly] }, async (req, reply) => {
        const parsed = CreateConnectorSchema.safeParse(req.body);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues[0]?.message ?? 'Invalid body',
                statusCode: 400,
            });
            return;
        }
        const conector = await connector_service_js_1.connectorService.create({
            ...parsed.data,
            tipo: parsed.data.tipo,
            config: parsed.data.config,
        });
        await reply.status(201).send(conector);
    });
    // POST /api/connectors/test  (test NEW config before saving — must be BEFORE /:id routes)
    fastify.post('/connectors/test', { preHandler: [...adminOnly] }, async (req, reply) => {
        const parsed = TestNewConnectorSchema.safeParse(req.body);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues[0]?.message ?? 'Invalid body',
                statusCode: 400,
            });
            return;
        }
        const result = await connector_service_js_1.connectorService.testConnection({
            nombre: parsed.data.nombre,
            tipo: parsed.data.tipo,
            config: parsed.data.config,
        });
        await reply.send(result);
    });
    // GET /api/connectors/:id
    fastify.get('/connectors/:id', { preHandler: [...adminOnly] }, async (req, reply) => {
        const { id } = req.params;
        const conector = await connector_service_js_1.connectorService.getById(id);
        await reply.send(conector);
    });
    // PUT /api/connectors/:id
    fastify.put('/connectors/:id', { preHandler: [...adminOnly] }, async (req, reply) => {
        const { id } = req.params;
        const parsed = UpdateConnectorSchema.safeParse(req.body);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues[0]?.message ?? 'Invalid body',
                statusCode: 400,
            });
            return;
        }
        const conector = await connector_service_js_1.connectorService.update(id, {
            ...parsed.data,
            config: parsed.data.config,
        });
        await reply.send(conector);
    });
    // DELETE /api/connectors/:id
    fastify.delete('/connectors/:id', { preHandler: [...adminOnly] }, async (req, reply) => {
        const { id } = req.params;
        await connector_service_js_1.connectorService.delete(id);
        (0, redis_js_1.flushReportesCache)();
        await reply.status(204).send();
    });
    // POST /api/connectors/:id/test  (test existing connector)
    fastify.post('/connectors/:id/test', { preHandler: [...adminOnly] }, async (req, reply) => {
        const { id } = req.params;
        const conector = await connector_service_js_1.connectorService.getById(id);
        const result = await connector_service_js_1.connectorService.testConnection(conector);
        await reply.send(result);
    });
    // GET /api/connectors/:id/sheets
    fastify.get('/connectors/:id/sheets', { preHandler: [...adminOnly] }, async (req, reply) => {
        const { id } = req.params;
        const sheets = await connector_service_js_1.connectorService.listSheets(id);
        await reply.send({ sheets });
    });
    // POST /api/connectors/:id/sync  (manual trigger — async, returns 202 immediately)
    fastify.post('/connectors/:id/sync', { preHandler: [...adminOrBilling] }, async (req, reply) => {
        const { id } = req.params;
        // Fire-and-forget: sync can take 60-120s; Hostinger proxy times out at ~30s.
        // Return 202 immediately and let the client poll the history endpoint.
        void sync_service_js_1.syncService.runSync(id).catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            logger_js_1.logger.error('Background sync failed', { conectorId: id, error: msg });
        });
        await reply.status(202).send({ conectorId: id, status: 'EN_PROCESO' });
    });
    // DELETE /api/connectors/:id/data  (wipe atenciones for this connector — ADMIN only)
    fastify.delete('/connectors/:id/data', { preHandler: [...adminOnly] }, async (req, reply) => {
        const { id } = req.params;
        // Ensure connector exists first
        await connector_service_js_1.connectorService.getById(id);
        const [deleteResult] = await prisma_js_1.pool.query('DELETE FROM atenciones WHERE conector_id = ?', [id]);
        const result = { count: deleteResult.affectedRows };
        (0, redis_js_1.flushReportesCache)();
        logger_js_1.logger.info('Connector data wiped', { conectorId: id, deleted: result.count });
        await reply.send({ conectorId: id, deleted: result.count });
    });
    // GET /api/connectors/:id/sync/history
    fastify.get('/connectors/:id/sync/history', { preHandler: [...adminOrBilling] }, async (req, reply) => {
        const { id } = req.params;
        const query = req.query;
        const limit = query.limit ? parseInt(query.limit, 10) : 20;
        const history = await sync_service_js_1.syncService.getHistory(id, limit);
        await reply.send(history);
    });
    // DELETE /api/connectors/data/orphan  (wipe seed/orphan atenciones with no conector_id — ADMIN only)
    fastify.delete('/connectors/data/orphan', { preHandler: [...adminOnly] }, async (_req, reply) => {
        const [deleteResult] = await prisma_js_1.pool.query('DELETE FROM atenciones WHERE conector_id IS NULL');
        (0, redis_js_1.flushReportesCache)();
        logger_js_1.logger.info('Orphan atenciones wiped', { deleted: deleteResult.affectedRows });
        await reply.send({ deleted: deleteResult.affectedRows });
    });
    // GET /api/connectors/:id/column-diagnostico
    // Queries the DB directly — no Redis dependency.
    // Returns per-month totals so the user can compare against the Excel.
    fastify.get('/connectors/:id/column-diagnostico', { preHandler: [...adminOnly] }, async (req, reply) => {
        const { id } = req.params;
        const [rows] = await prisma_js_1.pool.query(`SELECT
           anio,
           mes_idx,
           COUNT(*)                                            AS atenciones,
           SUM(valor_bruto)                                   AS total,
           SUM(CASE WHEN valor_bruto = 0 THEN 1 ELSE 0 END)  AS sin_valor
         FROM atenciones
         WHERE conector_id = ?
         GROUP BY anio, mes_idx
         ORDER BY anio DESC, mes_idx DESC`, [id]);
        if (rows.length === 0) {
            await reply.status(404).send({ error: 'Este conector no tiene datos importados. Sincroniza primero.' });
            return;
        }
        const meses = rows.map((r) => ({
            anio: Number(r.anio),
            mes: Number(r.mes_idx),
            atenciones: Number(r.atenciones),
            totalValorBruto: Number(r.total),
            sinValor: Number(r.sin_valor),
        }));
        const totalAtenciones = meses.reduce((s, r) => s + r.atenciones, 0);
        const totalValor = meses.reduce((s, r) => s + r.totalValorBruto, 0);
        await reply.send({ conectorId: id, totalAtenciones, totalValorBruto: totalValor, meses });
    });
}
//# sourceMappingURL=connectors.controller.js.map