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
  {
    id: 'm08_usuarios_rol_recursos_humanos',
    sql: "ALTER TABLE usuarios MODIFY COLUMN rol ENUM('ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES','RECURSOS_HUMANOS') NOT NULL",
  },
  {
    id: 'm09_reglas_honorarios',
    sql: `CREATE TABLE IF NOT EXISTS reglas_honorarios (
      id VARCHAR(36) NOT NULL,
      profesional_nombre VARCHAR(100) NOT NULL,
      categoria VARCHAR(30) NOT NULL,
      tipo ENUM('fijo','pct') NOT NULL,
      valor_entidad DECIMAL(15,4) NOT NULL,
      valor_particular DECIMAL(15,4) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      notas VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      UNIQUE KEY uk_prof_cat (profesional_nombre, categoria)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    id: 'm10_reglas_especiales_honorarios',
    sql: `CREATE TABLE IF NOT EXISTS reglas_especiales_honorarios (
      id VARCHAR(36) NOT NULL,
      tipo_regla VARCHAR(50) NOT NULL,
      profesional_nombre VARCHAR(100) NOT NULL,
      condicion VARCHAR(200) NULL,
      valor DECIMAL(15,4) NOT NULL,
      descripcion VARCHAR(255) NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    id: 'm11_usuarios_modulos',
    sql: 'ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos TEXT NULL',
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
