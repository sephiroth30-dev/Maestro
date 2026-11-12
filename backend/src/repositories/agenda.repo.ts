import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/prisma.js';
import { sqlFiltroFuente } from '../services/fuente-activa.service.js';
import { sqlClasificacionGrupo } from '../config/capacidad-grupos.js';
import { getKeyExpr, sqlLlaveVisita } from './paciente-key.js';
import type { VisitaHistorica, OrigenValor } from '../services/agenda-valoracion.js';

/**
 * Consultas de la proyección por agenda.
 *
 * ⚠ Estas consultas se escribieron SIN poder ejecutarlas (el entorno de
 * desarrollo no tiene MySQL). Por eso son deliberadamente sencillas —sin
 * funciones de ventana, la mediana se calcula en JS— y reutilizan los
 * constructores que ya corren en producción (`sqlFiltroFuente`,
 * `sqlClasificacionGrupo`, `sqlLlaveVisita`). La primera ejecución real es el
 * examen de verdad: ver Diagnóstico → Proyección por agenda.
 *
 * Las fechas llegan y salen como texto (`dateStrings: true` en el pool): un DATE
 * es 'YYYY-MM-DD' y un DATETIME 'YYYY-MM-DD HH:MM:SS'.
 */

// ─── Historial de visitas facturadas (para valorar las citas) ─────────────────

/**
 * Lo facturado por VISITA (paciente + fecha) de cada grupo de capacidad y EPS,
 * entre `desde` (incluido) y `hastaExcl` (excluido), de la fuente activa.
 *
 * `hastaExcl` existe para el backtest: valorar con un historial que llegue más
 * allá de la fecha evaluada contaminaría la prueba con lo que se quiere predecir.
 */
export async function historialVisitas(desde: string, hastaExcl: string): Promise<VisitaHistorica[]> {
  const keyExpr = await getKeyExpr();
  const [fuenteSql, fuenteParams] = sqlFiltroFuente('a');
  const [rows] = await pool.query<(RowDataPacket & { entidad_id: string | null; grupo: string; valor: string })[]>(
    `SELECT a.entidad_id AS entidad_id,
            ${sqlClasificacionGrupo('sv.nombre')} AS grupo,
            SUM(a.valor_bruto) AS valor
       FROM atenciones a
       JOIN servicios sv ON sv.id = a.servicio_id
      WHERE a.fecha_dia >= ? AND a.fecha_dia < ? AND a.valor_bruto > 0${fuenteSql}
      GROUP BY a.entidad_id, grupo, ${sqlLlaveVisita(keyExpr)}
     HAVING grupo IS NOT NULL`,
    [desde, hastaExcl, ...fuenteParams],
  );
  return rows.map((r) => ({ entidad_id: r.entidad_id, grupo: r.grupo, valor: Number(r.valor) }));
}

// ─── Citas ────────────────────────────────────────────────────────────────────

export interface CitaGuardable {
  codAsignacion: number;
  fechaCita: string;
  fechaDia: string;
  convenioCod: number | null;
  convenioNombre: string;
  entidadId: string | null;
  referenciaNombre: string;
  cups: string | null;
  grupo: string | null;
  valorEstimado: number | null;
  origenValor: OrigenValor;
}

const LOTE = 500;

/**
 * Reemplaza TODAS las citas de un conector, en una transacción.
 *
 * La tabla es chica (cientos o pocos miles de filas) y así lo atendido sale solo
 * en la siguiente vuelta, sin lógica de «qué cambió». Si algo falla a mitad, la
 * transacción se revierte y la agenda anterior sigue ahí.
 */
