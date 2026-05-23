import type { Sincronizacion } from '@prisma/client';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import { connectorService } from './connector.service.js';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../config/logger.js';
import type { DataSet } from '../connectors/base.connector.js';
import { mapRowsToAtenciones } from './sheet-atencion-mapper.js';

// ─── TTL map (seconds) ────────────────────────────────────────────────────────

const FRECUENCIA_TTL: Record<string, number> = {
  '30min': 30 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
  'daily': 24 * 60 * 60,
  'manual': 24 * 60 * 60, // 24h default for manual
};

const DEFAULT_TTL = 60 * 60; // 1 hour

// ─── SyncResult ───────────────────────────────────────────────────────────────

export interface SyncResult {
  conectorId: string;
  success: boolean;
  rowsRead: number;
  rowsNew: number;
  durationMs: number;
  error?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SyncService {
  private cacheKey(conectorId: string): string {
    return `sync:${conectorId}:data`;
  }

  // ─── runSync ──────────────────────────────────────────────────────────────

  async runSync(conectorId: string): Promise<SyncResult> {
    const start = Date.now();

    logger.info('Starting sync', { conectorId });

    // Create a "in progress" record
    const syncRecord = await conectoresRepo.createSincronizacion({
      conectorId,
      estado: 'EN_PROCESO',
    });

    try {
      const conector = await connectorService.getById(conectorId);
      const instance = connectorService.instantiate(conector);

      // Fetch data
      const dataset = await instance.fetch({});
      const durationMs = Date.now() - start;

      // Store in Redis cache
      const ttl = FRECUENCIA_TTL[conector.frecuenciaSync] ?? DEFAULT_TTL;
      await this.storeInCache(conectorId, dataset, ttl);

      // Persist rows to atenciones table (Google Sheets only)
      let filasNuevas = 0;
      if (conector.tipo === 'GOOGLE_SHEETS' && dataset.rows.length > 0) {
        const mapResult = await mapRowsToAtenciones(dataset.rows, conectorId);
        filasNuevas = mapResult.created;
        logger.info('Sheet rows mapped to atenciones', mapResult);
      }

      // Update sync record
      await conectoresRepo.updateSincronizacion(syncRecord.id, {
        estado: 'COMPLETADA',
        filasLeidas: dataset.totalRows,
        filasNuevas,
        finalizadaAt: new Date(),
      });

      // Update last sync time on connector
      await conectoresRepo.update(conectorId, { ultimaSync: new Date() });

      const result: SyncResult = {
        conectorId,
        success: true,
        rowsRead: dataset.totalRows,
        rowsNew: dataset.rows.length,
        durationMs,
      };

      logger.info('Sync completed', result);
      return result;
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';

      logger.error('Sync failed', { conectorId, error: errorMessage });

      await conectoresRepo.updateSincronizacion(syncRecord.id, {
        estado: 'FALLIDA',
        finalizadaAt: new Date(),
        errores: { message: errorMessage },
      });

      return {
        conectorId,
        success: false,
        rowsRead: 0,
        rowsNew: 0,
        durationMs,
        error: errorMessage,
      };
    }
  }

  // ─── runAllSyncs ──────────────────────────────────────────────────────────

  async runAllSyncs(): Promise<SyncResult[]> {
    const activos = await conectoresRepo.findAllActive();
    logger.info('Running all syncs', { count: activos.length });

    const results: SyncResult[] = [];
    for (const conector of activos) {
      const result = await this.runSync(conector.id);
      results.push(result);
    }

    return results;
  }

  // ─── getHistory ───────────────────────────────────────────────────────────

  async getHistory(
    conectorId: string,
    limit = 20
  ): Promise<Sincronizacion[]> {
    return conectoresRepo.findSincronizacionesByConector(conectorId, limit);
  }

  // ─── Cache helpers ────────────────────────────────────────────────────────

  private async storeInCache(
    conectorId: string,
    dataset: DataSet,
    ttl: number
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = this.cacheKey(conectorId);
      const serialized = JSON.stringify({
        ...dataset,
        fetchedAt: dataset.fetchedAt.toISOString(),
      });
      await redis.setex(key, ttl, serialized);
    } catch (err) {
      // Cache failure is non-fatal
      logger.warn('Failed to cache sync data', {
        conectorId,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  async getCachedData(conectorId: string): Promise<DataSet | null> {
    try {
      const redis = getRedisClient();
      const key = this.cacheKey(conectorId);
      const raw = await redis.get(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as DataSet & { fetchedAt: string };
      return {
        ...parsed,
        fetchedAt: new Date(parsed.fetchedAt),
      };
    } catch {
      return null;
    }
  }
}

export const syncService = new SyncService();
