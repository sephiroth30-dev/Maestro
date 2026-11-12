/**
 * Lógica pura de la pantalla de TV. SIN dependencias (ni React ni el resto de la app),
 * para poder probarla desde fuera.
 *
 * Idea central — «vivo honesto»: los datos reales cambian cada 15–30 min como mucho.
 * Entre dos lecturas, los contadores avanzan al RITMO REAL del día para que la pantalla
 * no esté quieta. Esa parte es una estimación: está ACOTADA (nunca pasa de lo que daría
 * el ritmo hasta la próxima lectura esperada), va marcada en pantalla, y se corrige
 * —también hacia abajo— cuando llega el dato real.
 */

export const HORA_INICIO = 6;
export const HORA_FIN = 20;

const OFFSET_BOGOTA_MS = -5 * 3_600_000;   // UTC-5 todo el año

const pad = (n: number): string => String(n).padStart(2, '0');

export interface HoraBogota {
  /** Hora decimal: 14,5 = 2:30 p. m. */
  hora: number;
  /** 0 = domingo … 6 = sábado. */
  diaSemana: number;
  /** `YYYY-MM-DD` */
  fecha: string;
}

/** La hora de la CLÍNICA, sin depender de la zona horaria del equipo donde corre la TV. */
export function horaBogota(ms: number): HoraBogota {
  const l = new Date(ms + OFFSET_BOGOTA_MS);
  return {
    hora: l.getUTCHours() + l.getUTCMinutes() / 60 + l.getUTCSeconds() / 3600,
    diaSemana: l.getUTCDay(),
    fecha: `${l.getUTCFullYear()}-${pad(l.getUTCMonth() + 1)}-${pad(l.getUTCDate())}`,
  };
}

/** Lunes a sábado, de 6:00 a 19:59 (hora de Colombia). */
export function enHorarioLaboral(ms: number): boolean {
  const h = horaBogota(ms);
  return h.diaSemana >= 1 && h.diaSemana <= 6 && h.hora >= HORA_INICIO && h.hora < HORA_FIN;
}

/** Posición del «ahora» en la jornada: 0 a las 6:00, 1 a las 20:00 (acotada). */
export function posicionEnJornada(ms: number): number {
  const { hora } = horaBogota(ms);
  return Math.min(Math.max((hora - HORA_INICIO) / (HORA_FIN - HORA_INICIO), 0), 1);
}

export interface EntreLecturas {
  /** Valor REAL de la última lectura. */
  ancla: number;
  /** Instante (ms) al que corresponde ese valor: el de la sincronización que lo trajo. */
  anclaMs: number;
  ahoraMs: number;
  /** Ritmo real del día por hora, o `null` si aún no se puede calcular. */
  porHora: number | null;
  enHorario: boolean;
  /** Tope: minutos hasta la próxima lectura esperada. */
  topeMin: number;
}

/**
 * Valor que se muestra entre dos lecturas: el real más lo que daría el ritmo del día
 * durante el tiempo transcurrido, con un TOPE.
 *
 * Nunca baja del valor real, y sin ritmo, fuera de horario o con un ritmo no válido
 * devuelve el valor real tal cual. El tope evita que, si la sincronización se atrasa,
 * el contador siga subiendo indefinidamente con una cifra que ya nadie respalda.
 */
export function valorEntreLecturas(p: EntreLecturas): number {
  const { ancla, anclaMs, ahoraMs, porHora, enHorario, topeMin } = p;
  if (!Number.isFinite(ancla)) return 0;
  if (!enHorario || porHora === null || !Number.isFinite(porHora) || porHora <= 0) return ancla;
  if (!Number.isFinite(anclaMs) || !Number.isFinite(ahoraMs) || !Number.isFinite(topeMin) || topeMin <= 0) return ancla;
  const horas = Math.max(0, ahoraMs - anclaMs) / 3_600_000;
  return ancla + porHora * Math.min(horas, topeMin / 60);
}

/**
 * Acerca `actual` a `objetivo` con una transición suave (suavizado exponencial).
 * Funciona igual hacia arriba y hacia abajo: una corrección a la baja se ve, no se esconde.
 */
export function suavizar(actual: number, objetivo: number, dtMs: number, tauMs = 700): number {
  if (!Number.isFinite(objetivo)) return actual;
  if (!Number.isFinite(actual)) return objetivo;
  const diff = objetivo - actual;
  if (Math.abs(diff) < 0.5) return objetivo;
  const k = 1 - Math.exp(-Math.max(dtMs, 0) / Math.max(tauMs, 1));
  return actual + diff * k;
}

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('es-CO');

export const formatoCOP = (n: number): string => COP.format(Math.round(Number.isFinite(n) ? n : 0));
export const formatoNum = (n: number): string => NUM.format(Math.round(Number.isFinite(n) ? n : 0));

