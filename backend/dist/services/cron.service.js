"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CRON_AGENDA = exports.CRON_COMPLETA = exports.CRON_SCHEDULES = void 0;
exports.scheduleConnector = scheduleConnector;
exports.scheduleAgenda = scheduleAgenda;
exports.unscheduleConnector = unscheduleConnector;
exports.esIncremental = esIncremental;
exports.initCron = initCron;
exports.stopCron = stopCron;
const node_cron_1 = __importDefault(require("node-cron"));
const conectores_repo_js_1 = require("../repositories/conectores.repo.js");
const sync_service_js_1 = require("./sync.service.js");
const logger_js_1 = require("../config/logger.js");
const citas_sync_service_js_1 = require("./citas-sync.service.js");
const agenda_ventana_js_1 = require("./agenda-ventana.js");
const agenda_repo_js_1 = require("../repositories/agenda.repo.js");
const tv_repo_js_1 = require("../repositories/tv.repo.js");
const agenda_ventana_js_2 = require("./agenda-ventana.js");
// ─── Schedule map ─────────────────────────────────────────────────────────────
exports.CRON_SCHEDULES = {
    '30min': '*/30 * * * *',
    '1h': '0 * * * *',
    '4h': '0 */4 * * *',
    'daily': '0 20 * * *',
};
// ─── CronService ─────────────────────────────────────────────────────────────
const scheduledTasks = new Map();
/**
 * Cuándo corre la sincronización COMPLETA de un conector incremental: a las
 * 3 a. m., hora de Colombia, cuando nadie mira el dashboard.
 *
 * La incremental solo refresca los últimos meses; esta repara lo que cambie
 * fuera de esa ventana (un consumo anulado o corregido tiempo después) y el
 * conjunto vuelve a coincidir con la fuente cada día.
 */
