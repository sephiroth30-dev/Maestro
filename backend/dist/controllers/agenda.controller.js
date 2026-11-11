"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.agendaRoutes = agendaRoutes;
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
const conectores_repo_js_1 = require("../repositories/conectores.repo.js");
const repo = __importStar(require("../repositories/agenda.repo.js"));
const citas_sync_service_js_1 = require("../services/citas-sync.service.js");
const agenda_backtest_service_js_1 = require("../services/agenda-backtest.service.js");
/** Una evaluación «corriendo» más vieja que esto se dio por interrumpida (reinicio del servidor). */
const BACKTEST_MAX_MS = 30 * 60_000;
/** Quita el estado «corriendo» pegado: si el proceso murió a mitad, nadie lo cerraba. */
function backtestVigente(b) {
    if (b.estado !== 'corriendo' || !b.iniciado)
        return b;
    const t = Date.parse(`${b.iniciado.replace(' ', 'T')}Z`);
    if (Number.isFinite(t) && Date.now() - t < BACKTEST_MAX_MS)
        return b;
    return { ...b, estado: 'error', error: 'La evaluación se interrumpió (reinicio del servidor o tardó demasiado). Vuelve a lanzarla.' };
}
async function conectorConAgenda() {
    const activos = await conectores_repo_js_1.conectoresRepo.findAllActive();
    const c = activos.find((x) => (0, citas_sync_service_js_1.agendaActiva)(x));
    return c ? { id: c.id, nombre: c.nombre } : null;
}
async function agendaRoutes(fastify) {
    const adminOnly = [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')];
    // GET /api/diagnostico/agenda
    fastify.get('/diagnostico/agenda', { preHandler: [...adminOnly] }, async (_req, reply) => {
        const conector = await conectorConAgenda();
        if (!conector) {
            return reply.send({ configurada: false, conector: null });
        }
        const [estado, resumen, sinEntidad, sinPrecio, backtest] = await Promise.all([
            repo.leerEstadoSync(conector.id),
            repo.resumenCitas(),
            repo.conveniosSinEntidad(),
            repo.citasSinPrecioPorReferencia(),
            repo.leerBacktest(conector.id),
        ]);
        // Interpretación de los permisos: el 403 de Medifolios es lo que más conviene
        // ver claro, porque se arregla pidiendo un permiso, no tocando código.
        const permisoCitas = !estado || estado.estado === 'nunca' ? 'desconocido'
            : estado.estado === 'ok' ? 'ok'
                : estado.httpStatus === 403 ? 'sin_permiso' : 'error';
        const permisoConvenios = estado?.conveniosEstado ?? 'desconocido';
        return reply.send({
            configurada: true,
            conector,
            estado,
            permisos: { citas: permisoCitas, convenios: permisoConvenios },
            resumen,
            conveniosSinEntidad: sinEntidad,
            citasSinPrecio: sinPrecio,
            backtest: backtestVigente(backtest),
        });
    });
    // POST /api/diagnostico/agenda/sincronizar  (en segundo plano: tarda ~1 minuto)
    fastify.post('/diagnostico/agenda/sincronizar', { preHandler: [...adminOnly] }, async (_req, reply) => {
        const conector = await conectorConAgenda();
        if (!conector) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Activa «Agenda de citas» en el conector de Medifolios (Configuración → Fuentes).', statusCode: 400 });
        }
        const trabajo = (0, citas_sync_service_js_1.sincronizarCitasConCandado)(conector.id, { manual: true });
        // Si el candado está ocupado la respuesta llega al instante; si no, sigue en
        // segundo plano (~1 min). Así el botón no promete algo que no va a pasar.
        const rapida = await Promise.race([trabajo, new Promise((r) => setTimeout(() => r(null), 1500))]);
        if (rapida?.omitida) {
            return reply.status(409).send({ error: 'Conflict', message: rapida.motivo ?? 'Ya hay una sincronización en curso.', statusCode: 409 });
        }
        return reply.status(202).send({ status: 'EN_PROCESO' });
    });
    // POST /api/diagnostico/agenda/backtest  (en segundo plano: unos minutos)
    fastify.post('/diagnostico/agenda/backtest', { preHandler: [...adminOnly] }, async (_req, reply) => {
        const conector = await conectorConAgenda();
        if (!conector) {
            return reply.status(400).send({ error: 'Bad Request', message: 'Activa «Agenda de citas» en el conector de Medifolios (Configuración → Fuentes).', statusCode: 400 });
        }
        const r = await (0, agenda_backtest_service_js_1.iniciarBacktest)(conector.id);
        if (!r.iniciado) {
            return reply.status(409).send({ error: 'Conflict', message: r.motivo ?? 'No se pudo iniciar la evaluación.', statusCode: 409 });
        }
        return reply.status(202).send({ status: 'EN_PROCESO' });
    });
}
//# sourceMappingURL=agenda.controller.js.map