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
exports.actualizarCitasDia = actualizarCitasDia;
const logger_js_1 = require("../config/logger.js");
const agenda_mapeo_js_1 = require("./agenda-mapeo.js");
const tv_movimientos_js_1 = require("./tv-movimientos.js");
const tvRepo = __importStar(require("../repositories/tv.repo.js"));
const reportesRepo = __importStar(require("../repositories/reportes.repo.js"));
const agenda_ventana_js_1 = require("./agenda-ventana.js");
/**
 * Citas de HOY en todos los estados, y lo que se movió desde la lectura anterior.
 *
 * Se llama desde la sincronización de citas, DENTRO del candado del conector (usa la
 * misma credencial): dos peticiones pequeñas más (hoy en cumplidas y en incumplidas).
 * Las pendientes ya vienen de la petición principal.
 *
 * Nunca debe estropear la sincronización de la agenda: quien la llama captura sus
 * errores. Si algo falla aquí, la TV conserva la lectura anterior y lo dice
 * («actualizado hace…»).
 */
const CONSERVAR_MOVIMIENTOS_MS = 48 * 3_600_000;
const CONSERVAR_SERIE_MS = 60 * 24 * 3_600_000;
const horaDe = (fechaCita) => {
    const h = Number(fechaCita.slice(11, 13));
    return Number.isFinite(h) && h >= 0 && h <= 23 ? h : 0;
};
function aCitasDia(filas, estado) {
    return filas.map((f) => ({ cod: f.codAsignacion, hora: horaDe(f.fechaCita), estado }));
}
async function actualizarCitasDia(e) {
    const movimientos = [];
    // 1. Citas nuevas en la agenda (no depende de las peticiones de hoy).
    movimientos.push(...(0, tv_movimientos_js_1.movimientosAgenda)(e.codigosAgendaPrevios, e.pendientes.map((p) => p.codAsignacion), (0, tv_movimientos_js_1.mismaVentanaDeCitas)(e.ultimaOkPrevia, e.ahora)));
    // 2. Hoy en cumplidas e incumplidas. Si falla, se lanza: no se reemplaza nada y la TV sigue con la
    //    lectura anterior. Lo agendado ya detectado NO se pierde: la agenda ya se reemplazó y esas citas
    //    no volverían a salir como nuevas.
    let cumplidas;
    let incumplidas;
    try {
        cumplidas = (0, agenda_mapeo_js_1.normalizarCitas)(await e.pedir('C'), ['C']).filas.filter((f) => f.fechaDia === e.hoy);
        incumplidas = (0, agenda_mapeo_js_1.normalizarCitas)(await e.pedir('I'), ['I']).filas.filter((f) => f.fechaDia === e.hoy);
    }
    catch (err) {
        await tvRepo.insertarMovimientos(movimientos, e.ahora).catch(() => undefined);
        throw err;
    }
    const pendientesHoy = e.pendientes.filter((p) => p.fechaDia === e.hoy);
    // 3. La lectura anterior DE HOY (si es de ayer o muy vieja, no se compara).
    const previa = await tvRepo.leerCitasDia(e.conectorId);
    const syncPrevia = previa ? Date.parse(`${previa.syncEn.replace(' ', 'T')}Z`) : NaN;
    const comparable = previa !== null && previa.fechaDia === e.hoy
        && Number.isFinite(syncPrevia) && e.ahora.getTime() - syncPrevia < tv_movimientos_js_1.LECTURA_PREVIA_MAX_MS;
    let actuales = (0, tv_movimientos_js_1.unirCitasDia)(aCitasDia(pendientesHoy, 'P'), aCitasDia(cumplidas, 'C'), aCitasDia(incumplidas, 'I'));
    // Las cumplidas e incumplidas de un día SOLO CRECEN. Si la API respondió vacía o incompleta (una
    // página corta, un fallo a medias) y se guardara tal cual, la siguiente lectura correcta las
    // contaría como «+N atendidas» falsas. Se arrastran las de la lectura anterior que no aparecen.
    if (comparable) {
        const vistas = new Set(actuales.map((c) => c.cod));
        for (const c of previa.citas)
            if (c.estado !== 'P' && !vistas.has(c.cod))
                actuales.push(c);
    }
    movimientos.push(...(0, tv_movimientos_js_1.movimientosCitasDia)(comparable ? new Map(previa.citas.map((c) => [c.cod, c.estado])) : null, actuales));
    // La lectura y sus movimientos, en UNA transacción.
    await tvRepo.reemplazarCitasDia(e.conectorId, e.hoy, actuales, e.ahora, movimientos);
    await tvRepo.purgarMovimientos(new Date(e.ahora.getTime() - CONSERVAR_MOVIMIENTOS_MS)).catch(() => { });
    // Una foto de las cifras del día para el gráfico y la comparación con ayer. Aquí y no tras los
    // consumos: esta vuelta ya corrió DESPUÉS de la sincronización de consumos (mismo candado), así
    // que el facturado es el más reciente, y las citas de hoy ya están leídas. Si falla, no importa.
    // SOLO en horario de trabajo (lunes a sábado, 6:00–19:59): los consumos y las citas también se
    // sincronizan de noche y en domingo, y esas fotos (facturado 0) harían que el lunes el «día anterior»
    // fuera el domingo y todo lo facturado saliera como «▲ +$X vs ayer».
    try {
        if (!(0, agenda_ventana_js_1.enHorarioLaboral)(e.ahora))
            return { movimientos, citas: actuales.length };
        await tvRepo.insertarFoto({
            ts: e.ahora, fechaDia: e.hoy,
            // Mismo cálculo que `facturacion_hoy` de Reportes (hora de Colombia, fuente activa).
            facturado: await reportesRepo.getFacturacionDia(new Date(e.ahora.getTime() - 5 * 3_600_000)),
            atendidas: actuales.filter((c) => c.estado === 'C').length,
            pendientes: actuales.filter((c) => c.estado === 'P').length,
            incumplidas: actuales.filter((c) => c.estado === 'I').length,
        });
        await tvRepo.purgarSerie(new Date(e.ahora.getTime() - CONSERVAR_SERIE_MS)).catch(() => { });
    }
    catch (err) {
        logger_js_1.logger.warn('TV: no se pudo guardar la foto del día', { conectorId: e.conectorId, error: err instanceof Error ? err.message : String(err) });
    }
    logger_js_1.logger.info('Citas de hoy actualizadas', {
        conectorId: e.conectorId, citas: actuales.length, comparable,
        movimientos: movimientos.map((m) => `${m.tipo}:${m.cantidad}`).join(','),
    });
    return { movimientos, citas: actuales.length };
}
//# sourceMappingURL=citas-dia.service.js.map