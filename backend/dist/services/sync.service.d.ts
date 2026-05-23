import type { Sincronizacion } from '@prisma/client';
import type { DataSet } from '../connectors/base.connector.js';
export interface SyncResult {
    conectorId: string;
    success: boolean;
    rowsRead: number;
    rowsNew: number;
    durationMs: number;
    error?: string;
}
export declare class SyncService {
    private cacheKey;
    runSync(conectorId: string): Promise<SyncResult>;
    runAllSyncs(): Promise<SyncResult[]>;
    getHistory(conectorId: string, limit?: number): Promise<Sincronizacion[]>;
    private storeInCache;
    getCachedData(conectorId: string): Promise<DataSet | null>;
}
export declare const syncService: SyncService;
//# sourceMappingURL=sync.service.d.ts.map