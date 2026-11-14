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
exports.sincronizarIncumplidas = sincronizarIncumplidas;
const logger_js_1 = require("../config/logger.js");
const agenda_mapeo_js_1 = require("./agenda-mapeo.js");
const incumplidas_plan_js_1 = require("./incumplidas-plan.js");
const repo = __importStar(require("../repositories/incumplidas.repo.js"));
async function ejecutar(e, t) {
    const enRango = (f) => f.fechaDia >= t.desde && f.fechaDia <= t.hasta;
    // Solo las del rango pedido: si la API devolviera de más, no se pisa lo que no se pidió.
    const cumplidas = (0, agenda_mapeo_js_1.normalizarCitas)(await e.pedir(t.desde, t.hasta, 'C'), ['C']).filas.filter(enRango);
    const incumplidas = (0, agenda_mapeo_js_1.normalizarCitas)(await e.pedir(t.desde, t.hasta, 'I'), ['I']).filas.filter(enRango);
    const previas = await repo.contarVentana(e.conectorId, t.desde, t.hasta);
    if (!e.forzar && (0, incumplidas_plan_js_1.rangoSospechoso)(previas, { cumplidas: cumplidas.length, incumplidas: incumplidas.length })) {
        throw new Error(`Respuesta sospechosa de Medifolios entre ${t.desde} y ${t.hasta}: ${cumplidas.length} cumplidas y ${incumplidas.length} incumplidas `
            + `(ya había ${previas.cumplidas} y ${previas.incumplidas} guardadas). Se conservan las anteriores: vaciar o diezmar lo guardado, o traer `
            + 'muchas de un estado y ninguna del otro, es un fallo de la respuesta y no un hecho. «Sincronizar citas ahora» la acepta de todos modos.');
    }
    await repo.reemplazarVentana(e.conectorId, t.desde, t.hasta, (0, incumplidas_plan_js_1.agregarPorDiaEntidad)(cumplidas, incumplidas, e.entidadDe));
    return { cumplidas: cumplidas.length, incumplidas: incumplidas.length };
}
async function sincronizarIncumplidas(e) {
    const estado = await repo.leerEstado(e.conectorId);
    await repo.guardarEstado(e.conectorId, { ultimoIntento: e.ahora.toISOString() });
    const hechas = [];
    let cob = { desde: estado?.desde ?? null, hasta: estado?.hasta ?? null, ultimoDiario: estado?.ultimoDiario ?? null };
    const correr = async (t) => {
        const n = await ejecutar(e, t);
        hechas.push({ tipo: t.tipo, desde: t.desde, hasta: t.hasta, ...n });
        // El avance se guarda tarea a tarea: si la siguiente falla, esto no se pierde. La cobertura es UN tramo sin
        // huecos: si la tarea no se pega al tramo viejo (mucho tiempo sin sincronizar), se reinicia.
        const tramo = (0, incumplidas_plan_js_1.aplicarTarea)(cob, t);
        cob = { ...cob, ...tramo, ...(t.tipo === 'diario' ? { ultimoDiario: e.hoy } : {}) };
        await repo.guardarEstado(e.conectorId, {
            desde: tramo.desde, hasta: tramo.hasta, estado: 'ok', error: null, ultimaOk: new Date().toISOString(),
            ...(t.tipo === 'diario' ? { ultimoDiario: e.hoy } : {}),
        });
    };
    try {
        for (const t of (0, incumplidas_plan_js_1.planBasico)(e.hoy, cob))
            await correr(t);
        // El histórico se calcula DESPUÉS, con la cobertura ya actualizada (si hubo hueco, el tramo empezó de nuevo), y
        // NO en la vuelta de la pasada diaria: esa ya carga un mes entero, y sumarle otro alargaría mucho el tiempo que
        // se ocupa a Medifolios (y el candado) en una sola vuelta.
        const h = hechas.some((x) => x.tipo === 'diario') ? null : (0, incumplidas_plan_js_1.tareaHistorica)(e.hoy, cob);
        if (h)
            await correr(h);
    }
    catch (err) {
        // La cobertura NO avanza y lo ya guardado se conserva; el error se ve en Diagnóstico.
        await repo.guardarEstado(e.conectorId, { estado: 'error', error: (err instanceof Error ? err.message : String(err)).slice(0, 600) }).catch(() => undefined);
        throw err;
    }
    logger_js_1.logger.info('Citas cumplidas e incumplidas sincronizadas', {
        conectorId: e.conectorId, tareas: hechas.map((h) => `${h.tipo}:${h.cumplidas}C/${h.incumplidas}I`).join(','),
    });
    return { tareas: hechas };
}
//# sourceMappingURL=incumplidas-sync.service.js.map