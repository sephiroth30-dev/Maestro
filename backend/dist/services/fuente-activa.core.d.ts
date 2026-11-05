/**
 * Estado de la fuente activa, sin acceso a base de datos.
 *
 * Está aparte de `fuente-activa.service.ts` para poder probarlo con un lector
 * falso. Y existe, en su forma actual, por tres fallos de la versión anterior
 * que daban la MISMA cifra equivocada —las dos fuentes sumadas— sin avisar:
 *
 * 1. **Se leía una sola vez, al arrancar.** El valor vive en la memoria del
 *    proceso, y Passenger puede tener varios: el clic en «Usar como fuente»
 *    actualizaba el que atendía esa petición y dejaba a los demás con el valor
 *    viejo.
 * 2. **Un fallo de lectura se convertía en «no filtrar».** El `catch` dejaba el
 *    valor en `null`, y `null` significa «no hay fuente marcada, suma todo».
 *    Un hipo de la base al arrancar bastaba para duplicar las cifras de ese
 *    proceso hasta el siguiente reinicio.
 * 3. **Se servían peticiones antes de leerla.** El puerto se abre primero (lo
 *    exige el watchdog de Hostinger), así que durante la conexión a la base
 *    las consultas corrían sin filtro, y su resultado quedaba en caché.
 *
 * La regla de fondo: ante la duda, **no inventar una cifra**. Se conserva el
 * último valor bueno, y si nunca hubo uno, se falla en voz alta.
 */
export type LectorFuente = () => Promise<string | null>;
export interface OpcionesEstado {
    /** Cuánto puede tener la lectura antes de volver a consultarla. */
    maxEdadMs?: number;
    /** Reloj inyectable, para las pruebas. */
    ahora?: () => number;
    /** Se llama cuando una relectura falla y se conserva el valor anterior. */
    alFallar?: (err: unknown) => void;
}
export interface EstadoFuente {
    /** Garantiza una lectura reciente. Lanza solo si NUNCA ha habido una lectura buena. */
    asegurar(): Promise<void>;
    /** Fuerza una relectura ahora mismo (p. ej. tras cambiar la fuente). */
    refrescar(): Promise<void>;
    /** `undefined` = aún no se ha leído; `null` = leída y no hay ninguna marcada. */
    valor(): string | null | undefined;
    /** Solo para pruebas. */
    fijar(v: string | null | undefined): void;
}
export declare function crearEstadoFuente(leer: LectorFuente, opciones?: OpcionesEstado): EstadoFuente;
//# sourceMappingURL=fuente-activa.core.d.ts.map