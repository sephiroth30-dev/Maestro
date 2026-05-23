import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import * as repo from '../repositories/reportes.repo.js';

// ─── Result types ─────────────────────────────────────────────────────────────

export interface KpisResult {
  facturacion_bruta: number;
  presupuesto: number;
  cumplimiento_pct: number;
  atenciones: number;
  ticket_promedio: number;
  proyeccion_cierre: number;
  proyeccion_cumplimiento_pct: number;
  dias_transcurridos: number;
  dias_restantes: number;
  facturacion_hoy: number;
  promedio_diario: number;
  semanas_en_meta: number;
  semanas_total: number;
}

export interface EntidadRow {
  entidad: string;
  tipo: string;
  es_grupo: boolean;
  cantidad: number;
  valor_bruto: number;
  participacion_pct: number;
}

export interface SemanaRow {
  numero: number;
  fecha_ini: string;
  fecha_fin: string;
  estimado: number;
  venta: number;
  cumplimiento_pct: number;
  estado: 'CERRADA' | 'EN_CURSO' | 'FUTURA';
}

export interface DiaSemanaRow {
  dia: string;
  dia_num: number;
  promedio: number;
  total: number;
  atenciones: number;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

const DIA_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn('Redis GET failed', { key, error: (err as Error).message });
    return null;
  }
}

async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.warn('Redis SET failed', { key, error: (err as Error).message });
  }
}

// Returns a cache key that includes the date range so range queries never
// collide with month-mode cached results.
function makeCacheKey(base: string, mesIdx: number, anio: number, startDate?: Date, endDate?: Date, extra?: string): string {
  const dateSegment = startDate && endDate
    ? `range:${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`
    : `${mesIdx}:${anio}`;
  return extra ? `${base}:${dateSegment}:${extra}` : `${base}:${dateSegment}`;
}

// ─── Business day helpers ─────────────────────────────────────────────────────

/**
 * Returns the number of remaining Mon-Fri days in the month from today (exclusive).
 */
function diasHabilesRestantes(mesIdx: number, anio: number): number {
  const today = new Date();
  const todayDate = today.getUTCDate();
  const todayMonth = today.getUTCMonth() + 1;
  const todayYear = today.getUTCFullYear();

  // Last day of the month
  const lastDay = new Date(Date.UTC(anio, mesIdx, 0)).getUTCDate();

  let remaining = 0;
  const startDay = (todayYear === anio && todayMonth === mesIdx) ? todayDate + 1 : 1;

  for (let d = startDay; d <= lastDay; d++) {
    const dow = new Date(Date.UTC(anio, mesIdx - 1, d)).getUTCDay();
    if (dow >= 1 && dow <= 5) remaining++;
  }

  return remaining;
}

/**
 * Splits a month into Sun-Sat week segments.
 */
