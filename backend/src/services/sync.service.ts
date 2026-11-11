import type { Sincronizacion } from '@prisma/client';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import { connectorService } from './connector.service.js';
import { getRedisClient, flushReportesCache } from '../config/redis.js';
import { logger } from '../config/logger.js';
import type { DataSet } from '../connectors/base.connector.js';
import { mapRowsToAtenciones } from './sheet-atencion-mapper.js';
import { adquirirCandadoSync } from './sync-lock.service.js';
import { sincronizarCitas } from './citas-sync.service.js';
import {
  decidirModo, ventanaDesde, VENTANA_MESES_POR_DEFECTO,
  type ModoSolicitado, type ModoSync,
} from './sync-incremental.js';

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
  /** `true` si no se ejecutó porque ya había otra sincronización de ese conector en curso. */
  skipped?: boolean;
  /** Qué tipo de sincronización se ejecutó. */
  modo?: ModoSync;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class SyncService {
  private cacheKey(conectorId: string): string {
    return `sync:${conectorId}:data`;
  }

  // ─── runSync ──────────────────────────────────────────────────────────────

  /**
   * Sincroniza un conector, garantizando que no haya DOS a la vez.
   *
   * Cada proceso del servidor programa el mismo cron y lanza un «catch-up» al
   * arrancar, así que sin candado salían varias sincronizaciones simultáneas de
   * la misma fuente: se invalidaban el token entre ellas (HTTP 401) o chocaban
   * al insertar las mismas filas (Duplicate entry). Quien no obtiene el candado
   * no falla: se omite, porque ya hay otra haciendo el trabajo.
   */
  async runSync(conectorId: string, modo: ModoSolicitado = 'auto'): Promise<SyncResult> {
    const candado = await adquirirCandadoSync(conectorId);
    if (!candado) {
      logger.info('Sync omitida: ya hay otra en curso para este conector', { conectorId });
      return {
        conectorId,
        success: false,
        skipped: true,
        rowsRead: 0,
        rowsNew: 0,
        durationMs: 0,
        error: 'Ya hay una sincronización en curso',
      };
    }

    try {
      // Con el candado en la mano, ninguna otra sincronización de este conector
      // está viva: las que sigan «EN_PROCESO» quedaron huérfanas.
      const huerfanas = await conectoresRepo.cerrarSincronizacionesHuerfanas(conectorId);
      if (huerfanas > 0) logger.warn('Sincronizaciones huérfanas cerradas', { conectorId, huerfanas });

      const resultado = await this.ejecutarSync(conectorId, modo);

      // La agenda de citas, DENTRO del mismo candado: usa la misma credencial y el
      // mismo token, y Medifolios invalida el anterior en cada login. Si fallara,
      // no estropea el resultado de los consumos: tiene su propio estado.
      try {
        const citas = await sincronizarCitas(conectorId);
        if (!citas.ok && !citas.omitida) logger.warn('Citas: la sincronización tras los consumos falló', { conectorId, error: citas.error });
      } catch (err) {
        logger.error('Citas: excepción tras la sincronización de consumos', { conectorId, error: err instanceof Error ? err.message : String(err) });
      }
      return resultado;
    } finally {
      await candado.liberar();
    }
  }

  private async ejecutarSync(conectorId: string, pedido: ModoSolicitado): Promise<SyncResult> {
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

      // ¿Completa o incremental? Ver `sync-incremental.ts`.
      const inc = (conector.config as { incremental?: { activo?: boolean; ventanaMeses?: number; desdeParam?: string } }).incremental;
      const incrementalActivo = inc?.activo === true;
      const modo = decidirModo({
        incrementalActivo,
        pedido,
        // Solo se cuenta si hace falta decidir: evita una consulta en cada
        // sincronización de las fuentes que no son incrementales.
        filasExistentes: incrementalActivo ? await conectoresRepo.contarAtenciones(conectorId) : 0,
      });
      const desde = modo === 'incremental'
        ? ventanaDesde(new Date(), inc?.ventanaMeses ?? VENTANA_MESES_POR_DEFECTO)
        : undefined;

      logger.info('Modo de sincronización', { conectorId, modo, desde: desde ?? null, pedido });

      // En una incremental, la fecha de inicio viaja como parámetro de la API
      // (pisa a la que haya fija en `params`). En una completa la consulta va
      // vacía a propósito: cada conector saca de su propia configuración la ruta
      // y los parámetros que necesita.
      const dataset = await instance.fetch(
        desde ? { params: { [inc?.desdeParam ?? 'fechaDesde']: desde } } : {},
      );
      const durationMs = Date.now() - start;

      // Store in Redis cache
      const ttl = FRECUENCIA_TTL[conector.frecuenciaSync] ?? DEFAULT_TTL;
      await this.storeInCache(conectorId, dataset, ttl);

      // Persistir en atenciones.
      //
      // Antes esto estaba condicionado a GOOGLE_SHEETS, así que un conector
      // REST sincronizaba en verde e insertaba cero filas sin avisar de nada.
      // El mapeador es agnóstico del origen: recibe objetos planos, y tanto el
      // conector de Sheets como el REST producen esa misma forma.
      let filasNuevas = 0;
      if (dataset.rows.length > 0) {
        const mapResult = await mapRowsToAtenciones(dataset.rows, conectorId, { desde });
        filasNuevas = mapResult.created;
        logger.info('Rows mapped to atenciones', { tipo: conector.tipo, ...mapResult });
        flushReportesCache();

        // El mapeador se rinde en silencio cuando no reconoce ninguna columna
        // útil: la sincronización quedaría "Completada" con cero filas y sin
        // pista de por qué. Se convierte en un fallo explícito.
        if (mapResult.created === 0) {
          throw new Error(
            `Se leyeron ${dataset.rows.length} registros pero no se pudo mapear ninguno. ` +
            `Columnas recibidas: ${dataset.columns.slice(0, 12).join(', ')}. ` +
            'Revisa la correspondencia de campos del conector.',
          );
        }
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
        rowsNew: filasNuevas,
        durationMs,
        modo,
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
