import type { Cobertura, ResumenDia, FilaResumen } from '../services/incumplidas-plan.js';
/** Cuántas cumplidas e incumplidas hay guardadas entre dos fechas (incluidas): sirve para detectar una respuesta vacía o diezmada. */
export declare function contarVentana(conectorId: string, desde: string, hasta: string): Promise<{
    cumplidas: number;
    incumplidas: number;
}>;
/**
 * Reemplaza TODO el resumen de un rango de fechas, en una transacción. Si algo falla se revierte y lo
 * anterior sigue ahí.
 */
export declare function reemplazarVentana(conectorId: string, desde: string, hasta: string, filas: ResumenDia[]): Promise<void>;
export interface EstadoIncumplidas extends Cobertura {
    conectorId: string;
    ultimoIntento: string | null;
    ultimaOk: string | null;
    estado: 'nunca' | 'ok' | 'error';
    error: string | null;
}
export declare function leerEstado(conectorId?: string): Promise<EstadoIncumplidas | null>;
/** Guarda SOLO los campos que se pasan. Lista cerrada de columnas: nada de lo que llegue se interpola en el SQL. */
export declare function guardarEstado(conectorId: string, cambios: Partial<Omit<EstadoIncumplidas, 'conectorId'>>): Promise<void>;
export interface FiltroIncumplidas {
    conectorId: string;
    desde: string;
    hasta: string;
    entidadId?: string;
    /** `DAYOFWEEK` de MySQL (2 = lunes … 6 = viernes), igual que los demás endpoints. */
    diaSemana?: number;
}
/** Cumplidas e incumplidas por EPS en el filtro, de la que más incumplidas tiene a la que menos. */
export declare function resumenPorEntidad(f: FiltroIncumplidas): Promise<FilaResumen[]>;
//# sourceMappingURL=incumplidas.repo.d.ts.map