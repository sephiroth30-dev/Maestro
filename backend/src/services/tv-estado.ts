/**
 * Armado puro de la respuesta de la pantalla de TV, sin base de datos ni red.
 *
 * SOLO agregados: nada de pacientes ni de honorarios. La TV está en una oficina, pero
 * un monitor es visible: lo que no se envía no se puede mostrar.
 */

import type { KpisResult } from './reportes.service.js';
import type { AgendaResultado } from './agenda-periodo.js';
import { enHorarioLaboral } from './agenda-ventana.js';
import { resumenCitasHoy, type CitaDia, type ResumenCitasHoy } from './tv-movimientos.js';
import { aIso } from './agenda-periodo.js';

/** Horario de trabajo de la clínica, hora de Colombia: lunes a sábado, de 6:00 a 19:59. */
export const HORA_INICIO = 6;
export const HORA_FIN = 20;

export interface MovimientoTv {
  tipo: string;
  cantidad: number;
  valor: number | null;
  /** Cuándo se DETECTÓ (al sincronizar), no cuándo ocurrió. ISO. */
  detectado_en: string | null;
}

export interface EstadoTv {
  generado_en: string;
  hoy: string;
  version: string;
  reloj: { en_horario: boolean; hora_inicio: number; hora_fin: number };
  meta: {
    mes_idx: number; anio: number;
    presupuesto: number; facturado_mes: number; cumplimiento_pct: number;
    facturado_hoy: number; atenciones_mes: number;
    dias_transcurridos: number; dias_restantes: number;
    proyeccion_ritmo: number;
    agendado_mes: { citas: number; valor: number; citas_sin_valor: number };
    /** Atendido + agendado del mes: un techo (no descuenta la inasistencia). */
    proyectado: number;
  };
  ritmo: {
    /** Horas laborales transcurridas hoy (0 – 14). */
    horas_transcurridas: number;
    /** Pesos facturados por hora laboral hoy; `null` si es muy temprano para saberlo. */
    facturado_por_hora: number | null;
    atendidas_por_hora: number | null;
  };
  citas_hoy: ResumenCitasHoy & {
    actualizado_en: string | null;
    es_de_hoy: boolean;
    /** Resultado de la última lectura de las citas de hoy: `error` = falló (ver Diagnóstico); `nunca` = aún no corrió. */
    lectura: 'ok' | 'error' | 'nunca';
  };
  agenda: {
    actualizado_en: string | null;
    horizonte: string | null;
    total: { citas: number; valor: number; citas_sin_valor: number };
    proximos_dias: Array<{ fecha: string; citas: number; valor: number }>;
    top_entidades: Array<{ entidad: string; citas: number; valor: number }>;
  };
  movimientos: MovimientoTv[];
  actualizado: {
    consumos: string | null;
    citas: string | null;
    /** Cada cuántos minutos se sincronizan los consumos (30, 60, 240, 1440), o `null` si es manual. */
    cadencia_consumos_min: number | null;
  };
}

/** Hora decimal en Colombia (UTC-5): 14,5 = 2:30 p. m. */
export function horaDecimalBogota(ahora: Date): number {
  const l = new Date(ahora.getTime() - 5 * 3_600_000);
  return l.getUTCHours() + l.getUTCMinutes() / 60 + l.getUTCSeconds() / 3600;
}

/**
 * Ritmo del día: lo hecho hoy dividido entre las horas laborales transcurridas.
 *
 * Con menos de una hora de jornada NO se calcula: dividir por casi cero daría un ritmo
 * disparatado. Fuera de horario las horas quedan en el tope.
 * El consumo no trae hora de atención, así que el ritmo del facturado es LINEAL sobre la
 * jornada: una aproximación, no un perfil horario real.
 */
