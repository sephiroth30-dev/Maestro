"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCapacidadRoutes = registerCapacidadRoutes;
const capacidad_controller_js_1 = require("../controllers/capacidad.controller.js");
async function registerCapacidadRoutes(fastify) {
    await fastify.register(capacidad_controller_js_1.capacidadRoutes, { prefix: '/api' });
}
//# sourceMappingURL=capacidad.routes.js.map