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
export declare function movimientosCitasDia(previas: Map<number, EstadoCita> | null, actuales: CitaDia[]): Movimiento[];
/**
 * Citas pendientes NUEVAS desde la lectura anterior.
 *
 * Solo es válido si la ventana de citas es la misma: al cambiar de mes la ventana
 * (de hoy al fin del mes siguiente) se alarga y entran de golpe cientos de citas que
 * no son nuevas.
 */
export declare function movimientosAgenda(codigosPrevios: ReadonlySet<number> | null, codigosActuales: readonly number[], mismaVentana: boolean): Movimiento[];
/** Una lectura más vieja que esto ya no sirve para comparar: un hueco no es un movimiento. */
export declare const LECTURA_PREVIA_MAX_MS: number;
/**
 * ¿Se puede comparar con la sincronización anterior? Solo si fue reciente (< 3 h: tras una caída
 * larga todo lo agendado en el hueco saldría como un solo «+N») Y su ventana de citas termina el
 * mismo día que la de ahora (si cambió el mes, la ventana se alarga y entrarían cientos de «nuevas»).
 */
export declare function mismaVentanaDeCitas(ultimaOkPrevia: string | null, ahora: Date): boolean;
/**
 * Aumento de lo facturado hoy entre dos lecturas. Solo si sube: una baja (un ajuste,
 * un consumo anulado) no es un «movimiento» que celebrar y no se muestra.
 */
export declare function movimientoFacturado(antes: number | null, despues: number): Movimiento | null;
export interface ResumenCitasHoy {
    atendidas: number;
    pendientes: number;
    incumplidas: number;
    total: number;
    por_hora: Array<{
        hora: number;
        pendientes: number;
        atendidas: number;
        incumplidas: number;
    }>;
}
/** Resumen del día y reparto por hora de inicio. */
export declare function resumenCitasHoy(citas: readonly CitaDia[]): ResumenCitasHoy;
/**
 * Une las tres listas de hoy en una por cita. Si una cita aparece en dos estados
 * (cambió entre una petición y otra), manda el estado más avanzado: cumplida e
 * incumplida sobre pendiente.
 */
export declare function unirCitasDia(pendientes: CitaDia[], cumplidas: CitaDia[], incumplidas: CitaDia[]): CitaDia[];
//# sourceMappingURL=tv-movimientos.d.ts.map