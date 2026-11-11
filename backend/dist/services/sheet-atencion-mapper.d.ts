import type { DataRow } from '../connectors/base.connector.js';
declare const PATTERNS: {
    fecha: RegExp;
    descripcion: RegExp;
    autorizacion: RegExp;
    entidad: RegExp;
    profesional: RegExp;
    valor: RegExp;
    paciente: RegExp;
    documento: RegExp;
};
export declare function detectColumnMapping(columns: string[]): Record<keyof typeof PATTERNS, string | null>;
export declare function parseSheetDate(raw: unknown): Date | null;
export declare function parseSheetValue(raw: unknown): number;
export declare function hashFila(fields: {
    descripcionRaw: string;
    autorizacion: string;
    entidad: string;
    profesional: string;
    valor: string;
    fecha: string;
    rowIndex: number;
}): string;
export interface ResolverCache {
    entidades: Array<{
        id: string;
        nombres: string[];
    }>;
    profesionales: Array<{
        id: string;
        nombres: string[];
        especialidad: string | null;
    }>;
    servicios: Array<{
        id: string;
        nombre: string;
        palabrasClave: string[];
    }>;
    specialtyUpgrade: Map<string, {
        NEUROLOGIA: string | null;
        FISIATRIA: string | null;
        PEDIATRIA: string | null;
    }>;
}
export declare function buildCache(): Promise<ResolverCache>;
export declare function resolveServicioId(descripcionNorm: string, catalog: Array<{
    id: string;
    nombre: string;
    palabrasClave: string[];
}>, profesionalEspecialidad: string | null, specialtyUpgrade: Map<string, {
    NEUROLOGIA: string | null;
    FISIATRIA: string | null;
    PEDIATRIA: string | null;
}>): string | null;
export declare function resolveId(rawName: string | null | undefined, catalog: Array<{
    id: string;
    nombres: string[];
}>): string | null;
export interface MapperResult {
    created: number;
    skipped: number;
    errors: number;
}
export interface OpcionesMapeo {
    /**
     * `YYYY-MM-DD`. Si viene, es una sincronización INCREMENTAL: solo entran las
     * filas con fecha desde ese día, y el reemplazo borra únicamente las
     * atenciones del conector desde esa fecha, no todas.
     */
    desde?: string;
}
export declare function mapRowsToAtenciones(rows: DataRow[], conectorId: string, opciones?: OpcionesMapeo): Promise<MapperResult>;
export {};
//# sourceMappingURL=sheet-atencion-mapper.d.ts.map