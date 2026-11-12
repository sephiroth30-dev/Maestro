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
exports.obtenerEstadoTv = obtenerEstadoTv;
exports._vaciarCacheTv = _vaciarCacheTv;
const reportes_service_js_1 = require("./reportes.service.js");
const logger_js_1 = require("../config/logger.js");
const conectores_repo_js_1 = require("../repositories/conectores.repo.js");
const tvRepo = __importStar(require("../repositories/tv.repo.js"));
const agenda_repo_js_1 = require("../repositories/agenda.repo.js");
const tv_estado_js_1 = require("./tv-estado.js");
const agenda_ventana_js_1 = require("./agenda-ventana.js");
const citas_sync_service_js_1 = require("./citas-sync.service.js");
const reportesRepo = __importStar(require("../repositories/reportes.repo.js"));
/** Minutos entre sincronizaciones de consumos según la frecuencia del conector. */
const CADENCIA_MIN = { '30min': 30, '1h': 60, '4h': 240, daily: 1440 };
/**
 * Estado de la pantalla de TV. Reutiliza lo que ya existe (kpis y agenda, con su caché
 * de 60 s) y añade las citas de hoy y los movimientos. Un solo endpoint ligero: la TV
 * pregunta cada 30–60 s.
 */
const APP_VERSION = require('../../../package.json').version;
const MOVIMIENTOS_HORAS = 36;
const MOVIMIENTOS_MAX = 40;
// Caché propia, de pocos segundos: varias pantallas abiertas (o una pestaña de más) no
// multiplican las consultas. Es por proceso, como la de reportes.
const CACHE_MS = 20_000;
let cache = null;
/** Una consulta que solo alimenta una parte de la pantalla: si falla, esa parte queda vacía y el resto se muestra. */
function opcional(que, vacio) {
    return (err) => {
        logger_js_1.logger.warn(`TV: no se pudo leer ${que}`, { error: err instanceof Error ? err.message : String(err) });
        return vacio;
    };
}
async function obtenerEstadoTv() {
    const t = Date.now();
    if (cache && t - cache.en < CACHE_MS)
        return cache.estado;
    const ahora = new Date();
    const hoy = (0, agenda_ventana_js_1.hoyEnBogota)(ahora);
    const [anioStr, mesStr] = hoy.split('-');
    const anio = Number(anioStr);
    const mesIdx = Number(mesStr);
    const activos = await conectores_repo_js_1.conectoresRepo.findAllActive();
    const conectorAgenda = activos.find((c) => (0, citas_sync_service_js_1.agendaActiva)(c));
    const fechaPrevia = await tvRepo.fechaPreviaConSerie(hoy).catch(() => null);
    const [kpis, agendaMes, agendaSemana, citasDia, movimientos, estadoSync, entidadesMes, entidadesHoy, diarios, serieHoy, seriePrevia] = await Promise.all([
        reportes_service_js_1.reportesService.getKpis({ mesIdx, anio }),
        reportes_service_js_1.reportesService.getAgenda({ mesIdx, anio }),
        reportes_service_js_1.reportesService.getAgenda({ mesIdx, anio, startDate: hoy, endDate: (0, agenda_ventana_js_1.diasAntes)(hoy, -6) }),
        conectorAgenda ? tvRepo.leerCitasDia(conectorAgenda.id) : Promise.resolve(null),
        tvRepo.leerMovimientos(new Date(ahora.getTime() - MOVIMIENTOS_HORAS * 3_600_000), MOVIMIENTOS_MAX),
        conectorAgenda ? (0, agenda_repo_js_1.leerEstadoSync)(conectorAgenda.id) : Promise.resolve(null),
        reportes_service_js_1.reportesService.getEntidades({ mesIdx, anio }).catch(opcional('EPS del mes', { rows: [], total: 0 })),
        // «Hoy» como rango de un solo día: el mismo cálculo que Reportes con el filtro de día.
        reportes_service_js_1.reportesService.getEntidades({ mesIdx, anio, startDate: new Date(`${hoy}T00:00:00.000Z`), endDate: new Date(`${hoy}T00:00:00.000Z`) }).catch(opcional('EPS de hoy', { rows: [], total: 0 })),
        reportesRepo.getDiariosDelMes(mesIdx, anio).catch(opcional('velas diarias', [])),
        tvRepo.leerSerie(hoy).catch(() => []),
        fechaPrevia ? tvRepo.leerSerie(fechaPrevia).then((puntos) => ({ fecha: fechaPrevia, puntos })).catch(() => null) : Promise.resolve(null),
    ]);
    // Última sincronización de consumos de las fuentes activas.
    // El pool entrega las fechas como TEXTO en UTC (`dateStrings`), aunque el tipo diga Date.
    const aMs = (v) => (v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(`${v.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'}`) : NaN);
    const ultimas = activos.map((c) => aMs(c.ultimaSync)).filter((t) => Number.isFinite(t));
    const consumosActualizado = ultimas.length > 0 ? new Date(Math.max(...ultimas)).toISOString() : null;
    // La cadencia de la fuente que alimenta el dashboard (la de consumos más frecuente).
    const cadencias = activos.map((c) => CADENCIA_MIN[c.frecuenciaSync]).filter((n) => typeof n === 'number');
    const cadenciaConsumosMin = cadencias.length > 0 ? Math.min(...cadencias) : null;
    const estado = (0, tv_estado_js_1.armarEstadoTv)({
        ahora, hoy, version: APP_VERSION, mesIdx, anio, kpis, agendaMes, agendaSemana,
        citasDia, movimientos, consumosActualizado, cadenciaConsumosMin,
        lecturaCitasDia: estadoSync?.tvEstado ?? null,
        entidadesMes: entidadesMes.rows,
        entidadesHoy: entidadesHoy.rows,
        diarios: diarios.map((d) => ({ fecha: d.fecha_dia.toISOString().slice(0, 10), total: d.total })),
        serieHoy,
        seriePrevia,
    });
    cache = { en: t, estado };
    return estado;
}
/** Solo para las pruebas. */
function _vaciarCacheTv() { cache = null; }
//# sourceMappingURL=tv.service.js.map