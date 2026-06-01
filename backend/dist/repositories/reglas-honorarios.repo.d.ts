export interface ReglaHonorariosRow {
    id: string;
    profesional_nombre: string;
    categoria: string;
    tipo: 'fijo' | 'pct';
    valor_entidad: number;
    valor_particular: number;
    activo: boolean;
    notas: string | null;
}
export interface ReglaEspecialRow {
    id: string;
    tipo_regla: string;
    profesional_nombre: string;
    condicion: string | null;
    valor: number;
    descripcion: string | null;
    activo: boolean;
}
export declare function findAllReglas(): Promise<ReglaHonorariosRow[]>;
export declare function countReglas(): Promise<number>;
export declare function upsertRegla(profesional_nombre: string, categoria: string, tipo: 'fijo' | 'pct', valor_entidad: number, valor_particular: number, notas?: string | null): Promise<void>;
export declare function deleteRegla(id: string): Promise<void>;
export declare function findAllReglasEspeciales(): Promise<ReglaEspecialRow[]>;
export declare function countReglasEspeciales(): Promise<number>;
export declare function insertReglaEspecial(tipo_regla: string, profesional_nombre: string, condicion: string | null, valor: number, descripcion: string | null): Promise<void>;
export declare function updateReglaEspecial(id: string, valor: number, descripcion: string | null): Promise<void>;
//# sourceMappingURL=reglas-honorarios.repo.d.ts.map