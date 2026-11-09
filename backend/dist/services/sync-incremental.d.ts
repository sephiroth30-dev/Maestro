/**
 * Sincronización incremental: qué ventana de fechas se refresca y cuándo toca
 * una sincronización completa. Sin acceso a base de datos ni a la API, para poder
 * probarlo.
 *
 * ## Por qué existe
 *
 * Cada sincronización bajaba TODO el histórico (200 filas por página, el máximo
 * que admite la API) y reemplazaba todas las atenciones del conector: con varios
 * años cargados, unos 25 minutos por vuelta, hora tras hora. Pero solo se mueve
 * lo reciente: un consumo antiguo casi nunca cambia.
 *
 * ## Cómo funciona
 *
 * La sincronización incremental pide a la API únicamente desde `desde` y
 * reemplaza **solo** las atenciones del conector con `fecha_dia >= desde`. El
 * resto del histórico no se toca.
 *
 * Es seguro con el `hash_fila` actual (único a nivel global, e incluye la
 * posición de la fila en la descarga) **porque el hash también incluye la
 * fecha**: las filas de la ventana y las anteriores a ella nunca pueden tener el
 * mismo hash. Eso solo se sostiene si las filas que entran se filtran a la
 * ventana (`fechaEnVentana`), por si la API devolviera alguna anterior.
 */
export type ModoSync = 'completa' | 'incremental';
export type ModoSolicitado = ModoSync | 'auto';
export declare const VENTANA_MESES_POR_DEFECTO = 2;
/**
 * Primer día de la ventana, `YYYY-MM-DD`.
 *
 * `ventanaMeses = 2` es «el mes actual y el anterior»: un consumo puede
 * corregirse hasta que se cierra el mes, así que refrescar solo el actual
 * dejaría sin actualizar los ajustes del mes que acaba de terminar.
 *
 * Se calcula en hora de Colombia: a las 9 p. m. del 31 de octubre ya es 1 de
 * noviembre en UTC, y con el reloj del servidor la ventana saltaría un mes antes
 * de tiempo.
 */
export declare function ventanaDesde(ahora: Date, ventanaMeses: number): string;
export interface EntradaModo {
    /** Si el conector tiene la sincronización incremental activada. */
    incrementalActivo: boolean;
    /** Lo que pidió quien disparó la sincronización. */
    pedido: ModoSolicitado;
    /** Cuántas atenciones de este conector hay ya guardadas. */
    filasExistentes: number;
}
/**
 * Qué tipo de sincronización toca.
 *
 * Es completa si el conector no tiene la incremental activada, si se pidió
 * expresamente, o si **aún no hay datos**: una incremental sobre un conector
 * vacío cargaría solo dos meses y dejaría el resto del histórico sin traer,
 * sin ningún aviso.
 */
export declare function decidirModo({ incrementalActivo, pedido, filasExistentes }: EntradaModo): ModoSync;
/** ¿La fecha cae dentro de la ventana? `desde` es `YYYY-MM-DD`, inclusivo. */
export declare function fechaEnVentana(fecha: Date, desde: string): boolean;
//# sourceMappingURL=sync-incremental.d.ts.map