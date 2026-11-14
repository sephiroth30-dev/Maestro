import { type FilaCruda, type FilaCita } from './agenda-mapeo.js';
import { type Tarea } from './incumplidas-plan.js';
/**
 * Sincronización del resumen de citas CUMPLIDAS e INCUMPLIDAS. Se llama desde la sincronización de citas, DENTRO
 * del candado del conector (misma credencial: Medifolios da un solo token por usuario). Nunca debe estropear la
 * agenda: quien la llama captura sus errores. Ver `incumplidas-plan.ts` para qué se pide en cada vuelta.
 */
export interface EntradaIncumplidas {
    conectorId: string;
    ahora: Date;
    /** `YYYY-MM-DD` en hora de Colombia. */
    hoy: string;
    /** Pide las citas de un estado (`C` cumplida, `I` incumplida) entre dos fechas. Inyectada para poder probar sin red. */
    pedir: (desde: string, hasta: string, estado: 'C' | 'I') => Promise<FilaCruda[]>;
    /** EPS de una cita (por el catálogo de convenios o por los alias de Entidades). */
    entidadDe: (f: FilaCita) => string | null;
    /**
     * Salta la guarda de «respuesta sospechosa». Es para el botón manual: si Medifolios reclasificó muchas citas de
     * verdad, la guarda bloquearía la sincronización para siempre (el conteo previo sale de la propia base).
     */
    forzar?: boolean;
}
export interface ResultadoIncumplidas {
    tareas: Array<{
        tipo: Tarea['tipo'];
        desde: string;
        hasta: string;
        cumplidas: number;
        incumplidas: number;
    }>;
}
export declare function sincronizarIncumplidas(e: EntradaIncumplidas): Promise<ResultadoIncumplidas>;
//# sourceMappingURL=incumplidas-sync.service.d.ts.map