exports.CRON_COMPLETA = '0 3 * * *';
const claveCompleta = (conectorId) => `${conectorId}:completa`;
function scheduleConnector(conectorId, nombre, cronExpression, opciones = {}) {
    // Cancela la tarea anterior de este conector (la normal y la completa nocturna).
    // NO toca la de la agenda: es independiente, y cancelarla aquí la dejaba muerta
    // en cuanto el conector tuviera una frecuencia distinta de «manual».
    detenerTareas([conectorId, claveCompleta(conectorId)]);
    if (!node_cron_1.default.validate(cronExpression)) {
        logger_js_1.logger.warn('Invalid cron expression', { conectorId, cronExpression });
        return;
    }
    const task = node_cron_1.default.schedule(cronExpression, async () => {
        logger_js_1.logger.info('Cron sync triggered', { conectorId, nombre });
        try {
            const result = await sync_service_js_1.syncService.runSync(conectorId);
            if (result.skipped) {
                // Normal: cada proceso del servidor dispara el mismo cron y solo uno
                // obtiene el candado. Los demás no fallan, se apartan.
                logger_js_1.logger.info('Cron sync omitida: ya hay otra en curso', { conectorId });
            }
            else if (result.success) {
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
    }, { timezone: 'America/Bogota' });
    scheduledTasks.set(conectorId, task);
    if (opciones.incremental) {
        const completa = node_cron_1.default.schedule(exports.CRON_COMPLETA, async () => {
            logger_js_1.logger.info('Cron sync COMPLETA nocturna', { conectorId, nombre });
            try {
                const result = await sync_service_js_1.syncService.runSync(conectorId, 'completa');
                if (result.skipped) {
                    logger_js_1.logger.info('Sync completa nocturna omitida: ya hay otra en curso', { conectorId });
                }
                else if (!result.success) {
                    logger_js_1.logger.warn('Sync completa nocturna falló', { conectorId, error: result.error });
                }
            }
            catch (err) {
                logger_js_1.logger.error('Sync completa nocturna lanzó una excepción', {
                    conectorId,
                    error: err instanceof Error ? err.message : 'unknown',
                });
            }
        }, { timezone: 'America/Bogota' });
        scheduledTasks.set(claveCompleta(conectorId), completa);
    }
    logger_js_1.logger.info('Connector scheduled', {
        conectorId,
        nombre,
        cronExpression,
        incremental: opciones.incremental === true,
    });
}
const claveAgenda = (conectorId) => `${conectorId}:agenda`;
/** Cada cuánto se sincronizan las citas (L–S, de 6:00 a 19:59, hora de Colombia). */
// Minutos 7, 22, 37 y 52, y NO «*/15»: los consumos se programan en el minuto 0 y 30
// (cada 30 min, hora, 4 h, día). Si coincidieran en el mismo segundo, el primero en
// registrarse ganaría SIEMPRE el candado y los consumos no se sincronizarían en todo
// el horario de trabajo.
exports.CRON_AGENDA = '7,22,37,52 * * * *';
/**
 * Programa la sincronización de las citas pendientes. Es INDEPENDIENTE de la
 * frecuencia del conector (un conector «manual» también puede tener agenda): lo
 * que se agenda cambia durante el día aunque los consumos se carguen una vez.
 *
 * Todos los procesos del servidor programan el mismo cron; el candado del
 * conector hace que solo uno trabaje y los demás se aparten sin fallar.
 */
function scheduleAgenda(conectorId, nombre) {
    const previa = scheduledTasks.get(claveAgenda(conectorId));
    if (previa) {
        previa.stop();
        scheduledTasks.delete(claveAgenda(conectorId));
    }
    const task = node_cron_1.default.schedule(exports.CRON_AGENDA, async () => {
        // Fuera de horario la agenda no cambia de forma que importe; sincronizar toda
        // la noche solo cargaría a Medifolios.
        if (!(0, agenda_ventana_js_1.enHorarioLaboral)(new Date()))
            return;
        try {
            const r = await (0, citas_sync_service_js_1.sincronizarCitasConCandado)(conectorId);
            if (r.omitida)
                logger_js_1.logger.info('Cron de citas omitido', { conectorId, motivo: r.motivo });
            else if (!r.ok)
                logger_js_1.logger.warn('Cron de citas falló', { conectorId, error: r.error });
        }
        catch (err) {
            logger_js_1.logger.error('Cron de citas lanzó una excepción', { conectorId, error: err instanceof Error ? err.message : 'unknown' });
        }
    }, { timezone: 'America/Bogota' });
    scheduledTasks.set(claveAgenda(conectorId), task);
    logger_js_1.logger.info('Agenda de citas programada', { conectorId, nombre, cronExpression: exports.CRON_AGENDA });
}
function detenerTareas(claves) {
    for (const clave of claves) {
        const task = scheduledTasks.get(clave);
        if (task) {
            task.stop();
            scheduledTasks.delete(clave);
        }
    }
}
/** Detiene TODO lo programado de un conector: consumos, completa nocturna y agenda. */
function unscheduleConnector(conectorId) {
    detenerTareas([conectorId, claveCompleta(conectorId), claveAgenda(conectorId)]);
}
const CATCH_UP_INTERVAL_MS = {
    '30min': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    'daily': 24 * 60 * 60 * 1000,
};
/** ¿Tiene el conector activada la sincronización incremental? */
function esIncremental(conector) {
    const inc = conector.config?.incremental;
    return inc?.activo === true;
}
async function catchUpSyncs(activos) {
    const now = Date.now();
    for (const conector of activos) {
        if (conector.frecuenciaSync === 'manual')
            continue;
        const intervalMs = CATCH_UP_INTERVAL_MS[conector.frecuenciaSync];
        if (!intervalMs)
            continue;
        const ultimaSync = conector.ultimaSync;
        if (!ultimaSync) {
            logger_js_1.logger.info('Catch-up: connector never synced, triggering now', { id: conector.id, nombre: conector.nombre });
            void sync_service_js_1.syncService.runSync(conector.id);
            continue;
        }
        const elapsedMs = now - new Date(ultimaSync).getTime();
        if (elapsedMs > intervalMs) {
            logger_js_1.logger.info('Catch-up: sync overdue, triggering now', {
                id: conector.id,
                nombre: conector.nombre,
                elapsedMin: Math.round(elapsedMs / 60_000),
                intervalMin: intervalMs / 60_000,
            });
            void sync_service_js_1.syncService.runSync(conector.id);
        }
    }
}
/**
 * Al arrancar: si la agenda lleva más de 30 minutos sin sincronizarse (o nunca),
 * se sincroniza ya. Sin esto, tras un despliegue la agenda quedaría vieja hasta el
 * siguiente cuarto de hora, o hasta la mañana siguiente si se despliega de noche.
 */
async function catchUpAgenda(activos) {
    if (!(0, agenda_ventana_js_1.enHorarioLaboral)(new Date()))
        return;
    for (const conector of activos) {
        if (!(0, citas_sync_service_js_1.agendaActiva)(conector))
            continue;
        try {
            const estado = await (0, agenda_repo_js_1.leerEstadoSync)(conector.id);
            const ok = estado?.ultimaOk ? Date.parse(`${estado.ultimaOk.replace(' ', 'T')}Z`) : null;
            // Tras un despliegue las citas de HOY (pantalla de TV) aún no están leídas aunque la agenda esté al
            // día: sin esto la pantalla diría «aún no hay citas» hasta el siguiente ciclo (hasta 15 min).
            const hoyLeido = await (0, tv_repo_js_1.leerCitasDia)(conector.id).then((c) => c !== null && c.fechaDia === (0, agenda_ventana_js_2.hoyEnBogota)(new Date())).catch(() => false);
            if (ok === null || Date.now() - ok > 30 * 60_000 || !hoyLeido) {
                logger_js_1.logger.info('Catch-up: agenda de citas desactualizada o citas de hoy sin leer, sincronizando', { id: conector.id, hoyLeido });
                void (0, citas_sync_service_js_1.sincronizarCitasConCandado)(conector.id).catch((e) => logger_js_1.logger.warn('Catch-up de la agenda: la sincronización lanzó una excepción', { id: conector.id, error: e instanceof Error ? e.message : String(e) }));
            }
        }
        catch (err) {
            logger_js_1.logger.warn('Catch-up de la agenda falló', { id: conector.id, error: err instanceof Error ? err.message : 'unknown' });
        }
    }
}
async function initCron() {
    logger_js_1.logger.info('Initializing cron service');
    try {
        const activos = await conectores_repo_js_1.conectoresRepo.findAllActive();
        for (const conector of activos) {
            if ((0, citas_sync_service_js_1.agendaActiva)(conector))
                scheduleAgenda(conector.id, conector.nombre);
            if (conector.frecuenciaSync === 'manual')
                continue;
            const cronExpr = exports.CRON_SCHEDULES[conector.frecuenciaSync];
            if (!cronExpr) {
                logger_js_1.logger.warn('Unknown frecuenciaSync, skipping cron', { id: conector.id, frecuenciaSync: conector.frecuenciaSync });
                continue;
            }
            scheduleConnector(conector.id, conector.nombre, cronExpr, { incremental: esIncremental(conector) });
        }
        logger_js_1.logger.info('Cron jobs scheduled', { count: scheduledTasks.size });
        await catchUpSyncs(activos);
        await catchUpAgenda(activos);
    }
    catch (err) {
        logger_js_1.logger.error('Failed to initialize cron jobs', { error: err instanceof Error ? err.message : 'unknown' });
    }
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