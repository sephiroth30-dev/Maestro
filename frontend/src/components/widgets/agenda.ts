import type { AgendaDia, DiaSemanaRow } from '../../api/reportes.js';

/**
 * Utilidades de la proyección por agenda. Sin React ni red: lógica pura.
 *
 * Proyectado = lo ya facturado (atendido) + lo agendado (citas pendientes).
 */

const MESES_CORTO_MIN = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «2026-11-30» → «30 nov». Sin pasar por `Date` para no depender de la zona horaria. */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${d} ${MESES_CORTO_MIN[m] ?? ''}`;
}

/**
 * ¿El periodo puede tener agenda pendiente?
 *
 * Una cita pendiente solo existe de hoy en adelante: si el periodo ya terminó,
 * no queda nada por atender y pedirla sería una consulta para saber que es cero.
 *
 * El modo AÑO nunca lleva agenda. En el año en curso su fin es «hoy», así que
 * se pediría la agenda de [1 ene, hoy] —solo las citas pendientes de hoy— y la
 * ficha enseñaría un «Proyectado» del año calculado con una agenda de un día.
 * Una proyección anual con la agenda de unas semanas no sería honesta.
 */
export function periodoConAgenda(
  modo: 'mes' | 'anio' | 'rango',
  mesElegido: { mes: number; anio: number },
  fin: string | undefined,
  hoy: string,
): boolean {
  if (modo === 'anio') return false;
  if (modo === 'mes') {
    const [ay, am] = hoy.split('-').map(Number) as [number, number];
    return mesElegido.anio > ay || (mesElegido.anio === ay && mesElegido.mes >= am);
  }
  return fin !== undefined && fin >= hoy;
}

/** Valor agendado dentro de [ini, fin], ambos inclusive. Para las barras por semana. */
export function agendaEnRango(porDia: AgendaDia[], ini: string, fin: string): number {
  let total = 0;
  for (const d of porDia) if (d.fecha >= ini && d.fecha <= fin) total += d.valor;
  return total;
}

const NOMBRE_DIA: Record<number, string> = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };

/**
 * Agenda agrupada por día de la semana (1 = lunes … 5 = viernes), que es como
 * dibujan los gráficos de días. Sábado y domingo se ignoran: esos gráficos solo
 * tienen de lunes a viernes.
 */
export function agendaPorDiaSemana(porDia: AgendaDia[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const d of porDia) {
    // Mediodía: evita que una zona horaria atrasada lleve «2026-11-10» al día anterior.
    const js = new Date(`${d.fecha}T12:00:00`).getDay();   // 0 = domingo
    if (js >= 1 && js <= 5) m.set(js, (m.get(js) ?? 0) + d.valor);
  }
  return m;
}

/**
 * Añade los días de la semana que solo tienen agenda.
 *
 * El servidor devuelve únicamente los días en los que ya se facturó algo, así
 * que el viernes de esta semana —con citas pero sin nada atendido todavía—
 * desaparecería del gráfico justo cuando más interesa verlo.
 */
export function completarDiasConAgenda(rows: DiaSemanaRow[], agenda: Map<number, number>): DiaSemanaRow[] {
  const presentes = new Set(rows.map((r) => r.dia_num));
  const extra: DiaSemanaRow[] = [];
  for (const num of agenda.keys()) {
    if (!presentes.has(num)) extra.push({ dia: NOMBRE_DIA[num] ?? String(num), dia_num: num, promedio: 0, total: 0, atenciones: 0 });
  }
  return [...rows, ...extra].sort((a, b) => a.dia_num - b.dia_num);
}