/** `$85,7 M`, `$1,2 mil M`, `$850 mil`. */
export function formatoCorto(n: number): string {
  if (!Number.isFinite(n)) return '$0';
  const a = Math.abs(n);
  const signo = n < 0 ? '-' : '';
  const dec = (x: number): string => x.toFixed(1).replace('.', ',').replace(/,0$/, '');
  // Los umbrales son los del REDONDEO: 999.600 no debe salir «$1000 mil» sino «$1 M».
  if (a >= 999_950_000) return `${signo}$${dec(a / 1e9)} mil M`;
  if (a >= 999_500) return `${signo}$${dec(a / 1e6)} M`;
  if (a >= 1e3) return `${signo}$${Math.round(a / 1e3)} mil`;
  return `${signo}$${Math.round(a)}`;
}

/** «hace un momento», «hace 3 min», «hace 2 h». */
export function haceCuanto(deltaMs: number): string {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return 'hace un momento';
  const min = Math.floor(deltaMs / 60_000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} días`;
}

/** `10:37 a. m.` en hora de la clínica, desde un ISO. `—` si no es legible. */
export function horaTexto(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const l = new Date(t + OFFSET_BOGOTA_MS);
  const h = l.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(l.getUTCMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export type SaludDatos = 'vivo' | 'retrasado' | 'sin_conexion';

/** Las citas se sincronizan cada 15 min en horario de trabajo: más de 3 vueltas sin hacerlo es un atraso. */
export const CITAS_ATRASO_MIN = 45;

/**
 * Estado de los datos de la pantalla.
 * - `sin_conexion`: la propia consulta al servidor lleva demasiado sin responder.
 * - `retrasado`: el servidor responde, pero Medifolios lleva demasiado sin sincronizar. Se evalúan
 *   POR SEPARADO los consumos (la cifra principal: facturado y meta) y las citas: que las citas
 *   estén al día no puede esconder que los consumos llevan horas parados.
 *   Solo en horario de trabajo (de noche es normal), y no en la primera media hora de la jornada
 *   (el primer ciclo de sincronización aún no corrió).
 */
export function saludDatos(p: {
  ahoraMs: number;
  ultimaLecturaMs: number | null;
  enHorario: boolean;
  /** `cadenciaMin` null = sincronización manual: no hay cadencia contra la cual juzgar. */
  consumos: { ms: number | null; cadenciaMin: number | null };
  /** null = la agenda de citas no está activada. */
  citas: { ms: number | null } | null;
}): SaludDatos {
  if (p.ultimaLecturaMs === null || p.ahoraMs - p.ultimaLecturaMs > 3 * 60_000) return 'sin_conexion';
  if (!p.enHorario || horaBogota(p.ahoraMs).hora < HORA_INICIO + 0.5) return 'vivo';
  const { consumos, citas } = p;
  if (consumos.cadenciaMin !== null && consumos.ms !== null && p.ahoraMs - consumos.ms > (consumos.cadenciaMin + 15) * 60_000) return 'retrasado';
  if (citas && citas.ms !== null && p.ahoraMs - citas.ms > CITAS_ATRASO_MIN * 60_000) return 'retrasado';
  return 'vivo';
}

export interface MovimientoTv {
  tipo: string;
  cantidad: number;
  valor: number | null;
  detectado_en: string | null;
}

/** Texto de un movimiento para la cinta. El «cuándo» es el de DETECCIÓN, no el de la atención. */
export function textoMovimiento(m: MovimientoTv): string {
  const n = Math.max(0, Math.round(m.cantidad));
  const hora = horaTexto(m.detectado_en);
  switch (m.tipo) {
    case 'atendidas': return `${hora} · +${n} ${n === 1 ? 'cita atendida' : 'citas atendidas'}`;
    case 'incumplidas': return `${hora} · ${n} ${n === 1 ? 'cita incumplida' : 'citas incumplidas'}`;
    case 'agendadas': return `${hora} · +${n} ${n === 1 ? 'cita agendada' : 'citas agendadas'}`;
    case 'facturado': return `${hora} · +${formatoCorto(m.valor ?? 0)} facturados`;
    default: return `${hora} · movimiento`;
  }
}

/** Los siete días desde `hoy` (YYYY-MM-DD), rellenando con ceros los que no traen citas. */
export function proximosSieteDias(
  hoy: string,
  dias: Array<{ fecha: string; citas: number; valor: number }>,
): Array<{ fecha: string; diaSemana: number; citas: number; valor: number }> {
  const [y, m, d] = hoy.split('-').map(Number) as [number, number, number];
  const por = new Map(dias.map((x) => [x.fecha, x]));
  return Array.from({ length: 7 }, (_, i) => {
    const t = new Date(Date.UTC(y, m - 1, d + i));
    const fecha = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
    const x = por.get(fecha);
    return { fecha, diaSemana: t.getUTCDay(), citas: x?.citas ?? 0, valor: x?.valor ?? 0 };
  });
}

export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;
