import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';

const MIGRATIONS: Array<{ id: string; sql: string }> = [
  {
    id: 'm01_entidad_nombre_raw',
    sql: 'ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS entidad_nombre_raw VARCHAR(255) NULL',
  },
  {
    id: 'm02_servicios_palabras_clave',
    sql: "ALTER TABLE servicios ADD COLUMN IF NOT EXISTS palabras_clave JSON NULL",
  },
  {
    id: 'm03_servicios_tipo_conteo',
    sql: "ALTER TABLE servicios ADD COLUMN IF NOT EXISTS tipo_conteo ENUM('unidad','sesion') NOT NULL DEFAULT 'unidad'",
  },
  {
    id: 'm04_servicios_orden',
    sql: 'ALTER TABLE servicios ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 99',
  },
  {
    id: 'm05_atenciones_paciente_nombre',
    sql: 'ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS paciente_nombre VARCHAR(255) NULL',
  },
  {
    id: 'm06_atenciones_paciente_documento',
    sql: 'ALTER TABLE atenciones ADD COLUMN IF NOT EXISTS paciente_documento VARCHAR(50) NULL',
  },
  {
    id: 'm07_atenciones_servicio_id_idx',
    sql: 'CREATE INDEX IF NOT EXISTS atenciones_servicio_id_idx ON atenciones (servicio_id)',
  },
];

export async function runSchemaMigrations(): Promise<void> {
  for (const m of MIGRATIONS) {
    try {
      await pool.execute(m.sql);
    } catch (err) {
      logger.warn(`Schema migration ${m.id} failed (non-fatal)`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  logger.info('Schema migrations complete');
}