export async function reemplazarCitas(conectorId: string, citas: CitaGuardable[]): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM citas_agendadas WHERE conector_id = ?', [conectorId]);
    for (let i = 0; i < citas.length; i += LOTE) {
      // Recortado al ancho de cada columna: una sola cita con un nombre largo
      // (p. ej. un campo mal mapeado que trae un objeto entero) haría fallar el INSERT y
      // congelaría TODA la agenda.
      const valores = citas.slice(i, i + LOTE).map((c) => [
        c.codAsignacion, conectorId, c.fechaCita, c.fechaDia, c.convenioCod, c.convenioNombre.slice(0, 200),
        c.entidadId, c.referenciaNombre.slice(0, 255), c.cups ? c.cups.slice(0, 20) : null, c.grupo, c.valorEstimado, c.origenValor,
      ]);
      await conn.query(
        `INSERT INTO citas_agendadas
           (cod_asignacion, conector_id, fecha_cita, fecha_dia, convenio_cod, convenio_nombre,
            entidad_id, referencia_nombre, cups, grupo, valor_estimado, origen_valor)
         VALUES ?`,
        [valores],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Convenios ────────────────────────────────────────────────────────────────

export interface ConvenioEps {
  codConvenio: number;
  nombre: string;
  epsNombre: string | null;
  entidadId: string | null;
}

export async function leerConvenios(conectorId: string): Promise<ConvenioEps[]> {
  const [rows] = await pool.query<(RowDataPacket & { cod_convenio: number; nombre: string; eps_nombre: string | null; entidad_id: string | null })[]>(
    'SELECT cod_convenio, nombre, eps_nombre, entidad_id FROM convenios_eps WHERE conector_id = ?',
    [conectorId],
  );
  return rows.map((r) => ({ codConvenio: Number(r.cod_convenio), nombre: r.nombre, epsNombre: r.eps_nombre, entidadId: r.entidad_id }));
}

export async function reemplazarConvenios(conectorId: string, convenios: ConvenioEps[]): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM convenios_eps WHERE conector_id = ?', [conectorId]);
    for (let i = 0; i < convenios.length; i += LOTE) {
      const valores = convenios.slice(i, i + LOTE).map((c) => [c.codConvenio, conectorId, c.nombre.slice(0, 200), c.epsNombre ? c.epsNombre.slice(0, 200) : null, c.entidadId]);
      await conn.query('INSERT INTO convenios_eps (cod_convenio, conector_id, nombre, eps_nombre, entidad_id) VALUES ?', [valores]);
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── Estado de la sincronización ──────────────────────────────────────────────

export interface EstadoAgendaSync {
  conectorId: string;
  ultimoIntento: string | null;
  ultimaOk: string | null;
  estado: 'nunca' | 'ok' | 'error';
  error: string | null;
  httpStatus: number | null;
  citasLeidas: number;
  citasGuardadas: number;
  citasSinPrecio: number;
  horizonte: string | null;
  duracionMs: number | null;
  conveniosEstado: 'ok' | 'sin_permiso' | 'error' | null;
  conveniosError: string | null;
  conveniosActualizado: string | null;
  /** Última lectura de las citas de HOY (pantalla de TV): `ok`, `error` o nunca (null). */
  tvEstado: 'ok' | 'error' | null;
  tvError: string | null;
  tvActualizado: string | null;
}

// camelCase → columna. Lista cerrada: nada de lo que llegue se interpola en el SQL.
const COLUMNAS_SYNC: Record<string, string> = {
  ultimoIntento: 'ultimo_intento', ultimaOk: 'ultima_ok', estado: 'estado', error: 'error',
  httpStatus: 'http_status', citasLeidas: 'citas_leidas', citasGuardadas: 'citas_guardadas',
  citasSinPrecio: 'citas_sin_precio', horizonte: 'horizonte', duracionMs: 'duracion_ms',
  conveniosEstado: 'convenios_estado', conveniosError: 'convenios_error', conveniosActualizado: 'convenios_actualizado',
  tvEstado: 'tv_estado', tvError: 'tv_error', tvActualizado: 'tv_actualizado',
};

/**
 * Guarda SOLO los campos que se pasan (el resto queda como estaba). Las fechas se
 * escriben como `Date` de JS —UTC, por la configuración del pool— y no con
 * `NOW()`, que usaría la zona horaria del servidor de base de datos.
 */
export async function guardarEstadoSync(
  conectorId: string,
  cambios: Partial<Omit<EstadoAgendaSync, 'conectorId'>>,
): Promise<void> {
  const claves = Object.keys(cambios).filter((k) => k in COLUMNAS_SYNC);
  if (claves.length === 0) return;
  const cols = claves.map((k) => COLUMNAS_SYNC[k]!);
  const valores = claves.map((k) => {
    const v = (cambios as Record<string, unknown>)[k];
    // Los instantes llegan como texto ISO; MySQL espera 'YYYY-MM-DD HH:MM:SS'.
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 19).replace('T', ' ') : v;
  });
  await pool.query(
    `INSERT INTO agenda_sync (conector_id, ${cols.join(', ')})
     VALUES (?, ${cols.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${cols.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
    [conectorId, ...valores],
  );
}

export async function leerEstadoSync(conectorId?: string): Promise<EstadoAgendaSync | null> {
  const [rows] = await pool.query<(RowDataPacket & Record<string, unknown>)[]>(
    conectorId
      ? 'SELECT * FROM agenda_sync WHERE conector_id = ? LIMIT 1'
      // Sin conector: el más reciente. Hoy hay una sola fuente con agenda.
      : 'SELECT * FROM agenda_sync ORDER BY ultimo_intento DESC LIMIT 1',
    conectorId ? [conectorId] : [],
  );
  const r = rows[0];
  if (!r) return null;
  const str = (k: string): string | null => (r[k] === null || r[k] === undefined ? null : String(r[k]));
  const num = (k: string): number | null => (r[k] === null || r[k] === undefined ? null : Number(r[k]));
  return {
    conectorId: String(r['conector_id']),
    ultimoIntento: str('ultimo_intento'),
    ultimaOk: str('ultima_ok'),
    estado: (str('estado') ?? 'nunca') as EstadoAgendaSync['estado'],
    error: str('error'),
    httpStatus: num('http_status'),
    citasLeidas: num('citas_leidas') ?? 0,
    citasGuardadas: num('citas_guardadas') ?? 0,
    citasSinPrecio: num('citas_sin_precio') ?? 0,
    horizonte: str('horizonte'),
    duracionMs: num('duracion_ms'),
    conveniosEstado: str('convenios_estado') as EstadoAgendaSync['conveniosEstado'],
    conveniosError: str('convenios_error'),
    conveniosActualizado: str('convenios_actualizado'),
    tvEstado: str('tv_estado') as EstadoAgendaSync['tvEstado'],
    tvError: str('tv_error'),
    tvActualizado: str('tv_actualizado'),
  };
}

// ─── Lecturas para los reportes ───────────────────────────────────────────────

export interface FiltroAgenda {
  /** Primer día (YYYY-MM-DD). Ya recortado a «hoy»: una cita pendiente no puede estar en el pasado. */
  desde: string;
  hasta: string;
  entidadId?: string;
  /** `DAYOFWEEK` de MySQL (2 = lunes … 6 = viernes), igual que los demás endpoints. */
  diaSemana?: number;
}

function dondeAgenda(f: FiltroAgenda): [string, (string | number)[]] {
  let w = 'c.fecha_dia >= ? AND c.fecha_dia <= ?';
  const p: (string | number)[] = [f.desde, f.hasta];
  if (f.entidadId) { w += ' AND c.entidad_id = ?'; p.push(f.entidadId); }
  if (f.diaSemana !== undefined) { w += ' AND DAYOFWEEK(c.fecha_dia) = ?'; p.push(f.diaSemana); }
  return [w, p];
}

export interface AgendaEntidadFila {
  entidadId: string | null;
  entidad: string;
  tipo: string;
  citas: number;
  valor: number;
  citasSinValor: number;
}

export async function agendaPorEntidad(f: FiltroAgenda): Promise<AgendaEntidadFila[]> {
  const [where, params] = dondeAgenda(f);
  const [rows] = await pool.query<(RowDataPacket & {
    entidad_id: string | null; entidad: string; tipo: string; citas: string; valor: string | null; sin_valor: string | null;
  })[]>(
    `SELECT c.entidad_id AS entidad_id,
            COALESCE(e.nombre, NULLIF(c.convenio_nombre, ''), 'SIN ENTIDAD') AS entidad,
            COALESCE(e.tipo, 'OTRO') AS tipo,
            COUNT(*) AS citas,
            SUM(COALESCE(c.valor_estimado, 0)) AS valor,
            SUM(CASE WHEN c.valor_estimado IS NULL THEN 1 ELSE 0 END) AS sin_valor
       FROM citas_agendadas c
       LEFT JOIN entidades e ON e.id = c.entidad_id
      WHERE ${where}
      GROUP BY c.entidad_id, entidad, tipo
      ORDER BY valor DESC`,
    params,
  );
  return rows.map((r) => ({
    entidadId: r.entidad_id, entidad: r.entidad, tipo: r.tipo,
    citas: Number(r.citas), valor: Number(r.valor ?? 0), citasSinValor: Number(r.sin_valor ?? 0),
  }));
}

export async function agendaPorDia(f: FiltroAgenda): Promise<Array<{ fecha: string; citas: number; valor: number }>> {
  const [where, params] = dondeAgenda(f);
  const [rows] = await pool.query<(RowDataPacket & { fecha: string; citas: string; valor: string | null })[]>(
    `SELECT c.fecha_dia AS fecha, COUNT(*) AS citas, SUM(COALESCE(c.valor_estimado, 0)) AS valor
       FROM citas_agendadas c
      WHERE ${where}
      GROUP BY c.fecha_dia
      ORDER BY c.fecha_dia ASC`,
    params,
  );
  return rows.map((r) => ({ fecha: String(r.fecha).slice(0, 10), citas: Number(r.citas), valor: Number(r.valor ?? 0) }));
}

/** Fecha de la última cita cargada, sin filtros: hasta dónde llega la agenda. */
export async function horizonteAgenda(): Promise<string | null> {
  const [rows] = await pool.query<(RowDataPacket & { h: string | null })[]>(
    'SELECT MAX(fecha_dia) AS h FROM citas_agendadas',
  );
  return rows[0]?.h ? String(rows[0].h).slice(0, 10) : null;
}

/**
 * Facturación mensual MEDIA de cada EPS en los últimos 3 meses cerrados (de la
 * fuente activa), promediando solo los meses en que esa EPS tuvo movimiento.
 *
 * No es un tope: es la referencia con la que se compara lo proyectado, para ver
 * si una EPS va por encima o por debajo de lo habitual sin definir qué es «pasarse».
 */
export async function promedio3Meses(mesesCerrados: Array<{ anio: number; mes: number }>): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (mesesCerrados.length === 0) return out;
  const [fuenteSql, fuenteParams] = sqlFiltroFuente('a');
  const cond = mesesCerrados.map(() => '(a.anio = ? AND a.mes_idx = ?)').join(' OR ');
  const params: (string | number)[] = mesesCerrados.flatMap((m) => [m.anio, m.mes]);
  const [rows] = await pool.query<(RowDataPacket & { entidad_id: string; total: string; meses: string })[]>(
    `SELECT a.entidad_id AS entidad_id, SUM(a.valor_bruto) AS total,
            COUNT(DISTINCT CONCAT(a.anio, '-', a.mes_idx)) AS meses
       FROM atenciones a
      WHERE a.entidad_id IS NOT NULL AND (${cond})${fuenteSql}
      GROUP BY a.entidad_id`,
    [...params, ...fuenteParams],
  );
  for (const r of rows) {
    const meses = Number(r.meses);
    if (meses > 0) out.set(r.entidad_id, Number(r.total) / meses);
  }
  return out;
}

// ─── Diagnóstico ──────────────────────────────────────────────────────────────

export async function resumenCitas(): Promise<{ citas: number; conPrecio: number; sinPrecio: number; sinEntidad: number }> {
  const [rows] = await pool.query<(RowDataPacket & { n: string; con: string | null; sin: string | null; sin_ent: string | null })[]>(
    `SELECT COUNT(*) AS n,
            SUM(CASE WHEN valor_estimado IS NOT NULL THEN 1 ELSE 0 END) AS con,
            SUM(CASE WHEN valor_estimado IS NULL THEN 1 ELSE 0 END) AS sin,
            SUM(CASE WHEN entidad_id IS NULL THEN 1 ELSE 0 END) AS sin_ent
       FROM citas_agendadas`,
  );
  const r = rows[0];
  return { citas: Number(r?.n ?? 0), conPrecio: Number(r?.con ?? 0), sinPrecio: Number(r?.sin ?? 0), sinEntidad: Number(r?.sin_ent ?? 0) };
}

export async function conveniosSinEntidad(limite = 30): Promise<Array<{ convenio: string; citas: number }>> {
  const [rows] = await pool.query<(RowDataPacket & { convenio: string; citas: string })[]>(
    `SELECT COALESCE(NULLIF(convenio_nombre, ''), '(sin nombre)') AS convenio, COUNT(*) AS citas
       FROM citas_agendadas WHERE entidad_id IS NULL
      GROUP BY convenio ORDER BY citas DESC LIMIT ?`,
    [limite],
  );
  return rows.map((r) => ({ convenio: r.convenio, citas: Number(r.citas) }));
}

export async function citasSinPrecioPorReferencia(limite = 30): Promise<Array<{ referencia: string; convenio: string; citas: number }>> {
  const [rows] = await pool.query<(RowDataPacket & { referencia: string; convenio: string; citas: string })[]>(
    `SELECT COALESCE(NULLIF(referencia_nombre, ''), '(sin nombre)') AS referencia,
            COALESCE(NULLIF(convenio_nombre, ''), '(sin nombre)') AS convenio, COUNT(*) AS citas
       FROM citas_agendadas WHERE valor_estimado IS NULL
      GROUP BY referencia, convenio ORDER BY citas DESC LIMIT ?`,
    [limite],
  );
  return rows.map((r) => ({ referencia: r.referencia, convenio: r.convenio, citas: Number(r.citas) }));
}


// ─── Evaluación de precisión (backtest) ───────────────────────────────────────

/** Lo facturado por EPS en un mes (fuente activa): el «real» contra el que se compara. */
export async function facturadoPorEntidadMes(anio: number, mes: number): Promise<Array<{ entidadId: string | null; entidad: string; valor: number }>> {
  const [fuenteSql, fuenteParams] = sqlFiltroFuente('a');
  const [rows] = await pool.query<(RowDataPacket & { entidad_id: string | null; entidad: string; valor: string })[]>(
    `SELECT a.entidad_id AS entidad_id, COALESCE(e.nombre, 'SIN ENTIDAD') AS entidad, SUM(a.valor_bruto) AS valor
       FROM atenciones a
       LEFT JOIN entidades e ON e.id = a.entidad_id
      WHERE a.anio = ? AND a.mes_idx = ?${fuenteSql}
      GROUP BY a.entidad_id, entidad`,
    [anio, mes, ...fuenteParams],
  );
  return rows.map((r) => ({ entidadId: r.entidad_id, entidad: r.entidad, valor: Number(r.valor) }));
}

export interface EstadoBacktest {
  estado: 'nunca' | 'corriendo' | 'ok' | 'error';
  iniciado: string | null;
  terminado: string | null;
  error: string | null;
  /** JSON de `ResultadoBacktest`. */
  resultado: unknown | null;
}

export async function guardarBacktest(
  conectorId: string,
  c: { estado: EstadoBacktest['estado']; iniciado?: string | null; terminado?: string | null; error?: string | null; resultado?: unknown },
): Promise<void> {
  const iso = (v: string | null | undefined): string | null => (v ? v.slice(0, 19).replace('T', ' ') : null);
  await pool.query(
    `INSERT INTO agenda_backtest (conector_id, estado, iniciado, terminado, error, resultado)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado), iniciado = COALESCE(VALUES(iniciado), iniciado),
       terminado = VALUES(terminado), error = VALUES(error), resultado = VALUES(resultado)`,
    [conectorId, c.estado, iso(c.iniciado), iso(c.terminado), c.error ?? null, c.resultado === undefined ? null : JSON.stringify(c.resultado)],
  );
}

export async function leerBacktest(conectorId: string): Promise<EstadoBacktest> {
  const [rows] = await pool.query<(RowDataPacket & { estado: string; iniciado: string | null; terminado: string | null; error: string | null; resultado: string | null })[]>(
    'SELECT estado, iniciado, terminado, error, resultado FROM agenda_backtest WHERE conector_id = ? LIMIT 1',
    [conectorId],
  );
  const r = rows[0];
  if (!r) return { estado: 'nunca', iniciado: null, terminado: null, error: null, resultado: null };
  let resultado: unknown = null;
  try { resultado = r.resultado ? JSON.parse(r.resultado) : null; } catch { resultado = null; }
  return { estado: r.estado as EstadoBacktest['estado'], iniciado: r.iniciado, terminado: r.terminado, error: r.error, resultado };
}

/** id → nombre de cada entidad, para rotular el backtest. */
export async function nombresEntidades(): Promise<Map<string, string>> {
  const [rows] = await pool.query<(RowDataPacket & { id: string; nombre: string })[]>('SELECT id, nombre FROM entidades');
  return new Map(rows.map((r) => [r.id, r.nombre]));
}
