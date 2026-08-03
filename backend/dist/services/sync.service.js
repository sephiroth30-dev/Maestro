"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = exports.SyncService = void 0;
const conectores_repo_js_1 = require("../repositories/conectores.repo.js");
const connector_service_js_1 = require("./connector.service.js");
const redis_js_1 = require("../config/redis.js");
const logger_js_1 = require("../config/logger.js");
const sheet_atencion_mapper_js_1 = require("./sheet-atencion-mapper.js");
// ─── TTL map (seconds) ────────────────────────────────────────────────────────
const FRECUENCIA_TTL = {
    '30min': 30 * 60,
    '1h': 60 * 60,
    '4h': 4 * 60 * 60,
    'daily': 24 * 60 * 60,
    'manual': 24 * 60 * 60, // 24h default for manual
};
const DEFAULT_TTL = 60 * 60; // 1 hour
// ─── Service ──────────────────────────────────────────────────────────────────
class SyncService {
    cacheKey(conectorId) {
        return `sync:${conectorId}:data`;
    }
    // ─── runSync ──────────────────────────────────────────────────────────────
    async runSync(conectorId) {
        const start = Date.now();
        logger_js_1.logger.info('Starting sync', { conectorId });
        // Create a "in progress" record
        const syncRecord = await conectores_repo_js_1.conectoresRepo.createSincronizacion({
            conectorId,
            estado: 'EN_PROCESO',
        });
        try {
            const conector = await connector_service_js_1.connectorService.getById(conectorId);
            const instance = connector_service_js_1.connectorService.instantiate(conector);
            // La consulta va vacía a propósito: cada conector saca de su propia
            // configuración la ruta y los parámetros que necesita.
            const dataset = await instance.fetch({});
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
                const mapResult = await (0, sheet_atencion_mapper_js_1.mapRowsToAtenciones)(dataset.rows, conectorId);
                filasNuevas = mapResult.created;
                logger_js_1.logger.info('Rows mapped to atenciones', { tipo: conector.tipo, ...mapResult });
                (0, redis_js_1.flushReportesCache)();
                // El mapeador se rinde en silencio cuando no reconoce ninguna columna
                // útil: la sincronización quedaría "Completada" con cero filas y sin
                // pista de por qué. Se convierte en un fallo explícito.
                if (mapResult.created === 0) {
                    throw new Error(`Se leyeron ${dataset.rows.length} registros pero no se pudo mapear ninguno. ` +
                        `Columnas recibidas: ${dataset.columns.slice(0, 12).join(', ')}. ` +
                        'Revisa la correspondencia de campos del conector.');
                }
            }
            // Update sync record
            await conectores_repo_js_1.conectoresRepo.updateSincronizacion(syncRecord.id, {
                estado: 'COMPLETADA',
                filasLeidas: dataset.totalRows,
                filasNuevas,
                finalizadaAt: new Date(),
            });
            // Update last sync time on connector
            await conectores_repo_js_1.conectoresRepo.update(conectorId, { ultimaSync: new Date() });
            const result = {
                conectorId,
                success: true,
                rowsRead: dataset.totalRows,
                rowsNew: filasNuevas,
                durationMs,
            };
            logger_js_1.logger.info('Sync completed', result);
            return result;
        }
        catch (err) {
            const durationMs = Date.now() - start;
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            logger_js_1.logger.error('Sync failed', { conectorId, error: errorMessage });
            await conectores_repo_js_1.conectoresRepo.updateSincronizacion(syncRecord.id, {
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
    async runAllSyncs() {
        const activos = await conectores_repo_js_1.conectoresRepo.findAllActive();
        logger_js_1.logger.info('Running all syncs', { count: activos.length });
        const results = [];
        for (const conector of activos) {
            const result = await this.runSync(conector.id);
            results.push(result);
        }
        return results;
    }
    // ─── getHistory ───────────────────────────────────────────────────────────
    async getHistory(conectorId, limit = 20) {
        return conectores_repo_js_1.conectoresRepo.findSincronizacionesByConector(conectorId, limit);
    }
    // ─── Cache helpers ────────────────────────────────────────────────────────
    async storeInCache(conectorId, dataset, ttl) {
        try {
            const redis = (0, redis_js_1.getRedisClient)();
            const key = this.cacheKey(conectorId);
            const serialized = JSON.stringify({
                ...dataset,
                fetchedAt: dataset.fetchedAt.toISOString(),
            });
            await redis.setex(key, ttl, serialized);
        }
        catch (err) {
            // Cache failure is non-fatal
            logger_js_1.logger.warn('Failed to cache sync data', {
                conectorId,
                error: err instanceof Error ? err.message : 'unknown',
            });
        }
    }
    async getCachedData(conectorId) {
        try {
            const redis = (0, redis_js_1.getRedisClient)();
            const key = this.cacheKey(conectorId);
            const raw = await redis.get(key);
            if (!raw)
                return null;
            const parsed = JSON.parse(raw);
            return {
                ...parsed,
                fetchedAt: new Date(parsed.fetchedAt),
            };
        }
        catch {
            return null;
        }
    }
}
exports.SyncService = SyncService;
exports.syncService = new SyncService();
//# sourceMappingURL=sync.service.js.map