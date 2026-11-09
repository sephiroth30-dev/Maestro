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