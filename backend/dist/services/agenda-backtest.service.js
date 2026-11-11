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
exports.iniciarBacktest = iniciarBacktest;
const logger_js_1 = require("../config/logger.js");
const connector_service_js_1 = require("./connector.service.js");
const sync_lock_service_js_1 = require("./sync-lock.service.js");
const sheet_atencion_mapper_js_1 = require("./sheet-atencion-mapper.js");
const normalizacion_service_js_1 = require("./normalizacion.service.js");
const citas_sync_service_js_1 = require("./citas-sync.service.js");
const agenda_mapeo_js_1 = require("./agenda-mapeo.js");
const agenda_enriquecer_js_1 = require("./agenda-enriquecer.js");
const agenda_valoracion_js_1 = require("./agenda-valoracion.js");
const agenda_backtest_js_1 = require("./agenda-backtest.js");
const agenda_ventana_js_1 = require("./agenda-ventana.js");
const agenda_periodo_js_1 = require("./agenda-periodo.js");
const repo = __importStar(require("../repositories/agenda.repo.js"));
/**
 * Evalúa la valoración con el último mes cerrado. Ver `agenda-backtest.ts` para lo
 * que mide y lo que NO.
 *
 * Descarga las citas CUMPLIDAS e INCUMPLIDAS del mes (dos peticiones; no se pide
 * «todas» porque incluiría los huecos libres, que son miles y no sirven), las
 * valora con el historial ANTERIOR a ese mes y las compara por EPS contra lo
 * facturado. Corre en segundo plano con el candado del conector (comparte token
 * con la sincronización) y deja su estado en la base, para que se vea desde
 * cualquier proceso del servidor.
 */
function resolutoresDe(cache) {
    return {
        entidad: (nombre) => (0, sheet_atencion_mapper_js_1.resolveId)(nombre, cache.entidades),
        especialidadDe: (nombre) => {
            const id = (0, sheet_atencion_mapper_js_1.resolveId)(nombre, cache.profesionales);
            return id ? cache.profesionales.find((p) => p.id === id)?.especialidad ?? null : null;
        },
        servicioNombre: (referencia, especialidad) => {
            const id = (0, sheet_atencion_mapper_js_1.resolveServicioId)((0, normalizacion_service_js_1.normalizeDescripcion)(referencia), cache.servicios, especialidad, cache.specialtyUpgrade);
            return id ? cache.servicios.find((s) => s.id === id)?.nombre ?? null : null;
        },
    };
}
const pad = (n) => String(n).padStart(2, '0');
/**
 * Arranca la evaluación en segundo plano y responde enseguida.
 *
 * Si el candado está ocupado (una sincronización en curso, u otra evaluación) NO se
 * toca el estado guardado: antes se escribía un «error» que borraba el último
 * resultado bueno, o marcaba como fallida una evaluación que seguía corriendo.
 * Nunca lanza.
 */
