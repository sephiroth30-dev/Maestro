import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/prisma.js';
import type { CitaDia, EstadoCita, Movimiento } from '../services/tv-movimientos.js';

/**
 * Consultas de la pantalla de TV.
 *
 * ⚠ Escritas sin poder ejecutarlas (el entorno de desarrollo no tiene MySQL), igual
 * que las de la agenda: sencillas, sin funciones de ventana, con parámetros `?`.
 * Las fechas salen como texto (`dateStrings: true`; el pool trabaja en UTC).
 * No se guardan datos de pacientes.
 */

const LOTE = 500;

/** Fila marcador: dice «hoy se leyó» aunque no haya ninguna cita (sábado sin agenda, festivo). */
const ESTADO_MARCADOR = 'X';

export interface CitasDiaGuardadas {
  fechaDia: string;
  syncEn: string;
  citas: CitaDia[];
}

/** Las citas de hoy de la lectura anterior, o `null` si no hay. */
export async function leerCitasDia(conectorId: string): Promise<CitasDiaGuardadas | null> {
  const [rows] = await pool.query<(RowDataPacket & { cod_asignacion: string; fecha_dia: string; hora: number; estado: string; sync_en: string })[]>(
    'SELECT cod_asignacion, fecha_dia, hora, estado, sync_en FROM citas_dia WHERE conector_id = ?',
    [conectorId],
  );
  if (rows.length === 0) return null;
  return {
    fechaDia: String(rows[0]!.fecha_dia).slice(0, 10),
    syncEn: String(rows[0]!.sync_en),
    citas: rows.filter((r) => r.estado !== ESTADO_MARCADOR)
      .map((r) => ({ cod: Number(r.cod_asignacion), hora: Number(r.hora), estado: r.estado as EstadoCita })),
  };
}

/**
 * Reemplaza las citas de hoy de un conector Y registra los movimientos, en UNA transacción: si
 * algo falla no queda la lectura nueva sin sus movimientos (se perderían) ni al revés (se
 * repetirían en la siguiente vuelta). Siempre guarda una fila marcador, para distinguir
 * «hoy no hay citas» de «hoy no se ha leído».
 */
export async function reemplazarCitasDia(
  conectorId: string, fechaDia: string, citas: CitaDia[], syncEn: Date, movimientos: Movimiento[] = [],
): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM citas_dia WHERE conector_id = ?', [conectorId]);
    const filas = [
      [0, conectorId, fechaDia, 0, ESTADO_MARCADOR, syncEn],
      ...citas.map((c) => [c.cod, conectorId, fechaDia, c.hora, c.estado, syncEn]),
    ];
    for (let i = 0; i < filas.length; i += LOTE) {
      await conn.query('INSERT INTO citas_dia (cod_asignacion, conector_id, fecha_dia, hora, estado, sync_en) VALUES ?', [filas.slice(i, i + LOTE)]);
    }
    if (movimientos.length > 0) {
      await conn.query(
        'INSERT INTO tv_movimientos (creado, tipo, cantidad, valor) VALUES ?',
        [movimientos.map((m) => [syncEn, m.tipo, m.cantidad, m.valor])],
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

/** Códigos de las citas pendientes guardadas ahora (para detectar las nuevas). */
export async function leerCodigosAgenda(conectorId: string): Promise<Set<number>> {
  const [rows] = await pool.query<(RowDataPacket & { cod_asignacion: string })[]>(
    'SELECT cod_asignacion FROM citas_agendadas WHERE conector_id = ?',
    [conectorId],
  );
  return new Set(rows.map((r) => Number(r.cod_asignacion)));
}

export async function insertarMovimientos(movs: Movimiento[], creado: Date): Promise<void> {
  if (movs.length === 0) return;
  await pool.query(
    'INSERT INTO tv_movimientos (creado, tipo, cantidad, valor) VALUES ?',
    [movs.map((m) => [creado, m.tipo, m.cantidad, m.valor])],
  );
}

export interface MovimientoGuardado {
  creado: string;
  tipo: string;
  cantidad: number;
  valor: number | null;
}

/** Los últimos movimientos desde `desde`, del más reciente al más antiguo. */
export async function leerMovimientos(desde: Date, limite: number): Promise<MovimientoGuardado[]> {
  const [rows] = await pool.query<(RowDataPacket & { creado: string; tipo: string; cantidad: number; valor: string | null })[]>(
    'SELECT creado, tipo, cantidad, valor FROM tv_movimientos WHERE creado >= ? ORDER BY creado DESC, id DESC LIMIT ?',
    [desde, limite],
  );
  return rows.map((r) => ({ creado: String(r.creado), tipo: r.tipo, cantidad: Number(r.cantidad), valor: r.valor === null ? null : Number(r.valor) }));
}

export async function purgarMovimientos(antes: Date): Promise<void> {
  await pool.query('DELETE FROM tv_movimientos WHERE creado < ?', [antes]);
}
