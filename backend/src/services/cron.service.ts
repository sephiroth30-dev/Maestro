import cron, { type ScheduledTask } from 'node-cron';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import { syncService } from './sync.service.js';
import { logger } from '../config/logger.js';

// ─── Schedule map ─────────────────────────────────────────────────────────────

export const CRON_SCHEDULES = {
  '30min': '*/30 * * * *',
  '1h':    '0 * * * *',
  '4h':    '0 */4 * * *',
  'daily': '0 20 * * *',
} as const;

type FrecuenciaSync = keyof typeof CRON_SCHEDULES;

// ─── CronService ─────────────────────────────────────────────────────────────

const scheduledTasks = new Map<string, ScheduledTask>();

// Schedule all active connectors with their configured intervals
async function scheduleActiveConnectors(): Promise<void> {
  try {
    const activos = await conectoresRepo.findAllActive();

    for (const conector of activos) {
      if (conector.frecuenciaSync === 'manual') continue;

      const cronExpr = CRON_SCHEDULES[conector.frecuenciaSync as FrecuenciaSync];
      if (!cronExpr) {
        logger.warn('Unknown frecuenciaSync, skipping cron', {
          id: conector.id,
          frecuenciaSync: conector.frecuenciaSync,
        });
        continue;
      }

      scheduleConnector(conector.id, conector.nombre, cronExpr);
    }

    logger.info('Cron jobs scheduled', { count: scheduledTasks.size });
  } catch (err) {
    logger.error('Failed to schedule cron jobs', {
      error: err instanceof Error ? err.message : 'unknown',
    });
  }
}

export function scheduleConnector(
  conectorId: string,
  nombre: string,
  cronExpression: string
): void {
  // Cancel existing task for this connector
  const existing = scheduledTasks.get(conectorId);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(conectorId);
  }

  if (!cron.validate(cronExpression)) {
    logger.warn('Invalid cron expression', { conectorId, cronExpression });
    return;
  }

  const task = cron.schedule(
    cronExpression,
    async () => {
      logger.info('Cron sync triggered', { conectorId, nombre });
      try {
        const result = await syncService.runSync(conectorId);
        if (result.success) {
          logger.info('Cron sync succeeded', {
            conectorId,
            rowsRead: result.rowsRead,
            durationMs: result.durationMs,
          });
        } else {
          logger.warn('Cron sync failed', {
            conectorId,
            error: result.error,
          });
        }
      } catch (err) {
        logger.error('Cron sync threw unexpectedly', {
          conectorId,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    },
    { timezone: 'America/Bogota' }
  );

  scheduledTasks.set(conectorId, task);

  logger.info('Connector scheduled', {
    conectorId,
    nombre,
    cronExpression,
  });
}

export function unscheduleConnector(conectorId: string): void {
  const task = scheduledTasks.get(conectorId);
  if (task) {
    task.stop();
    scheduledTasks.delete(conectorId);
    logger.info('Connector unscheduled', { conectorId });
  }
}

export async function initCron(): Promise<void> {
  logger.info('Initializing cron service');
  await scheduleActiveConnectors();
}

export function stopCron(): void {
  for (const [conectorId, task] of scheduledTasks) {
    task.stop();
    logger.info('Cron task stopped', { conectorId });
  }
  scheduledTasks.clear();
  logger.info('All cron jobs stopped');
}
