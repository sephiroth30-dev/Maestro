"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthRoutes = registerAuthRoutes;
const auth_controller_js_1 = require("../controllers/auth.controller.js");
/**
 * Registers all authentication routes under /api prefix.
 * Actual route definitions live in auth.controller.ts so the
 * controller file stays the single source of truth for paths.
 */
async function registerAuthRoutes(fastify) {
    await fastify.register(auth_controller_js_1.authRoutes, { prefix: '/api' });
}
//# sourceMappingURL=auth.routes.js.map