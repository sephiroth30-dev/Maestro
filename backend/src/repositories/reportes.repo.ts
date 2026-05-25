import { pool } from '../config/prisma.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { randomUUID } from 'node:crypto';

// ─── Types returned by raw repo queries ──────────────────────────────────────

export interface AggregadoMes {
  total: number;
  atenciones: number;
}

export interface FacHoyResult {
  total: number;
}

export interface DiasTranscurridosResult {
  dias: number;
}

export interface EntidadAggRow {
  entidad_id: string | null;
  nombre: string | null;
  tipo: string | null;
  es_grupo_caja: boolean | null;
  cantidad: number;
  valor_bruto: number;
}

export interface FechasDelMes {
  fecha_dia: Date;
}

export interface TendenciaRow {
  anio: number;
  mes_idx: number;
  total: number;
}

export interface PresupuestoRow {
  anio: number;
  mes: number;
  monto: number;
  notas: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a [whereClause, params] tuple for filtering atenciones by date range
 * or by mes_idx/anio.
 */
function buildDateWhere(
  mesIdx?: number,
  anio?: number,
  startDate?: Date,
  endDate?: Date,
  diaSemana?: number, // MySQL DAYOFWEEK: 2=Lun, 3=Mar, 4=Mié, 5=Jue, 6=Vie
): [string, (Date | number)[]] {
  let clause: string;
  let params: (Date | number)[];

  if (startDate && endDate) {
    clause = 'fecha_dia >= ? AND fecha_dia <= ?';
    params = [startDate, endDate];
  } else {
    clause = 'mes_idx = ? AND anio = ?';
    params = [mesIdx ?? 0, anio ?? 0];
  }

  if (diaSemana !== undefined) {
    clause += ' AND DAYOFWEEK(fecha_dia) = ?';
    params.push(diaSemana);
  }

  return [clause, params];
}

// ─── Repository ───────────────────────────────────────────────────────────────

export async function getAgregadoMes(
  mesIdx: number,
  anio: number,
  entidadId?: string,
  startDate?: Date,
  endDate?: Date,
  diaSemana?: number,
): Promise<{ total: number; atenciones: number }> {
  const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate, diaSemana);
  // Sum ALL records — es_grupo_caja (PARTICULARES etc.) is real income and must count.
  // That flag is only used for visual grouping in charts, not for filtering totals.
  let sql = `SELECT SUM(valor_bruto) AS total, COUNT(id) AS cnt FROM atenciones WHERE ${whereClause}`;
  const allParams: (Date | number | string)[] = [...params];

  if (entidadId) {
    sql += ' AND entidad_id = ?';
    allParams.push(entidadId);
  }

  const [rows] = await pool.query<(RowDataPacket & { total: string | null; cnt: string })[]>(
    sql,
    allParams
  );
  return {
    total: Number(rows[0]?.total ?? 0),
    atenciones: Number(rows[0]?.cnt ?? 0),
  };
}