async function iniciarBacktest(conectorId) {
    try {
        const candado = await (0, sync_lock_service_js_1.adquirirCandadoSync)(conectorId);
        if (!candado)
            return { iniciado: false, motivo: 'Ya hay una sincronización o una evaluación en curso; vuelve a intentarlo cuando termine.' };
        void ejecutarConCandado(conectorId, candado).catch((e) => logger_js_1.logger.error('Evaluación de la agenda: excepción inesperada', { conectorId, error: e instanceof Error ? e.message : String(e) }));
        return { iniciado: true };
    }
    catch (err) {
        const motivo = err instanceof Error ? err.message : String(err);
        logger_js_1.logger.error('No se pudo iniciar la evaluación de la agenda', { conectorId, error: motivo });
        return { iniciado: false, motivo };
    }
}
async function ejecutarConCandado(conectorId, candado) {
    const inicio = new Date().toISOString();
    try {
        await repo.guardarBacktest(conectorId, { estado: 'corriendo', iniciado: inicio, terminado: null, error: null, resultado: null });
        const conector = await connector_service_js_1.connectorService.getById(conectorId);
        const cfg = (0, citas_sync_service_js_1.configAgenda)(conector);
        if (!cfg)
            throw new Error('La agenda de citas no está activada en este conector');
        const { anio, mes } = (0, agenda_periodo_js_1.mesesCerradosPrevios)((0, agenda_ventana_js_1.hoyEnBogota)(new Date()), 1)[0];
        const primero = `${anio}-${pad(mes)}-01`;
        const ultimo = `${anio}-${pad(mes)}-${pad(new Date(Date.UTC(anio, mes, 0)).getUTCDate())}`;
        const [cumplidas, incumplidas] = [
            (0, agenda_mapeo_js_1.normalizarCitas)(await (0, citas_sync_service_js_1.pedirCitas)(conector, cfg, { fechaInicial: primero, fechaFinal: ultimo, estadoCita: 'C' }), ['C']).filas,
            (0, agenda_mapeo_js_1.normalizarCitas)(await (0, citas_sync_service_js_1.pedirCitas)(conector, cfg, { fechaInicial: primero, fechaFinal: ultimo, estadoCita: 'I' }), ['I']).filas,
        ];
        if (cumplidas.length === 0) {
            throw new Error(`Medifolios devolvió 0 citas cumplidas en ${anio}-${pad(mes)}: no hay con qué evaluar.`);
        }
        // El historial TERMINA donde empieza el mes evaluado: valorar con datos del
        // propio mes sería hacer trampa.
        const tabla = (0, agenda_valoracion_js_1.construirTablaPrecios)(await repo.historialVisitas((0, agenda_ventana_js_1.diasAntes)(primero, 90), primero));
        const cache = await (0, sheet_atencion_mapper_js_1.buildCache)();
        const resolutores = resolutoresDe(cache);
        const convenios = await repo.leerConvenios(conectorId);
        const epsPorConvenio = new Map(convenios.map((c) => [c.codConvenio, c.epsNombre]));
        const nombres = await repo.nombresEntidades();
        const evaluadas = [];
        for (const f of [...cumplidas, ...incumplidas]) {
            const { entidadId, grupo } = (0, agenda_enriquecer_js_1.enriquecerCita)(f, resolutores, epsPorConvenio);
            evaluadas.push({
                entidadKey: entidadId ?? `nombre:${f.convenioNombre || 'SIN ENTIDAD'}`,
                entidad: entidadId ? nombres.get(entidadId) ?? f.convenioNombre : (f.convenioNombre || 'SIN ENTIDAD'),
                estado: f.estado === 'I' ? 'I' : 'C',
                valor: f.estado === 'I' ? null : (0, agenda_valoracion_js_1.valorarCita)(tabla, entidadId, grupo).valor,
            });
        }
        const real = new Map();
        for (const r of await repo.facturadoPorEntidadMes(anio, mes)) {
            real.set(r.entidadId ?? 'nombre:SIN ENTIDAD', { entidad: r.entidad, valor: r.valor });
        }
        const resultado = (0, agenda_backtest_js_1.evaluarBacktest)(`${anio}-${pad(mes)}`, evaluadas, real);
        await repo.guardarBacktest(conectorId, { estado: 'ok', terminado: new Date().toISOString(), error: null, resultado });
        logger_js_1.logger.info('Evaluación de la agenda terminada', { conectorId, mes: resultado.mes, cobertura: resultado.total.cobertura, cumplidas: resultado.total.cumplidas });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger_js_1.logger.error('Falló la evaluación de la agenda', { conectorId, error: msg });
        await repo.guardarBacktest(conectorId, { estado: 'error', terminado: new Date().toISOString(), error: msg.slice(0, 1000), resultado: null }).catch(() => { });
    }
    finally {
        await candado.liberar();
    }
}
//# sourceMappingURL=agenda-backtest.service.js.map