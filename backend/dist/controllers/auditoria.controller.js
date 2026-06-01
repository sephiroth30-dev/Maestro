"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditoriaRoutes = auditoriaRoutes;
const zod_1 = require("zod");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
const auditoria_repo_js_1 = require("../repositories/auditoria.repo.js");
async function auditoriaRoutes(fastify) {
    const guard = [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN', 'FACTURACION')];
    // GET /api/auditoria
    fastify.get('/api/auditoria', { preHandler: [...guard] }, async (request, reply) => {
        const querySchema = zod_1.z.object({
            page: zod_1.z.coerce.number().int().min(1).optional(),
            limit: zod_1.z.coerce.number().int().min(1).max(200).optional(),
            usuarioId: zod_1.z.string().uuid().optional(),
            accion: zod_1.z.string().optional(),
            desde: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
            hasta: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        });
        const parsed = querySchema.safeParse(request.query);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues[0]?.message ?? 'Parámetros inválidos',
                statusCode: 400,
            });
            return;
        }
        const { rows, total } = await auditoria_repo_js_1.auditoriaRepo.findMany(parsed.data);
        await reply.send({
            data: rows,
            total,
            page: parsed.data.page ?? 1,
            limit: parsed.data.limit ?? 50,
        });
    });
    // GET /api/auditoria/acciones — distinct action list for filter dropdown
    fastify.get('/api/auditoria/acciones', { preHandler: [...guard] }, async (_request, reply) => {
        const acciones = await auditoria_repo_js_1.auditoriaRepo.listAcciones();
        await reply.send(acciones);
    });
}
//# sourceMappingURL=auditoria.controller.js.map