import type { Sincronizacion } from '@prisma/client';
import type { DataSet } from '../connectors/base.connector.js';
import { type ModoSolicitado, type ModoSync } from './sync-incremental.js';
export interface SyncResult {
    conectorId: string;
    success: boolean;
    rowsRead: number;
    rowsNew: number;
    durationMs: number;
    error?: string;
    /** `true` si no se ejecutó porque ya había otra sincronización de ese conector en curso. */
    skipped?: boolean;
    /** Qué tipo de sincronización se ejecutó. */
    modo?: ModoSync;
}
export declare class SyncService {
    private cacheKey;
    /**
     * Sincroniza un conector, garantizando que no haya DOS a la vez.
     *
     * Cada proceso del servidor programa el mismo cron y lanza un «catch-up» al
     * arrancar, así que sin candado salían varias sincronizaciones simultáneas de
     * la misma fuente: se invalidaban el token entre ellas (HTTP 401) o chocaban
     * al insertar las mismas filas (Duplicate entry). Quien no obtiene el candado
     * no falla: se omite, porque ya hay otra haciendo el trabajo.
     */
    runSync(conectorId: string, modo?: ModoSolicitado): Promise<SyncResult>;
    private ejecutarSync;
    runAllSyncs(): Promise<SyncResult[]>;
    getHistory(conectorId: string, limit?: number): Promise<Sincronizacion[]>;
    private storeInCache;
    getCachedData(conectorId: string): Promise<DataSet | null>;
}
export declare const syncService: SyncService;
//# sourceMappingURL=sync.service.d.ts.map