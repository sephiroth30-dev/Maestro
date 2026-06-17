import cron, { type ScheduledTask } from 'node-cron';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import { syncService } from './sync.service.js';
import { logger } from '../config/logger.js';
import type { Conector } from '@prisma/client';

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

const CATCH_UP_INTERVAL_MS: Partial<Record<string, number>> = {
  '30min': 30 * 60 * 1000,
  '1h':    60 * 60 * 1000,
  '4h':    4 * 60 * 60 * 1000,
  'daily': 24 * 60 * 60 * 1000,
};

async function catchUpSyncs(activos: Conector[]): Promise<void> {
  const now = Date.now();
  for (const conector of activos) {
    if (conector.frecuenciaSync === 'manual') continue;
    const intervalMs = CATCH_UP_INTERVAL_MS[conector.frecuenciaSync];
    if (!intervalMs) continue;

    const ultimaSync = conector.ultimaSync;
    if (!ultimaSync) {
      logger.info('Catch-up: connector never synced, triggering now', { id: conector.id, nombre: conector.nombre });
      void syncService.runSync(conector.id);
      continue;
    }

    const elapsedMs = now - new Date(ultimaSync as unknown as string).getTime();
    if (elapsedMs > intervalMs) {
      logger.info('Catch-up: sync overdue, triggering now', {
        id: conector.id,
        nombre: conector.nombre,
        elapsedMin: Math.round(elapsedMs / 60_000),
        intervalMin: intervalMs / 60_000,
      });
      void syncService.runSync(conector.id);
    }
  }
}

export async function initCron(): Promise<void> {
  logger.info('Initializing cron service');
  try {
    const activos = await conectoresRepo.findAllActive();
    for (const conector of activos) {
      if (conector.frecuenciaSync === 'manual') continue;
      const cronExpr = CRON_SCHEDULES[conector.frecuenciaSync as FrecuenciaSync];
      if (!cronExpr) {
        logger.warn('Unknown frecuenciaSync, skipping cron', { id: conector.id, frecuenciaSync: conector.frecuenciaSync });
        continue;
      }
      scheduleConnector(conector.id, conector.nombre, cronExpr);
    }
    logger.info('Cron jobs scheduled', { count: scheduledTasks.size });
    await catchUpSyncs(activos);
  } catch (err) {
    logger.error('Failed to initialize cron jobs', { error: err instanceof Error ? err.message : 'unknown' });
  }
}

export function stopCron(): void {
  for (const [conectorId, task] of scheduledTasks) {
    task.stop();
    logger.info('Cron task stopped', { conectorId });
  }
  scheduledTasks.clear();
  logger.info('All cron jobs stopped');
}
