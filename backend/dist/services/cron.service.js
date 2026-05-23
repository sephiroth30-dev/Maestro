"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRON_SCHEDULES = void 0;
exports.scheduleConnector = scheduleConnector;
exports.unscheduleConnector = unscheduleConnector;
exports.initCron = initCron;
exports.stopCron = stopCron;
const node_cron_1 = __importDefault(require("node-cron"));
const conectores_repo_js_1 = require("../repositories/conectores.repo.js");
const sync_service_js_1 = require("./sync.service.js");
const logger_js_1 = require("../config/logger.js");
// ─── Schedule map ─────────────────────────────────────────────────────────────
exports.CRON_SCHEDULES = {
    '30min': '*/30 * * * *',
    '1h': '0 * * * *',
    '4h': '0 */4 * * *',
    'daily': '0 20 * * *',
};
// ─── CronService ─────────────────────────────────────────────────────────────
const scheduledTasks = new Map();
// Schedule all active connectors with their configured intervals
async function scheduleActiveConnectors() {
    try {
        const activos = await conectores_repo_js_1.conectoresRepo.findAllActive();
        for (const conector of activos) {
            if (conector.frecuenciaSync === 'manual')
                continue;
            const cronExpr = exports.CRON_SCHEDULES[conector.frecuenciaSync];
            if (!cronExpr) {
                logger_js_1.logger.warn('Unknown frecuenciaSync, skipping cron', {
                    id: conector.id,
                    frecuenciaSync: conector.frecuenciaSync,
                });
                continue;
            }
            scheduleConnector(conector.id, conector.nombre, cronExpr);
        }
        logger_js_1.logger.info('Cron jobs scheduled', { count: scheduledTasks.size });
    }
    catch (err) {
        logger_js_1.logger.error('Failed to schedule cron jobs', {
            error: err instanceof Error ? err.message : 'unknown',
        });
    }
}
function scheduleConnector(conectorId, nombre, cronExpression) {
    // Cancel existing task for this connector
    const existing = scheduledTasks.get(conectorId);
    if (existing) {
        existing.stop();
        scheduledTasks.delete(conectorId);
    }
    if (!node_cron_1.default.validate(cronExpression)) {
        logger_js_1.logger.warn('Invalid cron expression', { conectorId, cronExpression });
        return;
    }
    const task = node_cron_1.default.schedule(cronExpression, async () => {
        logger_js_1.logger.info('Cron sync triggered', { conectorId, nombre });
        try {
            const result = await sync_service_js_1.syncService.runSync(conectorId);
            if (result.success) {
                logger_js_1.logger.info('Cron sync succeeded', {
                    conectorId,
                    rowsRead: result.rowsRead,
                    durationMs: result.durationMs,
                });
            }
            else {
                logger_js_1.logger.warn('Cron sync failed', {
                    conectorId,
                    error: result.error,
                });
            }
        }
        catch (err) {
            logger_js_1.logger.error('Cron sync threw unexpectedly', {
                conectorId,
                error: err instanceof Error ? err.message : 'unknown',
            });
        }
    });
    scheduledTasks.set(conectorId, task);
    logger_js_1.logger.info('Connector scheduled', {
        conectorId,
        nombre,
        cronExpression,
    });
}
function unscheduleConnector(conectorId) {
    const task = scheduledTasks.get(conectorId);
    if (task) {
        task.stop();
        scheduledTasks.delete(conectorId);
        logger_js_1.logger.info('Connector unscheduled', { conectorId });
    }
}
async function initCron() {
    logger_js_1.logger.info('Initializing cron service');
    await scheduleActiveConnectors();
}
function stopCron() {
    for (const [conectorId, task] of scheduledTasks) {
        task.stop();
        logger_js_1.logger.info('Cron task stopped', { conectorId });
    }
    scheduledTasks.clear();
    logger_js_1.logger.info('All cron jobs stopped');
}
//# sourceMappingURL=cron.service.js.map