"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUsuariosRoutes = registerUsuariosRoutes;
const usuarios_controller_js_1 = require("../controllers/usuarios.controller.js");
async function registerUsuariosRoutes(fastify) {
    await fastify.register(usuarios_controller_js_1.usuariosRoutes, { prefix: '/api' });
}
//# sourceMappingURL=usuarios.routes.js.map