import type { DataRow } from '../connectors/base.connector.js';
declare const PATTERNS: {
    fecha: RegExp;
    descripcion: RegExp;
    autorizacion: RegExp;
    entidad: RegExp;
    profesional: RegExp;
    valor: RegExp;
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
}): string;
export interface MapperResult {
    created: number;
    skipped: number;
    errors: number;
}
export declare function mapRowsToAtenciones(rows: DataRow[], conectorId: string): Promise<MapperResult>;
export {};
//# sourceMappingURL=sheet-atencion-mapper.d.ts.map