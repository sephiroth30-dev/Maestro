import type { Conector, Sincronizacion, EstadoSync, TipoConector } from '@prisma/client';
export interface CreateConectorData {
    nombre: string;
    tipo: TipoConector;
    config: Record<string, unknown>;
    frecuenciaSync?: string;
}
export interface UpdateConectorData {
    nombre?: string;
    config?: Record<string, unknown>;
    activo?: boolean;
    frecuenciaSync?: string;
    ultimaSync?: Date;
}
export interface CreateSincronizacionData {
    conectorId: string;
    estado: EstadoSync;
    filasLeidas?: number;
    filasNuevas?: number;
    errores?: Record<string, unknown>;
    finalizadaAt?: Date;
}
export declare class ConectoresRepository {
    create(data: CreateConectorData): Promise<Conector>;
    findAll(): Promise<Conector[]>;
    findAllActive(): Promise<Conector[]>;
    findById(id: string): Promise<Conector | null>;
    update(id: string, data: UpdateConectorData): Promise<Conector>;
    softDelete(id: string): Promise<void>;
    createSincronizacion(data: CreateSincronizacionData): Promise<Sincronizacion>;
    updateSincronizacion(id: string, data: Partial<{
        estado: EstadoSync;
        filasLeidas: number;
        filasNuevas: number;
        errores: Record<string, unknown>;
        finalizadaAt: Date;
    }>): Promise<Sincronizacion>;
    findSincronizacionesByConector(conectorId: string, limit?: number): Promise<Sincronizacion[]>;
}
export declare const conectoresRepo: ConectoresRepository;
//# sourceMappingURL=conectores.repo.d.ts.map