/**
 * Adquiere el candado de sincronización de un conector, o devuelve `null` si otra
 * sincronización de ese mismo conector ya está corriendo en cualquier proceso.
 *
 * Ver `sync-lock.core.ts` para el porqué.
 */
export declare const adquirirCandadoSync: (conectorId: string) => Promise<import("./sync-lock.core.js").CandadoSync | null>;
//# sourceMappingURL=sync-lock.service.d.ts.map