export async function getFacturacionDia(fecha: Date): Promise<number> {
  const startOfDay = new Date(fecha);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(fecha);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const [rows] = await pool.query<(RowDataPacket & { total: string | null })[]>(
    'SELECT SUM(valor_bruto) AS total FROM atenciones WHERE fecha_dia >= ? AND fecha_dia <= ?',
    [startOfDay, endOfDay]
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getDiasTranscurridos(
  mesIdx: number,
  anio: number,
  startDate?: Date,
  endDate?: Date,
): Promise<number> {
  const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
  const [rows] = await pool.query<(RowDataPacket & { cnt: string })[]>(
    `SELECT COUNT(DISTINCT DATE(fecha_dia)) AS cnt FROM atenciones WHERE ${whereClause}`,
    params
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function getFechasDelMes(
  mesIdx: number,
  anio: number
): Promise<Date[]> {
  const [rows] = await pool.query<(RowDataPacket & { fecha_dia: Date })[]>(
    'SELECT DISTINCT fecha_dia FROM atenciones WHERE mes_idx = ? AND anio = ? ORDER BY fecha_dia ASC',
    [mesIdx, anio]
  );
  return rows.map((r) => r.fecha_dia);
}

export async function getEntidadesAgg(
  mesIdx: number,
  anio: number,
  startDate?: Date,
  endDate?: Date,
  diaSemana?: number,
): Promise<EntidadAggRow[]> {
  const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate, diaSemana);
  const [rows] = await pool.query<(RowDataPacket & EntidadAggRow)[]>(
    `SELECT
      a.entidad_id,
      e.nombre,
      e.tipo,
      e.es_grupo_caja,
      COUNT(a.id) AS cantidad,
      SUM(a.valor_bruto) AS valor_bruto
    FROM atenciones a
    LEFT JOIN entidades e ON e.id = a.entidad_id
    WHERE ${whereClause}
    GROUP BY a.entidad_id, e.nombre, e.tipo, e.es_grupo_caja
    ORDER BY valor_bruto DESC`,
    params
  );
  return rows.map((r) => ({
    entidad_id: r.entidad_id,
    nombre: r.nombre,
    tipo: r.tipo,
    es_grupo_caja: r.es_grupo_caja,
    cantidad: Number(r.cantidad),
    valor_bruto: Number(r.valor_bruto),
  }));
}

export async function getDiariosDelMes(
  mesIdx: number,
  anio: number,
  startDate?: Date,
  endDate?: Date,
): Promise<Array<{ fecha_dia: Date; total: number; atenciones: number }>> {
  const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
  const [rows] = await pool.query<(RowDataPacket & { fecha_dia: string; total: string; atenciones: string })[]>(
    `SELECT
      DATE(fecha_dia) AS fecha_dia,
      SUM(valor_bruto) AS total,
      COUNT(id) AS atenciones
    FROM atenciones
    WHERE ${whereClause}
    GROUP BY DATE(fecha_dia)
    ORDER BY DATE(fecha_dia) ASC`,
    params
  );
  return rows.map((r) => ({
    fecha_dia: new Date(r.fecha_dia + 'T00:00:00.000Z'),
    total: Number(r.total),
    atenciones: Number(r.atenciones),
  }));
}

export async function getDiasSemanaAgg(
  mesIdx: number,
  anio: number,
  startDate?: Date,
  endDate?: Date,
): Promise<Array<{ dia_num: number; promedio: number; total: number; atenciones: number }>> {
  const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
  const [rows] = await pool.query<(RowDataPacket & { dia_num: number; promedio: string; total: string; atenciones: string })[]>(
    `SELECT
      (DAYOFWEEK(fecha_dia) - 1) AS dia_num,
      AVG(valor_bruto)           AS promedio,
      SUM(valor_bruto)           AS total,
      COUNT(id)                  AS atenciones
    FROM atenciones
    WHERE ${whereClause}
      AND DAYOFWEEK(fecha_dia) BETWEEN 2 AND 6
    GROUP BY dia_num
    ORDER BY dia_num ASC`,
    params
  );
  return rows.map((r) => ({
    dia_num: Number(r.dia_num),
    promedio: Number(r.promedio),
    total: Number(r.total),
    atenciones: Number(r.atenciones),
  }));
}

export async function getTendenciaMeses(
  meses: number
): Promise<Array<{ anio: number; mes_idx: number; total: number }>> {
  // Subquery: pick the N most-recent months, then re-sort ascending for display.
  const [rows] = await pool.query<(RowDataPacket & { anio: number; mes_idx: number; total: string })[]>(
    `SELECT anio, mes_idx, total FROM (
       SELECT anio, mes_idx, SUM(valor_bruto) AS total
       FROM atenciones
       GROUP BY anio, mes_idx
       ORDER BY anio DESC, mes_idx DESC
       LIMIT ?
     ) sub
     ORDER BY anio ASC, mes_idx ASC`,
    [meses]
  );
  return rows.map((r) => ({
    anio: Number(r.anio),
    mes_idx: Number(r.mes_idx),
    total: Number(r.total),
  }));
}

export async function getPresupuesto(anio: number, mes: number): Promise<number> {
  const [rows] = await pool.query<(RowDataPacket & { monto: string | null })[]>(
    'SELECT monto FROM presupuestos_mensuales WHERE anio = ? AND mes = ? LIMIT 1',
    [anio, mes]
  );
  return Number(rows[0]?.monto ?? 0);
}

export async function listPresupuestos(): Promise<
  Array<{ id: string; anio: number; mes: number; monto: number; notas: string | null; createdAt: Date }>
> {
  const [rows] = await pool.query<(RowDataPacket & { id: string; anio: number; mes: number; monto: string; notas: string | null; created_at: Date })[]>(
    'SELECT id, anio, mes, monto, notas, created_at FROM presupuestos_mensuales ORDER BY anio ASC, mes ASC'
  );
  return rows.map((r) => ({
    id: r.id,
    anio: Number(r.anio),
    mes: Number(r.mes),
    monto: Number(r.monto),
    notas: r.notas,
    createdAt: r.created_at,
  }));
}

// ─── Entidades catalog (config) ───────────────────────────────────────────────

export interface EntidadCatalogRow {
  id: string;
  nombre: string;
  tipo: string;
  es_grupo_caja: boolean;
  activa: boolean;
}

export async function listEntidades(): Promise<EntidadCatalogRow[]> {
  const [rows] = await pool.query<(RowDataPacket & { id: string; nombre: string; tipo: string; es_grupo_caja: number; activa: number })[]>(
    'SELECT id, nombre, tipo, es_grupo_caja, activa FROM entidades ORDER BY tipo ASC, nombre ASC'
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    es_grupo_caja: Boolean(r.es_grupo_caja),
    activa: Boolean(r.activa),
  }));
}

export async function updateEntidadGrupoCaja(id: string, esGrupoCaja: boolean): Promise<void> {
  await pool.execute<ResultSetHeader>(
    'UPDATE entidades SET es_grupo_caja = ? WHERE id = ?',
    [esGrupoCaja ? 1 : 0, id]
  );
}

// ─── Diagnostic: totals per connector per month ──────────────────────────────

export interface DiagnosticoRow {
  conector_id: string;
  conector_nombre: string;
  anio: number;
  mes_idx: number;
  atenciones: number;
  valor_bruto: number;
  sin_entidad: number;
  sin_valor: number;
}

export async function getDiagnosticoConectores(): Promise<DiagnosticoRow[]> {
  const [rows] = await pool.query<(RowDataPacket & {
    conector_id: string; conector_nombre: string;
    anio: number; mes_idx: number;
    atenciones: string; valor_bruto: string; sin_entidad: string; sin_valor: string;
  })[]>(
    `SELECT
      a.conector_id,
      COALESCE(c.nombre, a.conector_id) AS conector_nombre,
      a.anio,
      a.mes_idx,
      COUNT(a.id)                              AS atenciones,
      SUM(a.valor_bruto)                       AS valor_bruto,
      SUM(CASE WHEN a.entidad_id IS NULL THEN 1 ELSE 0 END) AS sin_entidad,
      SUM(CASE WHEN a.valor_bruto = 0   THEN 1 ELSE 0 END) AS sin_valor
    FROM atenciones a
    LEFT JOIN conectores c ON c.id = a.conector_id
    GROUP BY a.conector_id, c.nombre, a.anio, a.mes_idx
    ORDER BY a.anio DESC, a.mes_idx DESC, conector_nombre ASC`
  );
  return rows.map((r) => ({
    conector_id:     r.conector_id,
    conector_nombre: r.conector_nombre,
    anio:            Number(r.anio),
    mes_idx:         Number(r.mes_idx),
    atenciones:      Number(r.atenciones),
    valor_bruto:     Number(r.valor_bruto),
    sin_entidad:     Number(r.sin_entidad),
    sin_valor:       Number(r.sin_valor),
  }));
}

export async function upsertPresupuesto(
  anio: number,
  mes: number,
  monto: number,
  notas?: string
): Promise<{ id: string; anio: number; mes: number; monto: number; notas: string | null }> {
  // Check if row already exists to get its id
  const [existing] = await pool.query<(RowDataPacket & { id: string })[]>(
    'SELECT id FROM presupuestos_mensuales WHERE anio = ? AND mes = ? LIMIT 1',
    [anio, mes]
  );

  const notasVal = notas ?? null;

  if (existing[0]) {
    const existingId = existing[0].id;
    await pool.execute<ResultSetHeader>(
      'UPDATE presupuestos_mensuales SET monto = ?, notas = ? WHERE id = ?',
      [monto, notasVal, existingId]
    );
    return { id: existingId, anio, mes, monto, notas: notasVal };
  }

  const newId = randomUUID();
  await pool.execute<ResultSetHeader>(
    'INSERT INTO presupuestos_mensuales (id, anio, mes, monto, notas) VALUES (?, ?, ?, ?, ?)',
    [newId, anio, mes, monto, notasVal]
  );
  return { id: newId, anio, mes, monto, notas: notasVal };
}
