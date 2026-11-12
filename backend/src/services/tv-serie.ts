/**
 * Serie del día y comparación con el día anterior, sin base de datos ni red.
 *
 * En cada sincronización se guarda una FOTO de las cifras del día (`tv_serie`): con ellas se dibuja
 * el gráfico «lo facturado hoy» como una línea REAL (un punto por sincronización) y se compara con
 * el mismo momento del día anterior. No hay datos por hora de Medifolios: sin estas fotos, no hay
 * historial intradía.
 */

const OFFSET_BOGOTA_MS = -5 * 3_600_000;

export interface PuntoSerie {
  /** ISO (UTC). */
  ts: string;
  facturado: number;
  atendidas: number;
  pendientes: number;
  incumplidas: number;
}

/** Minuto del día (0–1439) en hora de Colombia. */
export function minutoDelDiaBogota(ms: number): number {
  const l = new Date(ms + OFFSET_BOGOTA_MS);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
}

/**
 * Valor de la serie en un momento del día: el del ÚLTIMO punto a esa hora o antes (la cifra
 * «vigente» entonces, no una interpolación). `null` si aún no había ningún punto ese día a esa hora.
 */
export function puntoEnMomento(puntos: readonly PuntoSerie[], minutoDelDia: number): PuntoSerie | null {
  let mejor: PuntoSerie | null = null;
  let mejorMin = -1;
  for (const p of puntos) {
    const t = Date.parse(p.ts);
    if (!Number.isFinite(t)) continue;
    const m = minutoDelDiaBogota(t);
    if (m <= minutoDelDia && m >= mejorMin) { mejor = p; mejorMin = m; }
  }
  return mejor;
}

export interface VsPrevia {
  /** Día con el que se compara (`YYYY-MM-DD`). */
  fecha: string;
  /** Hoy menos lo que había en ese día a esta misma hora. `null` si ese día aún no tenía datos a esta hora. */
  facturado: number | null;
  atendidas: number | null;
}

/**
 * Diferencia de HOY frente al día anterior con datos, A LA MISMA HORA.
 * `null` si no hay día anterior guardado (la primera jornada de la serie).
 */
export function compararConPrevia(
  hoy: { facturado: number; atendidas: number },
  previa: { fecha: string; puntos: PuntoSerie[] } | null,
  ahoraMs: number,
): VsPrevia | null {
  if (!previa || previa.puntos.length === 0) return null;
  const p = puntoEnMomento(previa.puntos, minutoDelDiaBogota(ahoraMs));
  return {
    fecha: previa.fecha,
    facturado: p ? Math.round(hoy.facturado - p.facturado) : null,
    atendidas: p ? hoy.atendidas - p.atendidas : null,
  };
}

/** Días hábiles (lunes a viernes) de un mes: con ellos se reparte la meta mensual en meta diaria. */
export function diasHabilesDelMes(anio: number, mesIdx: number): number {
  const ultimo = new Date(Date.UTC(anio, mesIdx, 0)).getUTCDate();
  let n = 0;
  for (let d = 1; d <= ultimo; d++) {
    const dow = new Date(Date.UTC(anio, mesIdx - 1, d)).getUTCDay();
    if (dow >= 1 && dow <= 5) n++;
  }
  return n;
}

/** Variación porcentual contra una referencia; `null` si no hay referencia válida (no se inventa). */
export function variacionPct(valor: number, referencia: number | null | undefined): number | null {
  if (referencia === null || referencia === undefined || !Number.isFinite(referencia) || referencia <= 0) return null;
  if (!Number.isFinite(valor)) return null;
  return Math.round(((valor - referencia) / referencia) * 1000) / 10;
}
