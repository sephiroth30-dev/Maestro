import cron, { type ScheduledTask } from 'node-cron';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import { syncService } from './sync.service.js';
import { logger } from '../config/logger.js';
import type { Conector } from '@prisma/client';
import { sincronizarCitasConCandado, agendaActiva } from './citas-sync.service.js';
import { enHorarioLaboral } from './agenda-ventana.js';
import { leerEstadoSync } from '../repositories/agenda.repo.js';

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

/**
 * Cuándo corre la sincronización COMPLETA de un conector incremental: a las
 * 3 a. m., hora de Colombia, cuando nadie mira el dashboard.
 *
 * La incremental solo refresca los últimos meses; esta repara lo que cambie
 * fuera de esa ventana (un consumo anulado o corregido tiempo después) y el
 * conjunto vuelve a coincidir con la fuente cada día.
 */
export const CRON_COMPLETA = '0 3 * * *';

const claveCompleta = (conectorId: string): string => `${conectorId}:completa`;

export function scheduleConnector(
  conectorId: string,
  nombre: string,
  cronExpression: string,
  opciones: { incremental?: boolean } = {},
): void {
  // Cancela la tarea anterior de este conector (la normal y la completa nocturna).
  // NO toca la de la agenda: es independiente, y cancelarla aquí la dejaba muerta
  // en cuanto el conector tuviera una frecuencia distinta de «manual».
  detenerTareas([conectorId, claveCompleta(conectorId)]);

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
        if (result.skipped) {
          // Normal: cada proceso del servidor dispara el mismo cron y solo uno
          // obtiene el candado. Los demás no fallan, se apartan.
          logger.info('Cron sync omitida: ya hay otra en curso', { conectorId });
        } else if (result.success) {
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

  if (opciones.incremental) {
    const completa = cron.schedule(
      CRON_COMPLETA,
      async () => {
        logger.info('Cron sync COMPLETA nocturna', { conectorId, nombre });
        try {
          const result = await syncService.runSync(conectorId, 'completa');
          if (result.skipped) {
            logger.info('Sync completa nocturna omitida: ya hay otra en curso', { conectorId });
          } else if (!result.success) {
            logger.warn('Sync completa nocturna falló', { conectorId, error: result.error });
          }
        } catch (err) {
          logger.error('Sync completa nocturna lanzó una excepción', {
            conectorId,
            error: err instanceof Error ? err.message : 'unknown',
          });
        }
      },
      { timezone: 'America/Bogota' },
    );
    scheduledTasks.set(claveCompleta(conectorId), completa);
  }

  logger.info('Connector scheduled', {
    conectorId,
    nombre,
    cronExpression,
    incremental: opciones.incremental === true,
  });
}

const claveAgenda = (conectorId: string): string => `${conectorId}:agenda`;

/** Cada cuánto se sincronizan las citas (L–S, de 6:00 a 19:59, hora de Colombia). */
// Minutos 7, 22, 37 y 52, y NO «*/15»: los consumos se programan en el minuto 0 y 30
// (cada 30 min, hora, 4 h, día). Si coincidieran en el mismo segundo, el primero en
// registrarse ganaría SIEMPRE el candado y los consumos no se sincronizarían en todo
// el horario de trabajo.
export const CRON_AGENDA = '7,22,37,52 * * * *';

/**
 * Programa la sincronización de las citas pendientes. Es INDEPENDIENTE de la
 * frecuencia del conector (un conector «manual» también puede tener agenda): lo
 * que se agenda cambia durante el día aunque los consumos se carguen una vez.
 *
 * Todos los procesos del servidor programan el mismo cron; el candado del
 * conector hace que solo uno trabaje y los demás se aparten sin fallar.
 */
export function scheduleAgenda(conectorId: string, nombre: string): void {
  const previa = scheduledTasks.get(claveAgenda(conectorId));
  if (previa) { previa.stop(); scheduledTasks.delete(claveAgenda(conectorId)); }

  const task = cron.schedule(
    CRON_AGENDA,
    async () => {
      // Fuera de horario la agenda no cambia de forma que importe; sincronizar toda
      // la noche solo cargaría a Medifolios.
      if (!enHorarioLaboral(new Date())) return;
      try {
        const r = await sincronizarCitasConCandado(conectorId);
        if (r.omitida) logger.info('Cron de citas omitido', { conectorId, motivo: r.motivo });
        else if (!r.ok) logger.warn('Cron de citas falló', { conectorId, error: r.error });
      } catch (err) {
        logger.error('Cron de citas lanzó una excepción', { conectorId, error: err instanceof Error ? err.message : 'unknown' });
      }
    },
    { timezone: 'America/Bogota' },
  );
  scheduledTasks.set(claveAgenda(conectorId), task);
  logger.info('Agenda de citas programada', { conectorId, nombre, cronExpression: CRON_AGENDA });
}

function detenerTareas(claves: string[]): void {
  for (const clave of claves) {
    const task = scheduledTasks.get(clave);
    if (task) {
      task.stop();
      scheduledTasks.delete(clave);
    }
  }
}

/** Detiene TODO lo programado de un conector: consumos, completa nocturna y agenda. */
export function unscheduleConnector(conectorId: string): void {
  detenerTareas([conectorId, claveCompleta(conectorId), claveAgenda(conectorId)]);
}

const CATCH_UP_INTERVAL_MS: Partial<Record<string, number>> = {
  '30min': 30 * 60 * 1000,
  '1h':    60 * 60 * 1000,
  '4h':    4 * 60 * 60 * 1000,
  'daily': 24 * 60 * 60 * 1000,
};

/** ¿Tiene el conector activada la sincronización incremental? */
export function esIncremental(conector: { config: unknown }): boolean {
  const inc = (conector.config as { incremental?: { activo?: boolean } } | null)?.incremental;
  return inc?.activo === true;
}

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

/**
 * Al arrancar: si la agenda lleva más de 30 minutos sin sincronizarse (o nunca),
 * se sincroniza ya. Sin esto, tras un despliegue la agenda quedaría vieja hasta el
 * siguiente cuarto de hora, o hasta la mañana siguiente si se despliega de noche.
 */
async function catchUpAgenda(activos: Conector[]): Promise<void> {
  if (!enHorarioLaboral(new Date())) return;
  for (const conector of activos) {
    if (!agendaActiva(conector)) continue;
    try {
      const estado = await leerEstadoSync(conector.id);
      const ok = estado?.ultimaOk ? Date.parse(`${estado.ultimaOk.replace(' ', 'T')}Z`) : null;
      if (ok === null || Date.now() - ok > 30 * 60_000) {
        logger.info('Catch-up: agenda de citas desactualizada, sincronizando', { id: conector.id });
        void sincronizarCitasConCandado(conector.id).catch((e: unknown) =>
          logger.warn('Catch-up de la agenda: la sincronización lanzó una excepción', { id: conector.id, error: e instanceof Error ? e.message : String(e) }));
      }
    } catch (err) {
      logger.warn('Catch-up de la agenda falló', { id: conector.id, error: err instanceof Error ? err.message : 'unknown' });
    }
  }
}

export async function initCron(): Promise<void> {
  logger.info('Initializing cron service');
  try {
    const activos = await conectoresRepo.findAllActive();
    for (const conector of activos) {
      if (agendaActiva(conector)) scheduleAgenda(conector.id, conector.nombre);
      if (conector.frecuenciaSync === 'manual') continue;
      const cronExpr = CRON_SCHEDULES[conector.frecuenciaSync as FrecuenciaSync];
      if (!cronExpr) {
        logger.warn('Unknown frecuenciaSync, skipping cron', { id: conector.id, frecuenciaSync: conector.frecuenciaSync });
        continue;
      }
      scheduleConnector(conector.id, conector.nombre, cronExpr, { incremental: esIncremental(conector) });
    }
    logger.info('Cron jobs scheduled', { count: scheduledTasks.size });
    await catchUpSyncs(activos);
    await catchUpAgenda(activos);
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