export function ritmoDelDia(ahora: Date, facturadoHoy: number, atendidasHoy: number): EstadoTv['ritmo'] {
  // Mínimo una hora de jornada: antes, el ritmo es ruido (a las 6:30 una sola cita ya sería «2 por hora») y
  // el contador se adelantaría mucho a lo real.
  const h = horaDecimalBogota(ahora);
  const horas = Math.min(Math.max(h - HORA_INICIO, 0), HORA_FIN - HORA_INICIO);
  if (horas < 1) return { horas_transcurridas: Math.round(horas * 100) / 100, facturado_por_hora: null, atendidas_por_hora: null };
  return {
    horas_transcurridas: Math.round(horas * 100) / 100,
    facturado_por_hora: facturadoHoy > 0 ? Math.round(facturadoHoy / horas) : 0,
    atendidas_por_hora: Math.round((atendidasHoy / horas) * 10) / 10,
  };
}

export interface EntradaEstadoTv {
  ahora: Date;
  hoy: string;
  version: string;
  mesIdx: number;
  anio: number;
  kpis: KpisResult;
  agendaMes: AgendaResultado;
  agendaSemana: AgendaResultado;
  citasDia: { fechaDia: string; syncEn: string; citas: CitaDia[] } | null;
  movimientos: Array<{ creado: string; tipo: string; cantidad: number; valor: number | null }>;
  consumosActualizado: string | null;
  cadenciaConsumosMin: number | null;
  lecturaCitasDia?: 'ok' | 'error' | null;
}

export function armarEstadoTv(e: EntradaEstadoTv): EstadoTv {
  const esDeHoy = e.citasDia !== null && e.citasDia.fechaDia === e.hoy;
  // Si las citas guardadas son de otro día NO se muestran como de hoy: cero, y se avisa.
  const resumen = resumenCitasHoy(esDeHoy ? e.citasDia!.citas : []);
  const k = e.kpis;
  const agendaMes = e.agendaMes.total;

  return {
    generado_en: e.ahora.toISOString(),
    hoy: e.hoy,
    version: e.version,
    reloj: { en_horario: enHorarioLaboral(e.ahora), hora_inicio: HORA_INICIO, hora_fin: HORA_FIN },
    meta: {
      mes_idx: e.mesIdx, anio: e.anio,
      presupuesto: k.presupuesto,
      facturado_mes: k.facturacion_bruta,
      cumplimiento_pct: k.cumplimiento_pct,
      facturado_hoy: k.facturacion_hoy,
      atenciones_mes: k.atenciones,
      dias_transcurridos: k.dias_transcurridos,
      dias_restantes: k.dias_restantes,
      proyeccion_ritmo: k.proyeccion_cierre,
      agendado_mes: { citas: agendaMes.citas, valor: agendaMes.valor, citas_sin_valor: agendaMes.citas_sin_valor },
      proyectado: k.facturacion_bruta + agendaMes.valor,
    },
    ritmo: ritmoDelDia(e.ahora, k.facturacion_hoy, resumen.atendidas),
    citas_hoy: {
      ...resumen, actualizado_en: esDeHoy ? aIso(e.citasDia!.syncEn) : null, es_de_hoy: esDeHoy,
      // Aunque haya una lectura de ayer guardada, si la última intentada falló, se dice.
      lectura: e.lecturaCitasDia === 'error' ? 'error' : esDeHoy ? 'ok' : 'nunca',
    },
    agenda: {
      actualizado_en: e.agendaSemana.actualizado_en,
      horizonte: e.agendaSemana.horizonte,
      total: e.agendaMes.total,
      proximos_dias: e.agendaSemana.por_dia,
      top_entidades: [...e.agendaMes.por_entidad]
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5)
        .map((x) => ({ entidad: x.entidad, citas: x.citas, valor: x.valor })),
    },
    movimientos: e.movimientos.map((m) => ({ tipo: m.tipo, cantidad: m.cantidad, valor: m.valor, detectado_en: aIso(m.creado) })),
    actualizado: { consumos: e.consumosActualizado, citas: e.agendaMes.actualizado_en, cadencia_consumos_min: e.cadenciaConsumosMin },
  };
}