function getSemanasDelMes(
  mesIdx: number,
  anio: number
): Array<{ numero: number; ini: Date; fin: Date }> {
  const firstDay = new Date(Date.UTC(anio, mesIdx - 1, 1));
  const lastDay = new Date(Date.UTC(anio, mesIdx, 0));

  const semanas: Array<{ numero: number; ini: Date; fin: Date }> = [];
  let current = new Date(firstDay);
  let weekNum = 1;

  while (current <= lastDay) {
    const ini = new Date(current);
    // Find the next Saturday (or end of month)
    const dow = current.getUTCDay(); // 0=Sun
    const daysUntilSat = dow === 0 ? 6 : 6 - dow;
    const fin = new Date(current);
    fin.setUTCDate(fin.getUTCDate() + daysUntilSat);
    if (fin > lastDay) fin.setTime(lastDay.getTime());

    semanas.push({ numero: weekNum++, ini, fin });
    current = new Date(fin);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return semanas;
}

/**
 * Splits an arbitrary date range into Sun-Sat week segments.
 */
function getSemanasEnRango(
  startDate: Date,
  endDate: Date,
): Array<{ numero: number; ini: Date; fin: Date }> {
  const semanas: Array<{ numero: number; ini: Date; fin: Date }> = [];
  let current = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
  let weekNum = 1;

  while (current <= endDate) {
    const ini = new Date(current);
    const dow = current.getUTCDay();
    const daysUntilSat = dow === 0 ? 6 : 6 - dow;
    const fin = new Date(current);
    fin.setUTCDate(fin.getUTCDate() + daysUntilSat);
    if (fin > endDate) fin.setTime(endDate.getTime());

    semanas.push({ numero: weekNum++, ini, fin });
    current = new Date(fin);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return semanas;
}

/**
 * Sum of monthly presupuestos for all months that overlap with the date range.
 */
async function getPresupuestoParaRango(startDate: Date, endDate: Date): Promise<number> {
  const months: Array<{ anio: number; mes: number }> = [];
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
  async getKpis(params: {
    mesIdx: number;
    anio: number;
    entidadId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<KpisResult> {
    const { mesIdx, anio, entidadId, startDate, endDate } = params;
    const isRangeMode = Boolean(startDate && endDate);

    // Cache key must encode the date range so range queries never hit month-mode cache
    const cacheKey = makeCacheKey('kpis', mesIdx, anio, startDate, endDate, entidadId);

    const cached = await cacheGet<KpisResult>(cacheKey);
    if (cached) return cached;

    const [agregado, diasTranscurridos, facturacionHoy] = await Promise.all([
      repo.getAgregadoMes(mesIdx, anio, entidadId, startDate, endDate),
      repo.getDiasTranscurridos(mesIdx, anio, startDate, endDate),
      repo.getFacturacionDia(new Date()),
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
    const dailyMap = new Map<string, number>();
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
      const today = new Date();
      const semCerrada = sem.fin < today;
      if (semCerrada && ventaSemana >= presupuestoSemanal) {
        semanasEnMeta++;
      }
    }

    const result: KpisResult = {
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

  async getEntidades(params: {
    mesIdx: number;
    anio: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ rows: EntidadRow[]; total: number }> {
    const { mesIdx, anio, startDate, endDate } = params;
    const cacheKey = makeCacheKey('entidades', mesIdx, anio, startDate, endDate);

    const cached = await cacheGet<{ rows: EntidadRow[]; total: number }>(cacheKey);
    if (cached) return cached;

    const agg = await repo.getEntidadesAgg(mesIdx, anio, startDate, endDate);

    const totalGeneral = agg.reduce((sum, r) => sum + Number(r.valor_bruto), 0);

    const rows: EntidadRow[] = agg.map((r) => ({
      entidad: r.nombre ?? 'SIN ENTIDAD',
      tipo: r.tipo ?? 'OTRO',
      es_grupo: r.es_grupo_caja ?? false,
      cantidad: Number(r.cantidad),
      valor_bruto: Number(r.valor_bruto),
      participacion_pct:
        totalGeneral > 0
          ? Math.round((Number(r.valor_bruto) / totalGeneral) * 1000) / 10
          : 0,
    }));

    const result = { rows, total: totalGeneral };
    await cacheSet(cacheKey, result, 30 * 60);
    return result;
  }

  async getCumplimientoSemanal(params: {
    mesIdx: number;
    anio: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ semanas: SemanaRow[] }> {
    const { mesIdx, anio, startDate, endDate } = params;
    const isRangeMode = Boolean(startDate && endDate);
    const cacheKey = makeCacheKey('cumplimiento', mesIdx, anio, startDate, endDate);

    const cached = await cacheGet<{ semanas: SemanaRow[] }>(cacheKey);
    if (cached) return cached;

    const presupuesto = isRangeMode && startDate && endDate
      ? await getPresupuestoParaRango(startDate, endDate)
      : await repo.getPresupuesto(anio, mesIdx);
    const diarios = await repo.getDiariosDelMes(mesIdx, anio, startDate, endDate);
    const semanas = isRangeMode && startDate && endDate
      ? getSemanasEnRango(startDate, endDate)
      : getSemanasDelMes(mesIdx, anio);

    const dailyMap = new Map<string, number>();
    for (const d of diarios) {
      const key = d.fecha_dia.toISOString().slice(0, 10);
      dailyMap.set(key, Number(d.total));
    }

    const presupuestoSemanal = semanas.length > 0 ? presupuesto / semanas.length : 0;
    const today = new Date();

    const rows: SemanaRow[] = semanas.map((sem) => {
      let venta = 0;
      const cur = new Date(sem.ini);
      while (cur <= sem.fin) {
        const key = cur.toISOString().slice(0, 10);
        venta += dailyMap.get(key) ?? 0;
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      const cumplimientoPct =
        presupuestoSemanal > 0
          ? Math.round((venta / presupuestoSemanal) * 1000) / 10
          : 0;

      const estado: SemanaRow['estado'] =
        sem.fin < today
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

  async getDiasSemana(params: {
    mesIdx: number;
    anio: number;
  }): Promise<DiaSemanaRow[]> {
    const { mesIdx, anio } = params;
    const cacheKey = `diasemana:${mesIdx}:${anio}`;

    const cached = await cacheGet<DiaSemanaRow[]>(cacheKey);
    if (cached) return cached;

    const agg = await repo.getDiasSemanaAgg(mesIdx, anio);

    const rows: DiaSemanaRow[] = agg.map((r) => ({
      dia: DIA_NOMBRES[r.dia_num] ?? String(r.dia_num),
      dia_num: r.dia_num,
      promedio: Math.round(Number(r.promedio)),
      total: Math.round(Number(r.total)),
      atenciones: Number(r.atenciones),
    }));

    await cacheSet(cacheKey, rows, 60 * 60);
    return rows;
  }

  async getTendencia(params: {
    meses: number;
  }): Promise<Array<{ mes: string; anio: number; mesIdx: number; total: number; presupuesto: number }>> {
    const { meses } = params;
    const cacheKey = `tendencia:${meses}`;

    const cached = await cacheGet<
      Array<{ mes: string; anio: number; mesIdx: number; total: number; presupuesto: number }>
    >(cacheKey);
    if (cached) return cached;

    const rawRows = await repo.getTendenciaMeses(meses);

    const MESES_ES = [
      '', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
    ];

    const rows = await Promise.all(
      rawRows.map(async (r) => {
        const presupuesto = await repo.getPresupuesto(r.anio, r.mes_idx);
        return {
          mes: `${MESES_ES[r.mes_idx] ?? r.mes_idx} ${r.anio}`,
          anio: r.anio,
          mesIdx: r.mes_idx,
          total: Number(r.total),
          presupuesto,
        };
      })
    );

    await cacheSet(cacheKey, rows, 60 * 60);
    return rows;
  }
}

export const reportesService = new ReportesService();
