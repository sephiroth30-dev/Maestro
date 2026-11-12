import { type FilaCruda } from './agenda-mapeo.js';
import { type Movimiento } from './tv-movimientos.js';
export interface EntradaCitasDia {
    conectorId: string;
    ahora: Date;
    /** `YYYY-MM-DD` en hora de Colombia. */
    hoy: string;
    /** Las citas pendientes de la petición principal (todas las fechas de la ventana). */
    pendientes: Array<{
        codAsignacion: number;
        fechaCita: string;
        fechaDia: string;
    }>;
    /** Pendientes guardadas ANTES de este reemplazo (para detectar las nuevas). */
    codigosAgendaPrevios: Set<number>;
    /** `ultima_ok` de la sincronización anterior (para saber si la ventana cambió). */
    ultimaOkPrevia: string | null;
    /** Pide las citas de hoy en un estado. Inyectada para poder probar sin red. */
    pedir: (estado: 'C' | 'I') => Promise<FilaCruda[]>;
}
export declare function actualizarCitasDia(e: EntradaCitasDia): Promise<{
    movimientos: Movimiento[];
    citas: number;
}>;
//# sourceMappingURL=citas-dia.service.d.ts.map