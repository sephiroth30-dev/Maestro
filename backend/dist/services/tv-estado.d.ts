/**
 * Armado puro de la respuesta de la pantalla de TV, sin base de datos ni red.
 *
 * SOLO agregados: nada de pacientes ni de honorarios. La TV está en una oficina, pero
 * un monitor es visible: lo que no se envía no se puede mostrar.
 */
import type { KpisResult, EntidadRow } from './reportes.service.js';
import type { AgendaResultado } from './agenda-periodo.js';
import { type CitaDia, type ResumenCitasHoy } from './tv-movimientos.js';
import { type PuntoSerie, type VsPrevia } from './tv-serie.js';
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
/** Una EPS como «símbolo» de la pantalla: lo facturado, lo agendado y su variación contra su promedio. */
export interface EpsTv {
    id: string | null;
    entidad: string;
    tipo: string;
    facturado_mes: number;
    facturado_hoy: number;
    agendado_valor: number;
    agendado_citas: number;
    /** Facturado del mes + agendado: un techo, como en Reportes. */
    proyectado: number;
    /** Facturación mensual media de los últimos 3 meses cerrados; `null` sin historial. */
    promedio_3m: number | null;
    /** Proyectado frente a su promedio (la misma comparación que «vs prom. 3 meses» en Reportes); `null` sin promedio. */
    variacion_pct: number | null;
}
export declare const MAX_EPS_TV = 15;
export interface EntidadAgendaTv {
    entidad_id: string | null;
    entidad: string;
    tipo: string;
    citas: number;
    valor: number;
    promedio_3m: number | null;
}
/**
 * Une lo facturado del mes, lo facturado hoy y lo agendado por EPS, y deja las de mayor
 * proyectado. Se cruzan por id; una EPS sin id (sin vincular) se cruza por nombre.
 */
export declare function armarEps(mes: readonly EntidadRow[], hoy: readonly EntidadRow[], agenda: readonly EntidadAgendaTv[]): EpsTv[];
export interface PuntoTv {
    /** ISO. */
    ts: string;
    facturado: number;
    atendidas: number;
    pendientes: number;
    incumplidas: number;
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
    /** Lo facturado y las citas de HOY en cada sincronización (una foto por punto). */
    serie: {
        fecha: string;
        puntos: PuntoTv[];
    };
    /** El día anterior con fotos, para dibujarlo de fondo y comparar a la misma hora. `null` la primera jornada. */
    previa: {
        fecha: string;
        puntos: PuntoTv[];
    } | null;
    vs_previa: VsPrevia | null;
    eps: EpsTv[];
    /** Velas diarias: lo facturado cada día del mes y la meta diaria (presupuesto ÷ días hábiles). */
    dias_mes: {
        meta_dia: number;
        dias: Array<{
            fecha: string;
            facturado: number;
        }>;
    };
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
    entidadesMes: readonly EntidadRow[];
    entidadesHoy: readonly EntidadRow[];
    /** Facturado por día del mes en curso. */
    diarios: ReadonlyArray<{
        fecha: string;
        total: number;
    }>;
    serieHoy: ReadonlyArray<PuntoSerie>;
    seriePrevia: {
        fecha: string;
        puntos: PuntoSerie[];
    } | null;
}
export declare function armarEstadoTv(e: EntradaEstadoTv): EstadoTv;
//# sourceMappingURL=tv-estado.d.ts.map