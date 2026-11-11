/**
 * Evaluación de la valoración contra lo realmente facturado, sin base de datos.
 *
 * ## Qué mide, y qué NO
 *
 * Toma las citas CUMPLIDAS de un mes ya cerrado, las valora con el historial
 * ANTERIOR a ese mes (para no contaminar la prueba con lo que se quiere
 * predecir) y compara, por EPS, la suma estimada contra lo que ese mes facturó.
 *
 * Mide si la VALORACIÓN es razonable. **No mide cuántas citas se llegan a
 * agendar** (eso es lo que no se puede reconstruir con la API: el estado de la
 * agenda hace diez días ya no existe).
 *
 * ## Cómo leer la «cobertura»
 *
 * `cobertura = estimado ÷ real`. Es normal que sea algo menor a 1: lo facturado
 * incluye líneas que no nacen de una cita (atención sin agendar, ajustes). Lo que
 * importa es que sea ESTABLE y cercana entre EPS: una EPS en 0,4 mientras las
 * demás están en 0,9 es la que está mal valorada.
 */
export interface CitaEvaluada {
    /** `entidad_id` o `nombre:CONVENIO` si no se pudo vincular. */
    entidadKey: string;
    entidad: string;
    estado: 'C' | 'I';
    /** Valor estimado; `null` = sin precio de referencia. */
    valor: number | null;
}
export interface FilaBacktest {
    entidadKey: string;
    entidad: string;
    cumplidas: number;
    incumplidas: number;
    sinPrecio: number;
    estimado: number;
    real: number;
    /** estimado ÷ real; `null` si ese mes no facturó nada a la EPS. */
    cobertura: number | null;
    /** incumplidas ÷ (cumplidas + incumplidas); `null` sin citas. */
    inasistencia: number | null;
}
export interface ResultadoBacktest {
    mes: string;
    filas: FilaBacktest[];
    total: Omit<FilaBacktest, 'entidadKey' | 'entidad'>;
}
export declare function evaluarBacktest(mes: string, citas: CitaEvaluada[], real: Map<string, {
    entidad: string;
    valor: number;
}>): ResultadoBacktest;
//# sourceMappingURL=agenda-backtest.d.ts.map