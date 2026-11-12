/**
 * Lógica pura de la pantalla de TV: qué se movió entre dos lecturas y cómo se
 * resumen las citas de hoy. Sin base de datos ni red, para poder probarla.
 *
 * Los movimientos se DETECTAN al sincronizar, comparando la lectura anterior con la
 * nueva. No son eventos en tiempo real: Medifolios no avisa de nada, solo se le
 * puede preguntar. Por eso cada movimiento se rotula con la hora de detección.
 *
 * Regla que no se negocia: ante la duda, NO inventar movimientos. Sin lectura previa
 * (primer arranque, cambio de día) o con la ventana de citas cambiada (cambio de
 * mes) se suprime todo: de lo contrario saldría «+500 agendadas» de golpe.
 */

import { ventanaCitas } from './agenda-ventana.js';

export type EstadoCita = 'P' | 'C' | 'I';

export interface CitaDia {
  cod: number;
  estado: EstadoCita;
  /** Hora de inicio, 0–23. */
  hora: number;
}

export type TipoMovimiento = 'atendidas' | 'incumplidas' | 'agendadas' | 'facturado';

export interface Movimiento {
  tipo: TipoMovimiento;
  cantidad: number;
  /** Solo `facturado`: pesos nuevos. */
  valor: number | null;
}

/**
 * Cambios de estado de las citas de HOY entre dos lecturas.
 *
 * - pendiente → cumplida: «atendidas».  pendiente → incumplida: «incumplidas».
 * - Una cita que no estaba en la lectura anterior y ya está cumplida o incumplida se
 *   agendó y se resolvió entre las dos lecturas: también cuenta.
 * - `previas = null` (no había lectura de hoy) → nada.
 */
export function movimientosCitasDia(previas: Map<number, EstadoCita> | null, actuales: CitaDia[]): Movimiento[] {
  // `null` = no había lectura de hoy. Una lectura previa VACÍA sí es una lectura (un día que
  // arranca sin citas): lo que aparezca después sí es nuevo.
  if (!previas) return [];
  let atendidas = 0;
  let incumplidas = 0;
  for (const c of actuales) {
    const antes = previas.get(c.cod);
    if (antes === c.estado) continue;
    if (c.estado === 'C' && (antes === 'P' || antes === undefined)) atendidas++;
    else if (c.estado === 'I' && (antes === 'P' || antes === undefined)) incumplidas++;
  }
  const out: Movimiento[] = [];
  if (atendidas > 0) out.push({ tipo: 'atendidas', cantidad: atendidas, valor: null });
  if (incumplidas > 0) out.push({ tipo: 'incumplidas', cantidad: incumplidas, valor: null });
  return out;
}

/**
 * Citas pendientes NUEVAS desde la lectura anterior.
 *
 * Solo es válido si la ventana de citas es la misma: al cambiar de mes la ventana
 * (de hoy al fin del mes siguiente) se alarga y entran de golpe cientos de citas que
 * no son nuevas.
 */
export function movimientosAgenda(
  codigosPrevios: ReadonlySet<number> | null,
  codigosActuales: readonly number[],
  mismaVentana: boolean,
): Movimiento[] {
  if (!codigosPrevios || codigosPrevios.size === 0 || !mismaVentana) return [];
  const nuevas = codigosActuales.filter((c) => !codigosPrevios.has(c)).length;
  return nuevas > 0 ? [{ tipo: 'agendadas', cantidad: nuevas, valor: null }] : [];
}

/** Una lectura más vieja que esto ya no sirve para comparar: un hueco no es un movimiento. */
export const LECTURA_PREVIA_MAX_MS = 3 * 3_600_000;

/**
 * ¿Se puede comparar con la sincronización anterior? Solo si fue reciente (< 3 h: tras una caída
 * larga todo lo agendado en el hueco saldría como un solo «+N») Y su ventana de citas termina el
 * mismo día que la de ahora (si cambió el mes, la ventana se alarga y entrarían cientos de «nuevas»).
 */
export function mismaVentanaDeCitas(ultimaOkPrevia: string | null, ahora: Date): boolean {
  if (!ultimaOkPrevia) return false;
  const t = Date.parse(`${ultimaOkPrevia.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(ultimaOkPrevia) ? '' : 'Z'}`);
  if (!Number.isFinite(t)) return false;
  const edad = ahora.getTime() - t;
  if (edad < 0 || edad > LECTURA_PREVIA_MAX_MS) return false;
  return ventanaCitas(new Date(t)).hasta === ventanaCitas(ahora).hasta;
}

/**
 * Aumento de lo facturado hoy entre dos lecturas. Solo si sube: una baja (un ajuste,
 * un consumo anulado) no es un «movimiento» que celebrar y no se muestra.
 */
export function movimientoFacturado(antes: number | null, despues: number): Movimiento | null {
  if (antes === null || !Number.isFinite(antes) || !Number.isFinite(despues)) return null;
  const delta = Math.round(despues - antes);
  return delta > 0 ? { tipo: 'facturado', cantidad: 1, valor: delta } : null;
}

export interface ResumenCitasHoy {
  atendidas: number;
  pendientes: number;
  incumplidas: number;
  total: number;
  por_hora: Array<{ hora: number; pendientes: number; atendidas: number; incumplidas: number }>;
}

/** Resumen del día y reparto por hora de inicio. */
export function resumenCitasHoy(citas: readonly CitaDia[]): ResumenCitasHoy {
  const horas = new Map<number, { hora: number; pendientes: number; atendidas: number; incumplidas: number }>();
  let atendidas = 0, pendientes = 0, incumplidas = 0;
  for (const c of citas) {
    const h = horas.get(c.hora) ?? { hora: c.hora, pendientes: 0, atendidas: 0, incumplidas: 0 };
    if (c.estado === 'C') { atendidas++; h.atendidas++; }
    else if (c.estado === 'I') { incumplidas++; h.incumplidas++; }
    else { pendientes++; h.pendientes++; }
    horas.set(c.hora, h);
  }
  return {
    atendidas, pendientes, incumplidas, total: citas.length,
    por_hora: [...horas.values()].sort((a, b) => a.hora - b.hora),
  };
}

/**
 * Une las tres listas de hoy en una por cita. Si una cita aparece en dos estados
 * (cambió entre una petición y otra), manda el estado más avanzado: cumplida e
 * incumplida sobre pendiente.
 */
export function unirCitasDia(pendientes: CitaDia[], cumplidas: CitaDia[], incumplidas: CitaDia[]): CitaDia[] {
  const por = new Map<number, CitaDia>();
  for (const c of pendientes) por.set(c.cod, c);
  for (const c of [...cumplidas, ...incumplidas]) por.set(c.cod, c);
  return [...por.values()];
}
