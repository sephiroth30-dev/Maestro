/**
 * Candado de sincronización entre procesos, sin acceso directo a la base.
 *
 * Existe porque nada impedía que una misma fuente se sincronizara varias veces
 * a la vez. Cada proceso del servidor (Passenger puede tener varios) programa el
 * mismo cron y, al arrancar, lanza además un «catch-up», así que a la hora en
 * punto salían varias sincronizaciones simultáneas del mismo conector. Con una
 * API que paga cada página, y un guardado que es «borrar todo y reinsertar», eso
 * producía dos fallos distintos en el historial:
 *
 * - **HTTP 401.** Si Medifolios emite un solo token vigente por usuario, cada
 *   proceso que entra invalida el token del anterior: se pisan entre ellos.
 * - **Duplicate entry en `atenciones_hash_fila_key`.** Dos sincronizaciones
 *   terminan casi a la vez e insertan las mismas filas (mismo hash); la segunda
 *   choca con la primera. Tras ~25 minutos de descarga, no queda nada.
 *
 * Se usa `GET_LOCK` de MySQL porque lo ven todos los procesos y, a diferencia de
 * una marca en una tabla, **se libera solo si el proceso muere**: MySQL lo
 * suelta al cerrarse la conexión que lo tiene. Una marca `EN_PROCESO` huérfana
 * habría bloqueado la fuente para siempre sin un plazo de caducidad que adivinar.
 */
/** Lo mínimo que se necesita de una conexión MySQL; permite probarlo con una falsa. */
export interface ConexionCandado {
    query(sql: string, params?: unknown[]): Promise<unknown>;
    release(): void;
    destroy?(): void;
}
export interface CandadoSync {
    /** Suelta el candado y devuelve la conexión. Seguro de llamar más de una vez. */
    liberar(): Promise<void>;
    /** `true` si la conexión que lo sostenía se cayó: el candado ya no está garantizado. */
    perdido(): boolean;
}
export interface OpcionesCandado {
    /** Cada cuánto se «toca» la conexión para que el servidor no la cierre por inactividad. */
    heartbeatMs?: number;
    /** Se llama una vez si la conexión se cae mientras se sostiene el candado. */
    alPerder?: (err: unknown) => void;
}
export declare function nombreCandado(conectorId: string): string;
export declare function crearAdquisidor(obtenerConexion: () => Promise<ConexionCandado>, opciones?: OpcionesCandado): (conectorId: string) => Promise<CandadoSync | null>;
//# sourceMappingURL=sync-lock.core.d.ts.map