export declare const CRON_SCHEDULES: {
    readonly '30min': "*/30 * * * *";
    readonly '1h': "0 * * * *";
    readonly '4h': "0 */4 * * *";
    readonly daily: "0 20 * * *";
};
/**
 * Cuándo corre la sincronización COMPLETA de un conector incremental: a las
 * 3 a. m., hora de Colombia, cuando nadie mira el dashboard.
 *
 * La incremental solo refresca los últimos meses; esta repara lo que cambie
 * fuera de esa ventana (un consumo anulado o corregido tiempo después) y el
 * conjunto vuelve a coincidir con la fuente cada día.
 */
export declare const CRON_COMPLETA = "0 3 * * *";
export declare function scheduleConnector(conectorId: string, nombre: string, cronExpression: string, opciones?: {
    incremental?: boolean;
}): void;
/** Cada cuánto se sincronizan las citas (L–S, de 6:00 a 19:59, hora de Colombia). */
export declare const CRON_AGENDA = "7,22,37,52 * * * *";
/**
 * Programa la sincronización de las citas pendientes. Es INDEPENDIENTE de la
 * frecuencia del conector (un conector «manual» también puede tener agenda): lo
 * que se agenda cambia durante el día aunque los consumos se carguen una vez.
 *
 * Todos los procesos del servidor programan el mismo cron; el candado del
 * conector hace que solo uno trabaje y los demás se aparten sin fallar.
 */
export declare function scheduleAgenda(conectorId: string, nombre: string): void;
/** Detiene TODO lo programado de un conector: consumos, completa nocturna y agenda. */
export declare function unscheduleConnector(conectorId: string): void;
/** ¿Tiene el conector activada la sincronización incremental? */
export declare function esIncremental(conector: {
    config: unknown;
}): boolean;
export declare function initCron(): Promise<void>;
export declare function stopCron(): void;
//# sourceMappingURL=cron.service.d.ts.map