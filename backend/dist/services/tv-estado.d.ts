/**
 * Armado puro de la respuesta de la pantalla de TV, sin base de datos ni red.
 *
 * SOLO agregados: nada de pacientes ni de honorarios. La TV está en una oficina, pero
 * un monitor es visible: lo que no se envía no se puede mostrar.
 */
import type { KpisResult } from './reportes.service.js';
import type { AgendaResultado } from './agenda-periodo.js';
import { type CitaDia, type ResumenCitasHoy } from './tv-movimientos.js';
/** Horario de trabajo de la clínica, hora de Colombia: lunes a sábado, de 6:00 a 19:59. */
export declare const HORA_INICIO = 6;
export declare const HORA_FIN = 20;
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
    reloj: {
        en_horario: boolean;
        hora_inicio: number;
        hora_fin: number;
    };
    meta: {
        mes_idx: number;
        anio: number;
        presupuesto: number;
        facturado_mes: number;
        cumplimiento_pct: number;
        facturado_hoy: number;
        atenciones_mes: number;
        dias_transcurridos: number;
        dias_restantes: number;
        proyeccion_ritmo: number;
        agendado_mes: {
            citas: number;
            valor: number;
            citas_sin_valor: number;
        };
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
        total: {
            citas: number;
            valor: number;
            citas_sin_valor: number;
        };
        proximos_dias: Array<{
            fecha: string;
            citas: number;
            valor: number;
        }>;
        top_entidades: Array<{
            entidad: string;
            citas: number;
            valor: number;
        }>;
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
export declare function horaDecimalBogota(ahora: Date): number;
/**
 * Ritmo del día: lo hecho hoy dividido entre las horas laborales transcurridas.
 *
 * Con menos de una hora de jornada NO se calcula: dividir por casi cero daría un ritmo
 * disparatado. Fuera de horario las horas quedan en el tope.
 * El consumo no trae hora de atención, así que el ritmo del facturado es LINEAL sobre la
 * jornada: una aproximación, no un perfil horario real.
 */
export declare function ritmoDelDia(ahora: Date, facturadoHoy: number, atendidasHoy: number): EstadoTv['ritmo'];
export interface EntradaEstadoTv {
    ahora: Date;
    hoy: string;
    version: string;
    mesIdx: number;
    anio: number;
    kpis: KpisResult;
    agendaMes: AgendaResultado;
    agendaSemana: AgendaResultado;
    citasDia: {
        fechaDia: string;
        syncEn: string;
        citas: CitaDia[];
    } | null;
    movimientos: Array<{
        creado: string;
        tipo: string;
        cantidad: number;
        valor: number | null;
    }>;
    consumosActualizado: string | null;
    cadenciaConsumosMin: number | null;
    lecturaCitasDia?: 'ok' | 'error' | null;
}
export declare function armarEstadoTv(e: EntradaEstadoTv): EstadoTv;
//# sourceMappingURL=tv-estado.d.ts.map