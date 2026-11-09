import type { Conector, Sincronizacion, EstadoSync, TipoConector } from '@prisma/client';
import { mapConector } from './conectores.map.js';
export { mapConector };
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
    findAll(): Promise<(Conector & {
        lastSyncEstado: string | null;
    })[]>;
    findAllActive(): Promise<Conector[]>;
    findById(id: string): Promise<Conector | null>;
    update(id: string, data: UpdateConectorData): Promise<Conector>;
    softDelete(id: string): Promise<void>;
    createSincronizacion(data: CreateSincronizacionData): Promise<Sincronizacion>;
    /**
     * Cierra como FALLIDA las sincronizaciones de un conector que siguen
     * `EN_PROCESO` sin que nadie las esté ejecutando.
     *
     * Solo se debe llamar teniendo el candado de sincronización de ese conector:
     * si lo tienes, ninguna otra está corriendo, así que cualquier fila
     * `EN_PROCESO` quedó huérfana (el proceso murió por un reinicio o un
     * despliegue a mitad de la descarga). Sin esto se acumulaban para siempre en
     * el historial y la tarjeta parecía estar sincronizando.
     */
    cerrarSincronizacionesHuerfanas(conectorId: string): Promise<number>;
    updateSincronizacion(id: string, data: Partial<{
        estado: EstadoSync;
        filasLeidas: number;
        filasNuevas: number;
        errores: Record<string, unknown>;
        finalizadaAt: Date;
    }>): Promise<Sincronizacion>;
    findSincronizacionesByConector(conectorId: string, limit?: number): Promise<Sincronizacion[]>;
    /**
     * Marca un conector como la fuente que ve el dashboard, y desmarca el resto.
     *
     * Las dos sentencias van en una transacción: si la segunda fallara quedarían
     * cero fuentes activas (o dos), y el dashboard pasaría a sumar las dos sin
     * que nadie lo pidiera.
     */
    setFuenteActiva(id: string): Promise<void>;
}
export declare const conectoresRepo: ConectoresRepository;
//# sourceMappingURL=conectores.repo.d.ts.map