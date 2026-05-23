/**
 * Normalizes a service description string using the same algorithm as
 * Apps Script V10.2 used in the Neurofic Google Sheets billing tracker.
 */
export declare function normalizeDescripcion(descRaw: string): string;
/**
 * Generates a deterministic SHA-256 hash for a billing row.
 * Used to deduplicate rows imported from Google Sheets.
 */
export declare function hashFila(fields: {
    descripcionRaw: string;
    autorizacion: string;
    entidad: string;
    profesional: string;
    valor: string;
    fecha: string;
}): string;
//# sourceMappingURL=normalizacion.service.d.ts.map