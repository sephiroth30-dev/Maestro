import { type FilaCruda } from './agenda-mapeo.js';
import type { Conector } from '@prisma/client';
export interface ResultadoCitasSync {
    ok: boolean;
    /** No se ejecutó: agenda desactivada, o ya había otra sincronización en curso. */
    omitida?: boolean;
    motivo?: string;
    citasLeidas?: number;
    citasGuardadas?: number;
    citasSinPrecio?: number;
    horizonte?: string | null;
    duracionMs?: number;
    error?: string;
    httpStatus?: number | null;
}
export interface ConfigAgenda {
    endpointCitas: string;
    endpointConvenios: string;
}
export declare function configAgenda(conector: Conector): ConfigAgenda | null;
/**
 * Código HTTP del mensaje de error del conector, o `null`. Un fallo del LOGIN
 * («Login falló: HTTP 403») NO cuenta: no es falta del permiso de la consulta, y
 * decirlo mandaría a pedir un permiso que no es el problema.
 */
export declare const statusDe: (msg: string) => number | null;
/**
 * Lee las citas de Medifolios con los filtros dados. Comparte credencial y token
 * con el conector; quien la llame debe tener su candado.
 *
 * Nunca pide canceladas ni imagenología: no consumen la agenda.
 */
export declare function pedirCitas(conector: Conector, cfg: ConfigAgenda, filtros: Record<string, string>): Promise<FilaCruda[]>;
/** Debe llamarse con el candado del conector en la mano. */
export declare function sincronizarCitas(conectorId: string, opciones?: {
    manual?: boolean;
}): Promise<ResultadoCitasSync>;
/** Toma el candado del conector; si otra sincronización lo tiene, se omite sin fallar. */
export declare function sincronizarCitasConCandado(conectorId: string, opciones?: {
    manual?: boolean;
}): Promise<ResultadoCitasSync>;
/** ¿Tiene el conector activada la agenda de citas? */
export declare function agendaActiva(conector: {
    config: unknown;
    tipo?: string;
}): boolean;
//# sourceMappingURL=citas-sync.service.d.ts.map