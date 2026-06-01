"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReglasHonorariosRoutes = registerReglasHonorariosRoutes;
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
const reglas_honorarios_repo_js_1 = require("../repositories/reglas-honorarios.repo.js");
async function registerReglasHonorariosRoutes(fastify) {
    // GET /api/reglas-honorarios — lista completa de reglas estándar + especiales
    fastify.get('/api/reglas-honorarios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_req, reply) => {
        const [reglas, especiales] = await Promise.all([
            (0, reglas_honorarios_repo_js_1.findAllReglas)(),
            (0, reglas_honorarios_repo_js_1.findAllReglasEspeciales)(),
        ]);
        return reply.send({ reglas, especiales });
    });
    // PUT /api/reglas-honorarios — crear o actualizar una regla estándar
    fastify.put('/api/reglas-honorarios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas } = request.body;
        if (!profesional_nombre || !categoria || !tipo) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Faltan campos requeridos', statusCode: 400 });
        }
        await (0, reglas_honorarios_repo_js_1.upsertRegla)(profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas ?? null);
        const reglas = await (0, reglas_honorarios_repo_js_1.findAllReglas)();
        return reply.send({ reglas });
    });
    // DELETE /api/reglas-honorarios/:id — desactivar una regla
    fastify.delete('/api/reglas-honorarios/:id', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        await (0, reglas_honorarios_repo_js_1.deleteRegla)(request.params.id);
        return reply.status(204).send();
    });
    // PATCH /api/reglas-honorarios/especiales/:id — actualizar valor de regla especial
    fastify.patch('/api/reglas-honorarios/especiales/:id', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { valor, descripcion } = request.body;
        await (0, reglas_honorarios_repo_js_1.updateReglaEspecial)(request.params.id, valor, descripcion ?? null);
        const especiales = await (0, reglas_honorarios_repo_js_1.findAllReglasEspeciales)();
        return reply.send({ especiales });
    });
}
//# sourceMappingURL=reglas-honorarios.controller.js.map