"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPacientesRoutes = registerPacientesRoutes;
const pacientes_controller_js_1 = require("../controllers/pacientes.controller.js");
async function registerPacientesRoutes(fastify) {
    await (0, pacientes_controller_js_1.registerPacientesController)(fastify);
}
//# sourceMappingURL=pacientes.routes.js.map