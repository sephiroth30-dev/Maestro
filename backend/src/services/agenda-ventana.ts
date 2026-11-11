/**
 * Fechas de la agenda en hora de Colombia, sin base de datos ni red.
 *
 * Colombia no tiene horario de verano: UTC-5 todo el año. Se calcula siempre en
 * hora de la clínica y no en la del servidor: a las 9 p. m. del 31 de octubre ya
 * es 1 de noviembre en UTC, y con el reloj del servidor la ventana de citas
 * saltaría un día (y de mes) antes de tiempo.
 */

const OFFSET_BOGOTA_MS = -5 * 60 * 60 * 1000;

const pad = (n: number): string => String(n).padStart(2, '0');

function aBogota(ahora: Date): Date {
  return new Date(ahora.getTime() + OFFSET_BOGOTA_MS);
}

/** «Hoy» en la clínica, `YYYY-MM-DD`. */
export function hoyEnBogota(ahora: Date): string {
  const l = aBogota(ahora);
  return `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`;
}

/**
 * Rango de fechas de citas a sincronizar: de HOY al último día del mes
 * `mesesAdelante` meses después (1 = el mes siguiente).
 *
 * Por qué no más: la agenda de Medifolios rara vez llega más lejos, y pedir más
 * solo añade páginas. Por qué no menos: ver el mes siguiente ya cargado permite
 * a la administración anticiparse.
 */
export function ventanaCitas(ahora: Date, mesesAdelante = 1): { desde: string; hasta: string } {
  const l = aBogota(ahora);
  const meses = Math.max(0, Math.floor(mesesAdelante));
  // Día 0 del mes siguiente al último de la ventana = último día de la ventana.
  const ultimo = new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth() + meses + 1, 0));
  return {
    desde: hoyEnBogota(ahora),
    hasta: `${ultimo.getUTCFullYear()}-${pad(ultimo.getUTCMonth() + 1)}-${pad(ultimo.getUTCDate())}`,
  };
}

/**
 * ¿Es horario de trabajo de la clínica? Lunes a sábado, de 6:00 a 19:59.
 *
 * Fuera de ese horario la agenda no cambia de forma que importe, y sincronizarla
 * cada 15 minutos toda la noche solo cargaría a Medifolios sin aportar nada.
 */
export function enHorarioLaboral(ahora: Date): boolean {
  const l = aBogota(ahora);
  const dia = l.getUTCDay();      // 0 = domingo
  const hora = l.getUTCHours();
  return dia >= 1 && dia <= 6 && hora >= 6 && hora < 20;
}

/** `YYYY-MM-DD` menos `n` días (calendario, sin zona horaria de por medio). */
export function diasAntes(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d - n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
