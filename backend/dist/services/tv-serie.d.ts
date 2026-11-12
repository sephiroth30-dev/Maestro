/**
 * Serie del día y comparación con el día anterior, sin base de datos ni red.
 *
 * En cada sincronización se guarda una FOTO de las cifras del día (`tv_serie`): con ellas se dibuja
 * el gráfico «lo facturado hoy» como una línea REAL (un punto por sincronización) y se compara con
 * el mismo momento del día anterior. No hay datos por hora de Medifolios: sin estas fotos, no hay
 * historial intradía.
 */
export interface PuntoSerie {
    /** ISO (UTC). */
    ts: string;
    facturado: number;
    atendidas: number;
    pendientes: number;
    incumplidas: number;
}
/** Minuto del día (0–1439) en hora de Colombia. */
export declare function minutoDelDiaBogota(ms: number): number;
/**
 * Valor de la serie en un momento del día: el del ÚLTIMO punto a esa hora o antes (la cifra
 * «vigente» entonces, no una interpolación). `null` si aún no había ningún punto ese día a esa hora.
 */
export declare function puntoEnMomento(puntos: readonly PuntoSerie[], minutoDelDia: number): PuntoSerie | null;
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
export declare function compararConPrevia(hoy: {
    facturado: number;
    atendidas: number;
}, previa: {
    fecha: string;
    puntos: PuntoSerie[];
} | null, ahoraMs: number): VsPrevia | null;
/** Días hábiles (lunes a viernes) de un mes: con ellos se reparte la meta mensual en meta diaria. */
export declare function diasHabilesDelMes(anio: number, mesIdx: number): number;
/** Variación porcentual contra una referencia; `null` si no hay referencia válida (no se inventa). */
export declare function variacionPct(valor: number, referencia: number | null | undefined): number | null;
//# sourceMappingURL=tv-serie.d.ts.map