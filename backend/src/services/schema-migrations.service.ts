import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';

export async function runSchemaMigrations(): Promise<void> {
  try {
    // Idempotent: adds entidad_nombre_raw to atenciones if not present
    await pool.execute(`
      ALTER TABLE atenciones
      ADD COLUMN IF NOT EXISTS entidad_nombre_raw VARCHAR(255) NULL
    `);
    logger.info('Schema migrations complete');
  } catch (err) {
    logger.warn('Schema migration failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
