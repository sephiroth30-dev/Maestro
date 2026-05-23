"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerReportesRoutes = registerReportesRoutes;
const reportes_controller_js_1 = require("../controllers/reportes.controller.js");
async function registerReportesRoutes(fastify) {
    await (0, reportes_controller_js_1.registerReportesController)(fastify);
}
//# sourceMappingURL=reportes.routes.js.map