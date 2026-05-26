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
exports.reportesService = void 0;
const redis_js_1 = require("../config/redis.js");
const logger_js_1 = require("../config/logger.js");
const repo = __importStar(require("../repositories/reportes.repo.js"));
// Colombia is UTC-5 with no DST. All "today" logic must use Colombia time,
// not the UTC clock of the Hostinger server.
function getColombiaDate() {
    return new Date(Date.now() - 5 * 60 * 60 * 1000);
}
// ─── Cache helpers ────────────────────────────────────────────────────────────
const DIA_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
async function cacheGet(key) {
    try {
        const redis = (0, redis_js_1.getRedisClient)();
        const raw = await redis.get(key);
        if (!raw)
            return null;
        return JSON.parse(raw);
    }
    catch (err) {
        logger_js_1.logger.warn('Redis GET failed', { key, error: err.message });
        return null;
    }
}
async function cacheSet(key, value, ttlSeconds) {
    try {
        const redis = (0, redis_js_1.getRedisClient)();
        await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
    catch (err) {
        logger_js_1.logger.warn('Redis SET failed', { key, error: err.message });
    }
}
// Returns a cache key that includes the date range so range queries never
// collide with month-mode cached results.
function makeCacheKey(base, mesIdx, anio, startDate, endDate, extra) {
    const dateSegment = startDate && endDate
        ? `range:${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`
        : `${mesIdx}:${anio}`;
    return extra ? `${base}:${dateSegment}:${extra}` : `${base}:${dateSegment}`;
}
// ─── Business day helpers ─────────────────────────────────────────────────────
/**
 * Returns the number of remaining Mon-Fri days in the month from today (exclusive).
 */
function diasHabilesRestantes(mesIdx, anio) {
    const today = getColombiaDate(); // use clinic's local calendar, not server UTC
    const todayDate = today.getUTCDate();
    const todayMonth = today.getUTCMonth() + 1;
    const todayYear = today.getUTCFullYear();
    // Last day of the month
    const lastDay = new Date(Date.UTC(anio, mesIdx, 0)).getUTCDate();
    let remaining = 0;
    const startDay = (todayYear === anio && todayMonth === mesIdx) ? todayDate + 1 : 1;
    for (let d = startDay; d <= lastDay; d++) {
        const dow = new Date(Date.UTC(anio, mesIdx - 1, d)).getUTCDay();
        if (dow >= 1 && dow <= 5)
            remaining++;
    }
    return remaining;
}
/**
 * Splits a month into Sun-Sat week segments.
 */
function getSemanasDelMes(mesIdx, anio) {
    const firstDay = new Date(Date.UTC(anio, mesIdx - 1, 1));
    const lastDay = new Date(Date.UTC(anio, mesIdx, 0));
    const semanas = [];
    let current = new Date(firstDay);
    let weekNum = 1;
    while (current <= lastDay) {
        const ini = new Date(current);
        // Find the next Saturday (or end of month)
        const dow = current.getUTCDay(); // 0=Sun
        const daysUntilSat = dow === 0 ? 6 : 6 - dow;
        const fin = new Date(current);
        fin.setUTCDate(fin.getUTCDate() + daysUntilSat);
        if (fin > lastDay)
            fin.setTime(lastDay.getTime());
        semanas.push({ numero: weekNum++, ini, fin });
        current = new Date(fin);
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return semanas;
}
/**
 * Splits an arbitrary date range into Sun-Sat week segments.
 */
function getSemanasEnRango(startDate, endDate) {
    const semanas = [];
    let current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    let weekNum = 1;
    while (current <= endDate) {
        const ini = new Date(current);
        const dow = current.getUTCDay();
        const daysUntilSat = dow === 0 ? 6 : 6 - dow;
        const fin = new Date(current);
        fin.setUTCDate(fin.getUTCDate() + daysUntilSat);
        if (fin > endDate)
            fin.setTime(endDate.getTime());
        semanas.push({ numero: weekNum++, ini, fin });
        current = new Date(fin);
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return semanas;
}
/**
 * Sum of monthly presupuestos for all months that overlap with the date range.
 */
async function getPresupuestoParaRango(startDate, endDate) {
    const months = [];
    const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    while (cur <= lastMonth) {
        months.push({ anio: cur.getUTCFullYear(), mes: cur.getUTCMonth() + 1 });
        cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    const values = await Promise.all(months.map((m) => repo.getPresupuesto(m.anio, m.mes)));
    return values.reduce((sum, v) => sum + v, 0);
}
// ─── Service class ────────────────────────────────────────────────────────────
class ReportesService {
    async getKpis(params) {
        const { mesIdx, anio, entidadId, startDate, endDate, diaSemana } = params;
        const isRangeMode = Boolean(startDate && endDate);
        // Cache key must encode the date range so range queries never hit month-mode cache
        const cacheKey = makeCacheKey('kpis', mesIdx, anio, startDate, endDate, entidadId) + (diaSemana !== undefined ? `:d${diaSemana}` : '');
        const cached = await cacheGet(cacheKey);
        if (cached)
            return cached;
        const [agregado, diasTranscurridos, facturacionHoy] = await Promise.all([
            repo.getAgregadoMes(mesIdx, anio, entidadId, startDate, endDate, diaSemana),
            repo.getDiasTranscurridos(mesIdx, anio, startDate, endDate),
            repo.getFacturacionDia(getColombiaDate()),
        ]);
        // For range mode sum all monthly budgets that overlap the range
        const presupuesto = isRangeMode && startDate && endDate
            ? await getPresupuestoParaRango(startDate, endDate)
            : await repo.getPresupuesto(anio, mesIdx);
        const { total: facturacionBruta, atenciones } = agregado;
        // In range mode there are no future days to project — it's a historical view
        const diasRestantes = isRangeMode ? 0 : diasHabilesRestantes(mesIdx, anio);
        const promedioDiario = diasTranscurridos > 0 ? facturacionBruta / diasTranscurridos : 0;
        const proyeccionCierre = isRangeMode
            ? facturacionBruta
            : facturacionBruta + promedioDiario * diasRestantes;
        const cumplimientoPct = presupuesto > 0 ? (facturacionBruta / presupuesto) * 100 : 0;
        const proyeccionCumplimientoPct = presupuesto > 0 ? (proyeccionCierre / presupuesto) * 100 : 0;
        const ticketPromedio = atenciones > 0 ? facturacionBruta / atenciones : 0;
        // Weeks: span the actual range in range mode, otherwise the calendar month
        const semanas = isRangeMode && startDate && endDate
            ? getSemanasEnRango(startDate, endDate)
            : getSemanasDelMes(mesIdx, anio);
        const diarios = await repo.getDiariosDelMes(mesIdx, anio, startDate, endDate);
        const dailyMap = new Map();
        for (const d of diarios) {
            const key = d.fecha_dia.toISOString().slice(0, 10);
            dailyMap.set(key, Number(d.total));
        }
        const presupuestoSemanal = semanas.length > 0 ? presupuesto / semanas.length : 0;
        let semanasEnMeta = 0;
        for (const sem of semanas) {
            let ventaSemana = 0;
            const cur = new Date(sem.ini);
            while (cur <= sem.fin) {
                const key = cur.toISOString().slice(0, 10);
                ventaSemana += dailyMap.get(key) ?? 0;
                cur.setUTCDate(cur.getUTCDate() + 1);
            }
            const today = getColombiaDate();
            const semCerrada = sem.fin < today;
            if (semCerrada && ventaSemana >= presupuestoSemanal) {
                semanasEnMeta++;
            }
        }
        const result = {
            facturacion_bruta: facturacionBruta,
            presupuesto,
            cumplimiento_pct: Math.round(cumplimientoPct * 10) / 10,
            atenciones,
            ticket_promedio: Math.round(ticketPromedio),
            proyeccion_cierre: Math.round(proyeccionCierre),
            proyeccion_cumplimiento_pct: Math.round(proyeccionCumplimientoPct * 10) / 10,
            dias_transcurridos: diasTranscurridos,
            dias_restantes: diasRestantes,
            facturacion_hoy: facturacionHoy,
            promedio_diario: Math.round(promedioDiario),
            semanas_en_meta: semanasEnMeta,
            semanas_total: semanas.length,
        };
        await cacheSet(cacheKey, result, 30 * 60);
        return result;
    }
    async getEntidades(params) {
        const { mesIdx, anio, startDate, endDate, diaSemana } = params;
        const cacheKey = makeCacheKey('entidades', mesIdx, anio, startDate, endDate) + (diaSemana !== undefined ? `:d${diaSemana}` : '');
        const cached = await cacheGet(cacheKey);
        if (cached)
            return cached;
        const agg = await repo.getEntidadesAgg(mesIdx, anio, startDate, endDate, diaSemana);
        const totalGeneral = agg.reduce((sum, r) => sum + Number(r.valor_bruto), 0);
        const rows = agg.map((r) => ({
            id: r.entidad_id ?? null,
            entidad: r.nombre ?? 'SIN ENTIDAD',
            tipo: r.tipo ?? 'OTRO',
            es_grupo: r.es_grupo_caja ?? false,
            cantidad: Number(r.cantidad),
            valor_bruto: Number(r.valor_bruto),
            participacion_pct: totalGeneral > 0
                ? Math.round((Number(r.valor_bruto) / totalGeneral) * 1000) / 10
                : 0,
        }));
        const result = { rows, total: totalGeneral };
        await cacheSet(cacheKey, result, 30 * 60);
        return result;
    }
    async getCumplimientoSemanal(params) {
        const { mesIdx, anio, startDate, endDate } = params;
        const isRangeMode = Boolean(startDate && endDate);
        const cacheKey = makeCacheKey('cumplimiento', mesIdx, anio, startDate, endDate);
        const cached = await cacheGet(cacheKey);
        if (cached)
            return cached;
        const presupuesto = isRangeMode && startDate && endDate
            ? await getPresupuestoParaRango(startDate, endDate)
            : await repo.getPresupuesto(anio, mesIdx);
        const diarios = await repo.getDiariosDelMes(mesIdx, anio, startDate, endDate);
        const semanas = isRangeMode && startDate && endDate
            ? getSemanasEnRango(startDate, endDate)
            : getSemanasDelMes(mesIdx, anio);
        const dailyMap = new Map();
        for (const d of diarios) {
            const key = d.fecha_dia.toISOString().slice(0, 10);
            dailyMap.set(key, Number(d.total));
        }
        const presupuestoSemanal = semanas.length > 0 ? presupuesto / semanas.length : 0;
        const today = getColombiaDate();
        const rows = semanas.map((sem) => {
            let venta = 0;
            const cur = new Date(sem.ini);
            while (cur <= sem.fin) {
                const key = cur.toISOString().slice(0, 10);
                venta += dailyMap.get(key) ?? 0;
                cur.setUTCDate(cur.getUTCDate() + 1);
            }
            const cumplimientoPct = presupuestoSemanal > 0
                ? Math.round((venta / presupuestoSemanal) * 1000) / 10
                : 0;
            const estado = sem.fin < today
                ? 'CERRADA'
                : sem.ini <= today && today <= sem.fin
                    ? 'EN_CURSO'
                    : 'FUTURA';
            return {
                numero: sem.numero,
                fecha_ini: sem.ini.toISOString().slice(0, 10),
                fecha_fin: sem.fin.toISOString().slice(0, 10),
                estimado: Math.round(presupuestoSemanal),
                venta: Math.round(venta),
                cumplimiento_pct: cumplimientoPct,
                estado,
            };
        });
        const result = { semanas: rows };
        await cacheSet(cacheKey, result, 30 * 60);
        return result;
    }
    async getDiasSemana(params) {
        const { mesIdx, anio, startDate, endDate } = params;
        const cacheKey = startDate && endDate
            ? `diasemana:rango:${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`
            : `diasemana:${mesIdx}:${anio}`;
        const cached = await cacheGet(cacheKey);
        if (cached)
            return cached;
        const agg = await repo.getDiasSemanaAgg(mesIdx, anio, startDate, endDate);
        const rows = agg.map((r) => ({
            dia: DIA_NOMBRES[r.dia_num] ?? String(r.dia_num),
            dia_num: r.dia_num,
            promedio: Math.round(Number(r.promedio)),
            total: Math.round(Number(r.total)),
            atenciones: Number(r.atenciones),
        }));
        await cacheSet(cacheKey, rows, 60 * 60);
        return rows;
    }
    async getTendencia(params) {
        const { meses } = params;
        const cacheKey = `tendencia:${meses}`;
        const cached = await cacheGet(cacheKey);
        if (cached)
            return cached;
        const rawRows = await repo.getTendenciaMeses(meses);
        const MESES_ES = [
            '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
            'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
        ];
        const rows = await Promise.all(rawRows.map(async (r) => {
            const presupuesto = await repo.getPresupuesto(r.anio, r.mes_idx);
            return {
                mes: `${MESES_ES[r.mes_idx] ?? r.mes_idx} ${r.anio}`,
                anio: r.anio,
                mesIdx: r.mes_idx,
                total: Number(r.total),
                presupuesto,
            };
        }));
        await cacheSet(cacheKey, rows, 60 * 60);
        return rows;
    }
    async getServicios(params) {
        const { mesIdx, anio, startDate, endDate } = params;
        const cacheKey = makeCacheKey('servicios', mesIdx, anio, startDate, endDate);
        const cached = await cacheGet(cacheKey);
        if (cached)
            return cached;
        const agg = await repo.getServiciosAgg(mesIdx, anio, startDate, endDate);
        let sinClasificar = 0;
        let valorSinClasificar = 0;
        let emgCount = 0;
        let neuroCount = 0;
        const rows = [];
        for (const r of agg) {
            if (!r.servicio_id) {
                sinClasificar += r.total_filas;
                valorSinClasificar += r.valor_bruto;
                continue;
            }
            const esSesion = r.tipo_conteo === 'sesion';
            const row = {
                id: r.servicio_id,
                nombre: r.nombre ?? '(sin nombre)',
                tipo_conteo: r.tipo_conteo,
                orden: r.orden,
                cantidad: esSesion ? r.sesiones : r.total_filas,
                horas: esSesion ? r.total_filas : null,
                valor_bruto: r.valor_bruto,
            };
            rows.push(row);
            const nombreUp = (r.nombre ?? '').toUpperCase();
            if (nombreUp.includes('ELECTROMIOGRAFIA'))
                emgCount = r.total_filas;
            if (nombreUp.includes('NEUROCONDUCCION'))
                neuroCount = r.total_filas;
        }
        const result = {
            rows,
            sin_clasificar: sinClasificar,
            valor_sin_clasificar: valorSinClasificar,
            alerta_emg_neuro: emgCount > 0 && neuroCount > 0 && emgCount !== neuroCount,
            emg_count: emgCount,
            neuro_count: neuroCount,
        };
        await cacheSet(cacheKey, result, 30 * 60);
        return result;
    }
}
exports.reportesService = new ReportesService();
//# sourceMappingURL=reportes.service.js.map