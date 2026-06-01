"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuditoriaRoutes = registerAuditoriaRoutes;
const auditoria_controller_js_1 = require("../controllers/auditoria.controller.js");
async function registerAuditoriaRoutes(fastify) {
    await fastify.register(auditoria_controller_js_1.auditoriaRoutes);
}
//# sourceMappingURL=auditoria.routes.js.map