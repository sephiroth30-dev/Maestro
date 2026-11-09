import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { crearAdquisidor, type ConexionCandado } from './sync-lock.core.js';

/**
 * Adquiere el candado de sincronización de un conector, o devuelve `null` si otra
 * sincronización de ese mismo conector ya está corriendo en cualquier proceso.
 *
 * Ver `sync-lock.core.ts` para el porqué.
 */
export const adquirirCandadoSync = crearAdquisidor(
  async () => (await pool.getConnection()) as unknown as ConexionCandado,
  {
    alPerder: (err) =>
      logger.warn('Se perdió la conexión que sostenía el candado de sincronización', {
        error: err instanceof Error ? err.message : String(err),
      }),
  },
);
