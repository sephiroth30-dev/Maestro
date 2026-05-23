"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerConnectorRoutes = registerConnectorRoutes;
const connectors_controller_js_1 = require("../controllers/connectors.controller.js");
/**
 * Registers all connector routes under /api prefix.
 */
async function registerConnectorRoutes(fastify) {
    await fastify.register(connectors_controller_js_1.connectorRoutes, { prefix: '/api' });
}
//# sourceMappingURL=connectors.routes.js.map