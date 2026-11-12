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

// ─── Terminal de bolsa: sesión, variaciones, mapa de calor y gráfico ───────────

export interface Sesion {
  abierta: boolean;
  /** «Sesión abierta · cierra en 2 h 29 min» / «Sesión cerrada · abre mañana 6:00 a. m.». */
  texto: string;
  /** Avance de la jornada: 0 a las 6:00, 1 a las 20:00. */
  progreso: number;
}

/** Estado de la «sesión» (la jornada de la clínica), a la manera de un mercado: abre, cierra, abre mañana. */
export function estadoSesion(ms: number): Sesion {
  const h = horaBogota(ms);
  // Minutos enteros desde la medianoche (sin pasar por la hora decimal: 8:10:00 daría 489,99… y 1 min de más).
  const l = new Date(ms + OFFSET_BOGOTA_MS);
  const min = l.getUTCHours() * 60 + l.getUTCMinutes();
  const cierre = HORA_FIN * 60;
  if (enHorarioLaboral(ms)) {
    const faltan = cierre - min;
    const hh = Math.floor(faltan / 60);
    const mm = faltan % 60;
    const t = hh > 0 ? `${hh} h ${mm} min` : `${mm} min`;
    return { abierta: true, texto: `Sesión abierta · cierra en ${t}`, progreso: posicionEnJornada(ms) };
  }
  // Abre mañana, salvo sábado en la noche o domingo (abre el lunes), o de madrugada (abre hoy a las 6:00).
  const madrugada = h.hora < HORA_INICIO && h.diaSemana !== 0;
  const cuando = madrugada ? `abre hoy a las ${HORA_INICIO}:00 a. m.`
    : h.diaSemana === 6 || h.diaSemana === 0 ? `abre el lunes a las ${HORA_INICIO}:00 a. m.`
    : `abre mañana a las ${HORA_INICIO}:00 a. m.`;
  return { abierta: false, texto: `Sesión cerrada · ${cuando}`, progreso: h.hora >= HORA_FIN ? 1 : 0 };
}

/** `▲ +$1,4 M` / `▼ −$500 mil` / `—` si no hay dato. El signo se dibuja con las flechas. */
export function textoDelta(n: number | null | undefined, formato: (x: number) => string = formatoCorto): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  if (n === 0) return '= igual';
  return `${n > 0 ? '▲ +' : '▼ −'}${formato(Math.abs(n))}`;
}

export type SignoDelta = 'sube' | 'baja' | 'igual' | 'nada';
export function signoDelta(n: number | null | undefined): SignoDelta {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'nada';
  return n > 0 ? 'sube' : n < 0 ? 'baja' : 'igual';
}

/** `▲ +12,3 %` / `▼ −4,1 %` / `—`. */
export function textoPct(p: number | null | undefined): string {
  if (p === null || p === undefined || !Number.isFinite(p)) return '—';
  const v = Math.abs(p).toFixed(1).replace('.', ',');
  return p === 0 ? '= 0 %' : `${p > 0 ? '▲ +' : '▼ −'}${v} %`;
}

/**
 * Color de un cuadro del mapa de calor según la variación contra el promedio. Sin variación (sin
 * historial) es gris: NO se pinta de verde ni de rojo lo que no se puede comparar. Se satura a ±30 %.
 */
export function colorVariacion(pct: number | null | undefined): string {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return 'hsl(220, 18%, 22%)';
  const t = Math.min(Math.abs(pct), 30) / 30;
  return pct >= 0 ? `hsl(150, ${40 + t * 25}%, ${20 + t * 14}%)` : `hsl(2, ${45 + t * 25}%, ${22 + t * 14}%)`;
}

export interface RectTm { x: number; y: number; w: number; h: number }

/**
 * Mapa de calor (treemap «squarified», Bruls et al.): reparte un rectángulo `w × h` entre los
 * elementos, con ÁREA PROPORCIONAL a su peso y cuadros lo más cuadrados posible. Los pesos ≤ 0 o no
 * numéricos se descartan. Devuelve los elementos con su rectángulo, del mayor al menor.
 */
export function treemap<T extends { peso: number }>(items: readonly T[], w = 100, h = 100): Array<T & RectTm> {
  const validos = items.filter((i) => Number.isFinite(i.peso) && i.peso > 0).sort((a, b) => b.peso - a.peso);
  const total = validos.reduce((s, i) => s + i.peso, 0);
  if (validos.length === 0 || total <= 0 || w <= 0 || h <= 0) return [];
  const area = w * h;
  const cola = validos.map((i) => ({ item: i, a: (i.peso / total) * area }));
  const salida: Array<T & RectTm> = [];

  let x = 0, y = 0, ancho = w, alto = h;
  const peor = (fila: Array<{ a: number }>, lado: number): number => {
    const s = fila.reduce((t, f) => t + f.a, 0);
    const max = Math.max(...fila.map((f) => f.a));
    const min = Math.min(...fila.map((f) => f.a));
    return Math.max((lado * lado * max) / (s * s), (s * s) / (lado * lado * min));
  };

  while (cola.length > 0) {
    const lado = Math.min(ancho, alto);
    const fila: typeof cola = [cola.shift()!];
    while (cola.length > 0 && peor([...fila, cola[0]!], lado) <= peor(fila, lado)) fila.push(cola.shift()!);
    const suma = fila.reduce((s, f) => s + f.a, 0);
    if (ancho >= alto) {
      // La fila se coloca en una columna a la izquierda
      const anchoFila = suma / alto;
      let yy = y;
      for (const f of fila) { const hh = f.a / anchoFila; salida.push({ ...f.item, x, y: yy, w: anchoFila, h: hh }); yy += hh; }
      x += anchoFila; ancho -= anchoFila;
    } else {
      const altoFila = suma / ancho;
      let xx = x;
      for (const f of fila) { const ww = f.a / altoFila; salida.push({ ...f.item, x: xx, y, w: ww, h: altoFila }); xx += ww; }
      y += altoFila; alto -= altoFila;
    }
  }
  return salida;
}

