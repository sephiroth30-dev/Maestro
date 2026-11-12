"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTvRoutes = registerTvRoutes;
const tv_controller_js_1 = require("../controllers/tv.controller.js");
async function registerTvRoutes(fastify) {
    await fastify.register(tv_controller_js_1.tvRoutes, { prefix: '/api' });
}
//# sourceMappingURL=tv.routes.js.map