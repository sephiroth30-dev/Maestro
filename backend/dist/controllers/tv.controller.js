"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tvRoutes = tvRoutes;
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
const tv_service_js_1 = require("../services/tv.service.js");
// Los mismos roles que ven los reportes. ADMISIONES NO: su acceso está limitado al mes
// en curso y a otras restricciones que este resumen (con el presupuesto y la proyección) no respeta.
const TV_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA'];
async function tvRoutes(fastify) {
    // GET /api/tv/estado — todo lo que muestra la pantalla de TV, en una sola lectura.
    fastify.get('/tv/estado', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)(...TV_ROLES)] }, async (_req, reply) => {
        return reply.send(await (0, tv_service_js_1.obtenerEstadoTv)());
    });
}
//# sourceMappingURL=tv.controller.js.map