"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAgendaRoutes = registerAgendaRoutes;
const agenda_controller_js_1 = require("../controllers/agenda.controller.js");
async function registerAgendaRoutes(fastify) {
    await fastify.register(agenda_controller_js_1.agendaRoutes, { prefix: '/api' });
}
//# sourceMappingURL=agenda.routes.js.map