export interface PuntoGrafico { ts: string; facturado: number }

/** Posición horizontal (0–1) de un instante dentro de la jornada de 6:00 a 20:00. */
export function xEnJornada(ms: number): number {
  return posicionEnJornada(ms);
}

export interface GeometriaGrafico {
  /** Puntos de la línea, en coordenadas del lienzo, empezando en la apertura con 0 acumulado. */
  linea: Array<{ x: number; y: number }>;
  fantasma: Array<{ x: number; y: number }>;
  /** Tope del eje vertical. */
  max: number;
}

/**
 * Convierte las series (hoy y el día anterior) en coordenadas de un lienzo `ancho × alto`.
 * El acumulado arranca en 0 a las 6:00. El eje vertical sale del mayor valor de las dos series
 * (más un 15 % de aire), para que se vean en la misma escala.
 */
export function geometriaGrafico(
  hoy: readonly PuntoGrafico[],
  previa: readonly PuntoGrafico[] | null,
  ancho: number,
  alto: number,
  extra: number | null = null,
): GeometriaGrafico {
  const validos = (xs: readonly PuntoGrafico[]): Array<{ t: number; v: number }> =>
    xs.map((p) => ({ t: Date.parse(p.ts), v: p.facturado })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)).sort((a, b) => a.t - b.t);
  const a = validos(hoy);
  const b = previa ? validos(previa) : [];
  const max = Math.max(1, ...a.map((p) => p.v), ...b.map((p) => p.v), extra ?? 0) * 1.15;
  const aCoord = (xs: Array<{ t: number; v: number }>): Array<{ x: number; y: number }> => [
    { x: 0, y: alto },
    ...xs.map((p) => ({ x: xEnJornada(p.t) * ancho, y: alto - (Math.max(0, p.v) / max) * alto })),
  ];
  return { linea: aCoord(a), fantasma: b.length > 0 ? aCoord(b) : [], max };
}

/** Un trazo `M x y L x y …` a partir de puntos. */
export function trazo(puntos: ReadonlyArray<{ x: number; y: number }>): string {
  return puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export interface Vela {
  fecha: string;
  dia: number;
  diaSemana: number;
  facturado: number;
  /** `futura` aún no llega; `hoy` está en curso; `pasada` ya cerró. */
  estado: 'pasada' | 'hoy' | 'futura';
  /** Solo los días hábiles (lunes a viernes) se juzgan contra la meta diaria; el sábado es neutro. */
  juzgable: boolean;
  /** `true` = alcanzó la meta del día; `null` si no se juzga (sábado, hoy, futura, sin dato o sin meta). */
  cumple: boolean | null;
  /** Un día pasado del que no hay NINGÚN dato (festivo, antes de cargar datos): no se pinta de rojo. */
  sinDato: boolean;
  /** Cuánto de la meta diaria se alcanzó: `ok` ≥ 100 %, `medio` 80–99 %, `bajo` < 80 %; `null` si no se juzga. */
  nivel: 'ok' | 'medio' | 'bajo' | null;
}

/** Umbral de «casi llegó»: entre el 80 % y el 100 % de la meta diaria la vela va en ámbar, no en rojo. */
export const UMBRAL_MEDIO = 0.8;

/**
 * Un día por vela, de todo el mes salvo domingos, con su estado frente a la meta diaria.
 * Sin meta (`metaDia ≤ 0`: presupuesto sin cargar) NO se juzga ningún día: todo «cumpliría» una meta de $0.
 * Un día pasado sin ningún dato (festivo, antes de empezar a cargar) es «sin dato», no «no cumplió».
 */
export function velasDelMes(
  hoy: string,
  dias: ReadonlyArray<{ fecha: string; facturado: number }>,
  metaDia: number,
): Vela[] {
  const [y, m] = hoy.split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const por = new Map(dias.map((d) => [d.fecha, d.facturado]));
  const out: Vela[] = [];
  for (let d = 1; d <= ultimo; d++) {
    const fecha = `${y}-${pad(m)}-${pad(d)}`;
    const diaSemana = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (diaSemana === 0) continue;
    const estado: Vela['estado'] = fecha < hoy ? 'pasada' : fecha === hoy ? 'hoy' : 'futura';
    const facturado = por.get(fecha) ?? 0;
    const sinDato = estado === 'pasada' && !por.has(fecha);
    const juzgable = diaSemana >= 1 && diaSemana <= 5 && estado === 'pasada' && !sinDato && metaDia > 0;
    const ratio = juzgable ? facturado / metaDia : null;
    out.push({
      fecha, dia: d, diaSemana, facturado, estado, juzgable, cumple: juzgable ? facturado >= metaDia : null, sinDato,
      nivel: ratio === null ? null : ratio >= 1 ? 'ok' : ratio >= UMBRAL_MEDIO ? 'medio' : 'bajo',
    });
  }
  return out;
}

/** `10:31:07 a. m.` en hora de la clínica, desde milisegundos. */
export function horaConSegundos(ms: number): string {
  const l = new Date(ms + OFFSET_BOGOTA_MS);
  const h = l.getUTCHours();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(l.getUTCMinutes())}:${pad(l.getUTCSeconds())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}
