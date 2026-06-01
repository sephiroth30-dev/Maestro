export interface CapacidadMapped {
    id: string;
    grupo: string;
    nombre: string;
    anio: number;
    mesIdx: number;
    capacidad: number;
    recursos: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface UtilizacionMapped {
    grupo: string;
    nombre: string;
    capacidad: number | null;
    sesiones: number;
    pctOcupacion: number | null;
    disponible: number | null;
}
export interface UpsertCapacidadData {
    grupo: string;
    nombre: string;
    anio: number;
    mesIdx: number;
    capacidad: number;
    recursos?: string | null;
}
export declare class CapacidadRepository {
    upsert(data: UpsertCapacidadData): Promise<CapacidadMapped>;
    findByAnio(anio: number): Promise<CapacidadMapped[]>;
    deleteOne(grupo: string, anio: number, mesIdx: number): Promise<void>;
    getUtilizacion(anio: number, mesIdx: number): Promise<UtilizacionMapped[]>;
}
export declare const capacidadRepo: CapacidadRepository;
//# sourceMappingURL=capacidad.repo.d.ts.map