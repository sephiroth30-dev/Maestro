"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSchemaMigrations = runSchemaMigrations;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("../config/logger.js");
const MIGRATIONS = [
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
async function runSchemaMigrations() {
    for (const m of MIGRATIONS) {
        try {
            await prisma_js_1.pool.execute(m.sql);
        }
        catch (err) {
            logger_js_1.logger.warn(`Schema migration ${m.id} failed (non-fatal)`, {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    logger_js_1.logger.info('Schema migrations complete');
}
//# sourceMappingURL=schema-migrations.service.js.map