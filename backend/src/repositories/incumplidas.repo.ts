import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/prisma.js';
import type { Cobertura, ResumenDia, FilaResumen } from '../services/incumplidas-plan.js';

/**
 * Consultas del resumen de citas cumplidas e incumplidas.
 *
 * ⚠ Escritas sin poder ejecutarlas (el entorno de desarrollo no tiene MySQL): sencillas, sin funciones de
 * ventana y con parámetros `?`. Las fechas llegan y salen como texto (`dateStrings: true`; el pool está
 * en UTC). No se guardan datos de pacientes: solo conteos por día y EPS.
 */

const LOTE = 500;

/** Cuántas cumplidas e incumplidas hay guardadas entre dos fechas (incluidas): sirve para detectar una respuesta vacía o diezmada. */
export async function contarVentana(conectorId: string, desde: string, hasta: string): Promise<{ cumplidas: number; incumplidas: number }> {
  const [rows] = await pool.query<(RowDataPacket & { c: string | null; i: string | null })[]>(
    'SELECT SUM(cumplidas) AS c, SUM(incumplidas) AS i FROM citas_resumen_dia WHERE conector_id = ? AND fecha_dia >= ? AND fecha_dia <= ?',
    [conectorId, desde, hasta],
  );
  return { cumplidas: Number(rows[0]?.c ?? 0), incumplidas: Number(rows[0]?.i ?? 0) };
}

/**
 * Reemplaza TODO el resumen de un rango de fechas, en una transacción. Si algo falla se revierte y lo
 * anterior sigue ahí.
 */
export async function reemplazarVentana(conectorId: string, desde: string, hasta: string, filas: ResumenDia[]): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM citas_resumen_dia WHERE conector_id = ? AND fecha_dia >= ? AND fecha_dia <= ?', [conectorId, desde, hasta]);
    for (let i = 0; i < filas.length; i += LOTE) {
      // `+` en el ON DUPLICATE: el rango ya se borró arriba, así que un choque de llave solo puede ser de dos filas de esta
      // misma carga (p. ej. convenios que la colación considera iguales): se SUMAN, no se pisan.
      const valores = filas.slice(i, i + LOTE).map((f) => [conectorId, f.fechaDia, f.entidadId, f.convenioNombre, f.cumplidas, f.incumplidas]);
      await conn.query(
        `INSERT INTO citas_resumen_dia (conector_id, fecha_dia, entidad_id, convenio_nombre, cumplidas, incumplidas)
         VALUES ?
         ON DUPLICATE KEY UPDATE cumplidas = cumplidas + VALUES(cumplidas), incumplidas = incumplidas + VALUES(incumplidas)`,
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

// ─── Estado de la sincronización ──────────────────────────────────────────────

export interface EstadoIncumplidas extends Cobertura {
  conectorId: string;
  ultimoIntento: string | null;
  ultimaOk: string | null;
  estado: 'nunca' | 'ok' | 'error';
  error: string | null;
}

const dia = (v: unknown): string | null => (v === null || v === undefined ? null : String(v).slice(0, 10));

export async function leerEstado(conectorId?: string): Promise<EstadoIncumplidas | null> {
  const [rows] = await pool.query<(RowDataPacket & Record<string, unknown>)[]>(
    conectorId
      ? 'SELECT * FROM incumplidas_sync WHERE conector_id = ? LIMIT 1'
      : 'SELECT * FROM incumplidas_sync ORDER BY ultimo_intento DESC LIMIT 1',
    conectorId ? [conectorId] : [],
  );
  const r = rows[0];
  if (!r) return null;
  const str = (k: string): string | null => (r[k] === null || r[k] === undefined ? null : String(r[k]));
  return {
    conectorId: String(r['conector_id']),
    desde: dia(r['desde']),
    hasta: dia(r['hasta']),
    ultimoDiario: dia(r['ultimo_diario']),
    ultimoIntento: str('ultimo_intento'),
    ultimaOk: str('ultima_ok'),
    estado: (str('estado') ?? 'nunca') as EstadoIncumplidas['estado'],
    error: str('error'),
  };
}

const COLUMNAS: Record<string, string> = {
  desde: 'desde', hasta: 'hasta', ultimoDiario: 'ultimo_diario', ultimoIntento: 'ultimo_intento', ultimaOk: 'ultima_ok', estado: 'estado', error: 'error',
};

/** Guarda SOLO los campos que se pasan. Lista cerrada de columnas: nada de lo que llegue se interpola en el SQL. */
export async function guardarEstado(conectorId: string, cambios: Partial<Omit<EstadoIncumplidas, 'conectorId'>>): Promise<void> {
  const claves = Object.keys(cambios).filter((k) => k in COLUMNAS);
  if (claves.length === 0) return;
  const cols = claves.map((k) => COLUMNAS[k]!);
  const valores = claves.map((k) => {
    const v = (cambios as Record<string, unknown>)[k];
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 19).replace('T', ' ') : v;
  });
  await pool.query(
    `INSERT INTO incumplidas_sync (conector_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${cols.map((c) => `${c} = VALUES(${c})`).join(', ')}`,
    [conectorId, ...valores],
  );
}

// ─── Lecturas para Reportes ───────────────────────────────────────────────────

export interface FiltroIncumplidas {
  conectorId: string;
  desde: string;
  hasta: string;
  entidadId?: string;
  /** `DAYOFWEEK` de MySQL (2 = lunes … 6 = viernes), igual que los demás endpoints. */
  diaSemana?: number;
}

function donde(f: FiltroIncumplidas): [string, (string | number)[]] {
  let w = 'c.conector_id = ? AND c.fecha_dia >= ? AND c.fecha_dia <= ?';
  const p: (string | number)[] = [f.conectorId, f.desde, f.hasta];
  if (f.entidadId) { w += ' AND c.entidad_id = ?'; p.push(f.entidadId); }
  if (f.diaSemana !== undefined) { w += ' AND DAYOFWEEK(c.fecha_dia) = ?'; p.push(f.diaSemana); }
  return [w, p];
}

/** Cumplidas e incumplidas por EPS en el filtro, de la que más incumplidas tiene a la que menos. */
export async function resumenPorEntidad(f: FiltroIncumplidas): Promise<FilaResumen[]> {
  const [where, params] = donde(f);
  const [rows] = await pool.query<(RowDataPacket & { entidad_id: string; entidad: string; tipo: string; cum: string; inc: string })[]>(
    `SELECT c.entidad_id AS entidad_id,
            COALESCE(e.nombre, NULLIF(MAX(c.convenio_nombre), ''), 'SIN ENTIDAD') AS entidad,
            COALESCE(e.tipo, 'OTRO') AS tipo,
            SUM(c.cumplidas) AS cum,
            SUM(c.incumplidas) AS inc
       FROM citas_resumen_dia c
       LEFT JOIN entidades e ON e.id = c.entidad_id
      WHERE ${where}
      GROUP BY c.entidad_id, e.nombre, e.tipo, IF(c.entidad_id = '', c.convenio_nombre, '')
      ORDER BY inc DESC, entidad ASC`,
    params,
  );
  return rows.map((r) => ({
    entidadId: r.entidad_id === '' ? null : r.entidad_id, entidad: r.entidad, tipo: r.tipo,
    cumplidas: Number(r.cum), incumplidas: Number(r.inc),
  }));
}
