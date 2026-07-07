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
  nombres_raw: string[];
  total_atenciones: number;
}

export async function listEntidades(): Promise<EntidadCatalogRow[]> {
  const [rows] = await pool.query<(RowDataPacket & { id: string; nombre: string; tipo: string; es_grupo_caja: number; activa: number; nombres_raw: string; total_atenciones: string })[]>(
    `SELECT e.id, e.nombre, e.tipo, e.es_grupo_caja, e.activa, e.nombres_raw,
      (SELECT COUNT(*) FROM atenciones WHERE entidad_id = e.id) AS total_atenciones
     FROM entidades e
     ORDER BY e.tipo ASC, e.nombre ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    es_grupo_caja: Boolean(r.es_grupo_caja),
    activa: Boolean(r.activa),
    nombres_raw: (() => {
      try { return JSON.parse(r.nombres_raw) as string[]; } catch { return []; }
    })(),
    total_atenciones: Number(r.total_atenciones),
  }));
}

export async function updateEntidadGrupoCaja(id: string, esGrupoCaja: boolean): Promise<void> {
  await pool.execute<ResultSetHeader>(
    'UPDATE entidades SET es_grupo_caja = ? WHERE id = ?',
    [esGrupoCaja ? 1 : 0, id]
  );
}

export const TIPOS_VALIDOS = ['EPS', 'ARL', 'CONVENIO', 'PARTICULAR', 'OTRO'] as const;
export type TipoEntidad = typeof TIPOS_VALIDOS[number];

export interface PatchEntidadFields {
  nombre?: string;
  es_grupo_caja?: boolean;
  tipo?: TipoEntidad;
  nombres_raw?: string[];
}

export async function patchEntidad(id: string, fields: PatchEntidadFields): Promise<void> {
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (fields.nombre !== undefined) {
    sets.push('nombre = ?');
    params.push(fields.nombre.trim().toUpperCase());
  }
  if (fields.es_grupo_caja !== undefined) {
    sets.push('es_grupo_caja = ?');
    params.push(fields.es_grupo_caja ? 1 : 0);
  }
  if (fields.tipo !== undefined) {
    sets.push('tipo = ?');
    params.push(fields.tipo);
  }
  if (fields.nombres_raw !== undefined) {
    sets.push('nombres_raw = ?');
    params.push(JSON.stringify(fields.nombres_raw));
  }
  if (sets.length === 0) return;
  params.push(id);
  await pool.execute<ResultSetHeader>(`UPDATE entidades SET ${sets.join(', ')} WHERE id = ?`, params);
}

// ─── Delete entity (nullify atenciones so they can be reclassified) ──────────

export async function deleteEntidad(id: string): Promise<{ nullified: number }> {
  const [res] = await pool.execute<ResultSetHeader>(
    'UPDATE atenciones SET entidad_id = NULL WHERE entidad_id = ?',
    [id]
  );
  await pool.execute<ResultSetHeader>('DELETE FROM entidades WHERE id = ?', [id]);
  return { nullified: res.affectedRows };
}

// ─── Create entity from unmatched raw name and reassign atenciones ───────────

export interface CrearEntidadResult {
  id: string;
  nombre: string;
  tipo: string;
  reassigned: number;
}

export async function createEntidadFromRaw(
  nombre: string,
  tipo: TipoEntidad,
  nombreRaw: string,
): Promise<CrearEntidadResult> {
  const id = randomUUID();
  await pool.execute<ResultSetHeader>(
    'INSERT INTO entidades (id, nombre, nombres_raw, tipo, es_grupo_caja, activa, created_at) VALUES (?, ?, ?, ?, 0, 1, NOW())',
    [id, nombre.trim().toUpperCase(), JSON.stringify([nombreRaw]), tipo]
  );
  const [res] = await pool.execute<ResultSetHeader>(
    'UPDATE atenciones SET entidad_id = ? WHERE entidad_id IS NULL AND entidad_nombre_raw = ?',
    [id, nombreRaw]
  );
  return { id, nombre: nombre.trim().toUpperCase(), tipo, reassigned: res.affectedRows };
}

// ─── Reclassify all atenciones against current entidades nombres_raw ──────────

export async function reclasificarEntidades(): Promise<{ updated: number; sin_entidad: number }> {
  const [entRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombres_raw FROM entidades WHERE activa = 1'
  );

  // Build normalized name → entity_id map
  const nameMap = new Map<string, string>();
  for (const row of entRows) {
    let names: string[] = [];
    try { names = JSON.parse(row['nombres_raw'] as string) as string[]; } catch { /* skip */ }
    for (const n of names) {
      const key = (n as string).trim().toUpperCase();
      if (key) nameMap.set(key, row['id'] as string);
    }
  }

  // Get all distinct raw names in atenciones
  const [rawRows] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT entidad_nombre_raw FROM atenciones WHERE entidad_nombre_raw IS NOT NULL'
  );

  let updated = 0;
  for (const row of rawRows) {
    const raw = row['entidad_nombre_raw'] as string;
    const entidadId = nameMap.get(raw.trim().toUpperCase());
    if (entidadId) {
      const [res] = await pool.execute<ResultSetHeader>(
        'UPDATE atenciones SET entidad_id = ? WHERE entidad_nombre_raw = ? AND (entidad_id IS NULL OR entidad_id != ?)',
        [entidadId, raw, entidadId]
      );
      updated += res.affectedRows;
    } else {
      // Raw name doesn't match any entity — clear any stale assignment so it shows as sin_entidad
      await pool.execute<ResultSetHeader>(
        'UPDATE atenciones SET entidad_id = NULL WHERE entidad_nombre_raw = ? AND entidad_id IS NOT NULL',
        [raw]
      );
    }
  }

  const [sinRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM atenciones WHERE entidad_id IS NULL AND entidad_nombre_raw IS NOT NULL'
  );
  return {
    updated,
    sin_entidad: Number((sinRows[0] ?? {})['cnt'] ?? 0),
  };
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

// ─── Profesionales catalog ────────────────────────────────────────────────────

export interface ProfesionalRow {
  id: string;
  nombre: string;
  nombre_completo: string | null;
  nombres_raw: string[];
  es_nomina: boolean;
  especialidad: 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO' | null;
  total_atenciones: number;
}

export async function listProfesionales(): Promise<ProfesionalRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT p.id, p.nombre, p.nombre_completo, p.nombres_raw, p.es_nomina, p.especialidad,
            COUNT(a.id) AS total_atenciones
     FROM profesionales p
     LEFT JOIN atenciones a ON a.profesional_id = p.id
     WHERE p.activo = 1
     GROUP BY p.id
     ORDER BY total_atenciones DESC, p.nombre ASC`
  );
  return rows.map((r) => ({
    id: r['id'] as string,
    nombre: r['nombre'] as string,
    nombre_completo: (r['nombre_completo'] as string | null) ?? null,
    nombres_raw: (typeof r['nombres_raw'] === 'string'
      ? JSON.parse(r['nombres_raw'])
      : r['nombres_raw']) as string[],
    es_nomina: Boolean(r['es_nomina']),
    especialidad: (r['especialidad'] as 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO' | null) ?? null,
    total_atenciones: Number(r['total_atenciones']),
  }));
}

export async function createProfesional(
  nombre: string,
  nombreCompleto: string | null,
  especialidad: 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO' | null,
  nombresRaw: string[],
): Promise<{ id: string }> {
  const id = randomUUID();
  await pool.execute<ResultSetHeader>(
    'INSERT INTO profesionales (id, nombre, nombre_completo, nombres_raw, es_nomina, especialidad, activo) VALUES (?, ?, ?, ?, 0, ?, 1)',
    [id, nombre, nombreCompleto ?? null, JSON.stringify(nombresRaw), especialidad ?? null]
  );
  return { id };
}

export async function patchProfesional(
  id: string,
  fields: { especialidad?: 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO' | null; nombre_completo?: string | null }
): Promise<void> {
  const parts: string[] = [];
  const vals: unknown[] = [];
  if ('especialidad' in fields) { parts.push('especialidad = ?'); vals.push(fields.especialidad); }
  if ('nombre_completo' in fields) { parts.push('nombre_completo = ?'); vals.push(fields.nombre_completo ?? null); }
  if (parts.length === 0) return;
  vals.push(id);
  await pool.execute<ResultSetHeader>(`UPDATE profesionales SET ${parts.join(', ')} WHERE id = ?`, vals as (string | null)[]);
}

// ─── Diagnostic: unmatched professional names (SIN PROFESIONAL) ──────────────

export interface SinProfesionalRow {
  nombre_raw: string;
  cnt: number;
  total: number;
}

export async function getSinProfesionalDiagnostico(): Promise<SinProfesionalRow[]> {
  const [rows] = await pool.query<(RowDataPacket & { nombre_raw: string; cnt: string; total: string })[]>(
    `SELECT
      profesional_nombre_raw AS nombre_raw,
      COUNT(*) AS cnt,
      SUM(valor_bruto) AS total
    FROM atenciones
    WHERE profesional_id IS NULL
      AND profesional_nombre_raw IS NOT NULL
      AND profesional_nombre_raw != ''
    GROUP BY profesional_nombre_raw
    ORDER BY cnt DESC`
  );
  return rows.map((r) => ({
    nombre_raw: r.nombre_raw,
    cnt: Number(r.cnt),
    total: Number(r.total),
  }));
}

export async function reclasificarProfesionales(): Promise<{ updated: number; sin_profesional: number }> {
  const [profRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombres_raw FROM profesionales WHERE activo = 1'
  );

  const nameMap = new Map<string, string>();
  for (const row of profRows) {
    let names: string[] = [];
    try { names = JSON.parse(row['nombres_raw'] as string) as string[]; } catch { /* skip */ }
    for (const n of names) {
      const key = (n as string).trim().toUpperCase();
      if (key) nameMap.set(key, row['id'] as string);
    }
  }

  const [rawRows] = await pool.query<RowDataPacket[]>(
    'SELECT DISTINCT profesional_nombre_raw FROM atenciones WHERE profesional_nombre_raw IS NOT NULL AND profesional_nombre_raw != \'\''
  );

  let updated = 0;
  for (const row of rawRows) {
    const raw = row['profesional_nombre_raw'] as string;
    const profId = nameMap.get(raw.trim().toUpperCase());
    if (profId) {
      const [res] = await pool.execute<ResultSetHeader>(
        'UPDATE atenciones SET profesional_id = ? WHERE profesional_nombre_raw = ? AND (profesional_id IS NULL OR profesional_id != ?)',
        [profId, raw, profId]
      );
      updated += res.affectedRows;
    }
  }

  const [sinRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS cnt FROM atenciones WHERE profesional_id IS NULL AND profesional_nombre_raw IS NOT NULL AND profesional_nombre_raw != \'\''
  );
  return {
    updated,
    sin_profesional: Number((sinRows[0] ?? {})['cnt'] ?? 0),
  };
}

// ─── Diagnostic: unmatched entity names (SIN ENTIDAD) ────────────────────────

export interface SinEntidadRow {
  nombre_raw: string | null;
  cnt: number;
  total: number;
}

export async function getSinEntidadDiagnostico(
  mesIdx: number,
  anio: number,
  startDate?: Date,
  endDate?: Date,
): Promise<SinEntidadRow[]> {
  const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
  const [rows] = await pool.query<(RowDataPacket & { nombre_raw: string | null; cnt: string; total: string })[]>(
    `SELECT
      COALESCE(entidad_nombre_raw, '(vacío)') AS nombre_raw,
      COUNT(*) AS cnt,
      SUM(valor_bruto) AS total
    FROM atenciones
    WHERE entidad_id IS NULL AND ${whereClause}
    GROUP BY entidad_nombre_raw
    ORDER BY total DESC`,
    params
  );
  return rows.map((r) => ({
    nombre_raw: r.nombre_raw,
    cnt: Number(r.cnt),
    total: Number(r.total),
  }));
}

// ─── Diagnostic: unclassified service descriptions ───────────────────────────

export interface SinServicioRow {
  descripcion_raw: string | null;
  cnt: number;
  total: number;
}

export async function getSinServicioDiagnostico(limit = 60): Promise<SinServicioRow[]> {
  const [rows] = await pool.query<(RowDataPacket & { descripcion_raw: string | null; cnt: string; total: string })[]>(
    `SELECT
      descripcion_raw,
      COUNT(*) AS cnt,
      SUM(valor_bruto) AS total
    FROM atenciones
    WHERE servicio_id IS NULL
    GROUP BY descripcion_raw
    ORDER BY cnt DESC
    LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({
    descripcion_raw: r.descripcion_raw,
    cnt: Number(r.cnt),
    total: Number(r.total),
  }));
}

// ─── Servicios seed diagnostic ────────────────────────────────────────────────

export async function getServiciosDiagnostico(): Promise<{
  servicios_en_catalogo: number;
  servicios_con_keywords: number;
  atenciones_clasificadas: number;
  atenciones_sin_clasificar: number;
  cobertura_pct: number;
}> {
  let servicios_en_catalogo = 0;
  let servicios_con_keywords = 0;

  try {
    const [catRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN palabras_clave IS NOT NULL THEN 1 ELSE 0 END) AS con_kw FROM servicios'
    );
    const cat = catRows[0] ?? {};
    servicios_en_catalogo = Number(cat['total'] ?? 0);
    servicios_con_keywords = Number(cat['con_kw'] ?? 0);
  } catch {
    try {
      const [catRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM servicios');
      servicios_en_catalogo = Number((catRows[0] ?? {})['total'] ?? 0);
    } catch {
      // servicios table or palabras_clave column not yet migrated
    }
  }

  const [covRows] = await pool.query<RowDataPacket[]>(
    'SELECT SUM(CASE WHEN servicio_id IS NOT NULL THEN 1 ELSE 0 END) AS clasificadas, SUM(CASE WHEN servicio_id IS NULL THEN 1 ELSE 0 END) AS sin_clasificar FROM atenciones'
  );
  const cov = covRows[0] ?? {};
  const total = Number(cov['clasificadas'] ?? 0) + Number(cov['sin_clasificar'] ?? 0);
  const clasificadas = Number(cov['clasificadas'] ?? 0);
  return {
    servicios_en_catalogo,
    servicios_con_keywords,
    atenciones_clasificadas: clasificadas,
    atenciones_sin_clasificar: Number(cov['sin_clasificar'] ?? 0),
    cobertura_pct: total > 0 ? Math.round((clasificadas / total) * 100) : 0,
  };
}

// ─── Servicios aggregation ────────────────────────────────────────────────────

export interface ServicioAggRow {
  servicio_id: string | null;
  nombre: string | null;
  tipo_conteo: 'unidad' | 'sesion';
  orden: number;
  categoria: string | null;
  total_filas: number;
  sesiones: number;
  valor_bruto: number;
}

export async function getServiciosAgg(
  mesIdx: number,
  anio: number,
  startDate?: Date,
  endDate?: Date,
  entidadId?: string,
  diaSemana?: number,
): Promise<ServicioAggRow[]> {
  const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate, diaSemana);

  const entidadExtra = entidadId ? ' AND a.entidad_id = ?' : '';
  const entidadParams = entidadId ? [entidadId] : [];

  // Step 1: Core aggregation — only columns that always exist
  const [coreRows] = await pool.query<(RowDataPacket & {
    servicio_id: string | null;
    total_filas: string;
    valor_bruto: string;
  })[]>(
    `SELECT a.servicio_id, COUNT(a.id) AS total_filas, SUM(a.valor_bruto) AS valor_bruto
     FROM atenciones a
     WHERE ${whereClause}${entidadExtra}
     GROUP BY a.servicio_id`,
    [...params, ...entidadParams]
  );

  if (coreRows.length === 0) return [];

  // Step 2: Session counting — requires paciente_nombre & paciente_documento (new columns)
  const sesionesMap = new Map<string | null, number>();
  try {
    const [sesRows] = await pool.query<(RowDataPacket & { servicio_id: string | null; sesiones: string })[]>(
      `SELECT a.servicio_id,
         COUNT(DISTINCT CONCAT(DATE(a.fecha_dia), '|',
           COALESCE(a.paciente_nombre, ''), '|',
           COALESCE(a.paciente_documento, ''))) AS sesiones
       FROM atenciones a
       WHERE ${whereClause}${entidadExtra}
       GROUP BY a.servicio_id`,
      [...params, ...entidadParams]
    );
    for (const r of sesRows) sesionesMap.set(r.servicio_id, Number(r.sesiones));
  } catch {
    // paciente columns not yet migrated — sesiones will fall back to total_filas per row
  }

  // Step 3: Catalog metadata — requires tipo_conteo, orden, categoria (new servicios columns)
  interface ServicioMeta { id: string; nombre: string | null; tipo_conteo: 'unidad' | 'sesion'; orden: number; categoria: string | null }
  const svcMap = new Map<string, ServicioMeta>();
  // Try queries in order from most to least capable, gracefully handling missing columns
  const svcQueries = [
    'SELECT id, COALESCE(nombre_display, nombre) AS nombre, tipo_conteo, orden, categoria FROM servicios',
    'SELECT id, nombre, tipo_conteo, orden, categoria FROM servicios',
    'SELECT id, nombre FROM servicios',
  ];
  for (const q of svcQueries) {
    if (svcMap.size > 0) break;
    try {
      const [svcRows] = await pool.query<(RowDataPacket & { id: string; nombre: string | null; tipo_conteo?: string; orden?: string; categoria?: string })[]>(q);
      for (const r of svcRows) {
        svcMap.set(r.id, {
          id: r.id,
          nombre: r.nombre,
          tipo_conteo: r.tipo_conteo === 'sesion' ? 'sesion' : 'unidad',
          orden: Number(r.orden ?? 99),
          categoria: r.categoria ?? null,
        });
      }
    } catch { /* try next fallback */ }
  }

  // Step 4: Join in JavaScript
  const result: ServicioAggRow[] = coreRows.map((r) => {
    const svc = r.servicio_id ? svcMap.get(r.servicio_id) : undefined;
    const totalFilas = Number(r.total_filas);
    const sesiones = sesionesMap.size > 0 ? (sesionesMap.get(r.servicio_id) ?? totalFilas) : totalFilas;
    return {
      servicio_id: r.servicio_id,
      nombre: svc?.nombre ?? null,
      tipo_conteo: svc?.tipo_conteo ?? 'unidad',
      orden: svc?.orden ?? 99,
      categoria: svc?.categoria ?? null,
      total_filas: totalFilas,
      sesiones,
      valor_bruto: Number(r.valor_bruto),
    };
  });

  return result.sort((a, b) => a.orden - b.orden || (a.nombre ?? '').localeCompare(b.nombre ?? ''));
}

// ─── Servicios catalog management ────────────────────────────────────────────

export interface ServicioCatalogRow {
  id: string;
  nombre: string;
  nombre_display: string | null;
  palabras_clave: string[];
  tipo_conteo: 'unidad' | 'sesion';
  orden: number;
  total_atenciones: number;
}

export async function listServiciosCatalog(): Promise<ServicioCatalogRow[]> {
  // Try with nombre_display first; fall back gracefully if column not yet migrated
  const queries = [
    `SELECT s.id, s.nombre, s.nombre_display, s.palabras_clave, s.tipo_conteo, s.orden,
       (SELECT COUNT(*) FROM atenciones WHERE servicio_id = s.id) AS total_atenciones
     FROM servicios s ORDER BY s.orden ASC, s.nombre ASC`,
    `SELECT s.id, s.nombre, NULL AS nombre_display, s.palabras_clave, s.tipo_conteo, s.orden,
       (SELECT COUNT(*) FROM atenciones WHERE servicio_id = s.id) AS total_atenciones
     FROM servicios s ORDER BY s.orden ASC, s.nombre ASC`,
  ];
  type SvcRow = RowDataPacket & { id: string; nombre: string; nombre_display: string | null; palabras_clave: string | null; tipo_conteo: string; orden: string; total_atenciones: string };
  let rows: SvcRow[] = [];
  for (const q of queries) {
    try { [rows] = await pool.query<SvcRow[]>(q); break; } catch { /* try next */ }
  }
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    nombre_display: r.nombre_display ?? null,
    palabras_clave: (() => { try { return JSON.parse(r.palabras_clave ?? '[]') as string[]; } catch { return []; } })(),
    tipo_conteo: r.tipo_conteo === 'sesion' ? 'sesion' : 'unidad',
    orden: Number(r.orden),
    total_atenciones: Number(r.total_atenciones),
  }));
}

export async function patchServicio(
  id: string,
  fields: { tipo_conteo?: 'unidad' | 'sesion'; nombre_display?: string | null }
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (fields.tipo_conteo !== undefined) { sets.push('tipo_conteo = ?'); params.push(fields.tipo_conteo); }
  if ('nombre_display' in fields) { sets.push('nombre_display = ?'); params.push(fields.nombre_display ?? null); }
  if (sets.length === 0) return;
  params.push(id);
  await pool.execute<ResultSetHeader>(`UPDATE servicios SET ${sets.join(', ')} WHERE id = ?`, params as (string | null)[]);
}

// ─── Servicio agrupaciones (actual raw descriptions per service) ──────────────

export interface ServicioAgrupacionItem {
  descripcion_raw: string | null;
  cnt: number;
  valor: number;
}

export interface ServicioAgrupacion {
  servicio_id: string;
  nombre: string;
  total_cnt: number;
  items: ServicioAgrupacionItem[];
}

export async function getServicioAgrupaciones(): Promise<ServicioAgrupacion[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT s.id AS servicio_id,
            COALESCE(s.nombre_display, s.nombre) AS nombre,
            a.descripcion_raw,
            COUNT(*) AS cnt,
            SUM(a.valor_bruto) AS valor
     FROM servicios s
     JOIN atenciones a ON a.servicio_id = s.id
     GROUP BY s.id, nombre, a.descripcion_raw
     ORDER BY s.orden ASC, s.nombre ASC, cnt DESC`
  );
  const map = new Map<string, ServicioAgrupacion>();
  for (const r of rows) {
    const sid = r['servicio_id'] as string;
    if (!map.has(sid)) {
      map.set(sid, { servicio_id: sid, nombre: r['nombre'] as string, total_cnt: 0, items: [] });
    }
    const entry = map.get(sid)!;
    const cnt = Number(r['cnt']);
    entry.total_cnt += cnt;
    entry.items.push({ descripcion_raw: r['descripcion_raw'] as string | null, cnt, valor: Number(r['valor']) });
  }
  return [...map.values()];
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

// ─── Reclassify all atenciones with current service catalog ──────────────────

export async function reclasificarServicios(): Promise<{ total: number; updated: number; sin_clasificar: number }> {
  // Load current service catalog ordered by precedence
  const [catRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, nombre, palabras_clave FROM servicios WHERE palabras_clave IS NOT NULL ORDER BY orden ASC'
  );
  const catalog: Array<{ id: string; nombre: string; keywords: string[] }> = catRows.map((r) => ({
    id: r['id'] as string,
    nombre: r['nombre'] as string,
    keywords: ((typeof r['palabras_clave'] === 'string'
      ? JSON.parse(r['palabras_clave'])
      : r['palabras_clave']) as string[]).map((kw: string) =>
      kw.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    ),
  }));

  // Build specialty upgrade map: generic service id → { NEUROLOGIA: id, FISIATRIA: id }
  const upgradeMap = new Map<string, { NEUROLOGIA: string | null; FISIATRIA: string | null }>();
  const UPGRADES: Array<[string, string, string]> = [
    ['CONSULTA PRIMERA VEZ', 'CONSULTA PRIMERA VEZ NEUROLOGIA', 'CONSULTA PRIMERA VEZ FISIATRA'],
    ['CONSULTA DE CONTROL',  'CONSULTA DE CONTROL NEUROLOGIA',  'CONSULTA DE CONTROL FISIATRIA'],
  ];
  for (const [generic, neuro, fisio] of UPGRADES) {
    const genericId = catalog.find((s) => s.nombre === generic)?.id ?? null;
    const neuroId   = catalog.find((s) => s.nombre === neuro)?.id   ?? null;
    const fisioId   = catalog.find((s) => s.nombre === fisio)?.id   ?? null;
    if (genericId) upgradeMap.set(genericId, { NEUROLOGIA: neuroId, FISIATRIA: fisioId });
  }

  // Load profesionales specialty
  const [profRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, especialidad FROM profesionales WHERE activo = 1'
  );
  const profEspecialidad = new Map<string, 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO'>();
  for (const p of profRows) {
    if (p['especialidad']) {
      profEspecialidad.set(p['id'] as string, p['especialidad'] as 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO');
    }
  }

  // Load all atenciones
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, descripcion_norm, servicio_id, profesional_id FROM atenciones'
  );

  let updated = 0;
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const updates: Array<[string | null, string]> = [];

    for (const row of batch) {
      const norm = (row['descripcion_norm'] as string ?? '').toUpperCase();
      let matched: string | null = null;
      for (const svc of catalog) {
        if (svc.keywords.some((kw) => norm.includes(kw))) {
          matched = svc.id;
          break;
        }
      }

      // Specialty upgrade: if matched a generic consultation, use professional's specialty
      if (matched && upgradeMap.has(matched)) {
        const profId = row['profesional_id'] as string | null;
        const esp = profId ? (profEspecialidad.get(profId) ?? null) : null;
        if (esp === 'NEUROLOGIA' || esp === 'FISIATRIA') {
          matched = upgradeMap.get(matched)![esp] ?? matched;
        }
      }

      const current = (row['servicio_id'] as string | null) ?? null;
      if (matched !== current) {
        updates.push([matched, row['id'] as string]);
      }
    }

    for (const [newId, id] of updates) {
      await pool.execute('UPDATE atenciones SET servicio_id = ? WHERE id = ?', [newId, id]);
      updated++;
    }
  }

  const sinClasificar = rows.filter((r) => {
    const norm = (r['descripcion_norm'] as string ?? '').toUpperCase();
    return !catalog.some((svc) => svc.keywords.some((kw) => norm.includes(kw)));
  }).length;

  return { total: rows.length, updated, sin_clasificar: sinClasificar };
}
