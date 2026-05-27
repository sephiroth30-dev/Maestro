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
}

export async function listEntidades(): Promise<EntidadCatalogRow[]> {
  const [rows] = await pool.query<(RowDataPacket & { id: string; nombre: string; tipo: string; es_grupo_caja: number; activa: number; nombres_raw: string })[]>(
    'SELECT id, nombre, tipo, es_grupo_caja, activa, nombres_raw FROM entidades ORDER BY tipo ASC, nombre ASC'
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
  es_grupo_caja?: boolean;
  tipo?: TipoEntidad;
  nombres_raw?: string[];
}

export async function patchEntidad(id: string, fields: PatchEntidadFields): Promise<void> {
  const sets: string[] = [];
  const params: (string | number)[] = [];
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
  try {
    const [svcRows] = await pool.query<(RowDataPacket & {
      id: string; nombre: string | null; tipo_conteo: string | null; orden: string | null; categoria: string | null;
    })[]>('SELECT id, nombre, tipo_conteo, orden, categoria FROM servicios');
    for (const r of svcRows) {
      svcMap.set(r.id, {
        id: r.id,
        nombre: r.nombre,
        tipo_conteo: r.tipo_conteo === 'sesion' ? 'sesion' : 'unidad',
        orden: Number(r.orden ?? 99),
        categoria: r.categoria ?? null,
      });
    }
  } catch {
    // tipo_conteo / orden / categoria columns missing — try simpler fallback
    try {
      const [svcRows] = await pool.query<(RowDataPacket & { id: string; nombre: string | null })[]>(
        'SELECT id, nombre FROM servicios'
      );
      for (const r of svcRows) {
        svcMap.set(r.id, { id: r.id, nombre: r.nombre, tipo_conteo: 'unidad', orden: 99, categoria: null });
      }
    } catch {
      // servicios table missing entirely — proceed with nulls
    }
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
  palabras_clave: string[];
  tipo_conteo: 'unidad' | 'sesion';
  orden: number;
  total_atenciones: number;
}

export async function listServiciosCatalog(): Promise<ServicioCatalogRow[]> {
  const [rows] = await pool.query<(RowDataPacket & {
    id: string; nombre: string; palabras_clave: string | null;
    tipo_conteo: string; orden: string;
    total_atenciones: string;
  })[]>(
    `SELECT s.id, s.nombre, s.palabras_clave, s.tipo_conteo, s.orden,
       (SELECT COUNT(*) FROM atenciones WHERE servicio_id = s.id) AS total_atenciones
     FROM servicios s ORDER BY s.orden ASC, s.nombre ASC`
  );
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    palabras_clave: (() => { try { return JSON.parse(r.palabras_clave ?? '[]') as string[]; } catch { return []; } })(),
    tipo_conteo: r.tipo_conteo === 'sesion' ? 'sesion' : 'unidad',
    orden: Number(r.orden),
    total_atenciones: Number(r.total_atenciones),
  }));
}

export async function patchServicio(id: string, fields: { tipo_conteo?: 'unidad' | 'sesion' }): Promise<void> {
  const sets: string[] = [];
  const params: string[] = [];
  if (fields.tipo_conteo !== undefined) {
    sets.push('tipo_conteo = ?');
    params.push(fields.tipo_conteo);
  }
  if (sets.length === 0) return;
  params.push(id);
  await pool.execute<ResultSetHeader>(`UPDATE servicios SET ${sets.join(', ')} WHERE id = ?`, params);
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
    'SELECT id, palabras_clave FROM servicios WHERE palabras_clave IS NOT NULL ORDER BY orden ASC'
  );
  const catalog: Array<{ id: string; keywords: string[] }> = catRows.map((r) => ({
    id: r['id'] as string,
    keywords: ((typeof r['palabras_clave'] === 'string'
      ? JSON.parse(r['palabras_clave'])
      : r['palabras_clave']) as string[]).map((kw: string) =>
      kw.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    ),
  }));

  // Load all atenciones (id, descripcion_norm, current servicio_id)
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, descripcion_norm, servicio_id FROM atenciones'
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
