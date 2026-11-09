"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adquirirCandadoSync = void 0;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("../config/logger.js");
const sync_lock_core_js_1 = require("./sync-lock.core.js");
/**
 * Adquiere el candado de sincronización de un conector, o devuelve `null` si otra
 * sincronización de ese mismo conector ya está corriendo en cualquier proceso.
 *
 * Ver `sync-lock.core.ts` para el porqué.
 */
exports.adquirirCandadoSync = (0, sync_lock_core_js_1.crearAdquisidor)(async () => (await prisma_js_1.pool.getConnection()), {
    alPerder: (err) => logger_js_1.logger.warn('Se perdió la conexión que sostenía el candado de sincronización', {
        error: err instanceof Error ? err.message : String(err),
    }),
});
//# sourceMappingURL=sync-lock.service.js.map