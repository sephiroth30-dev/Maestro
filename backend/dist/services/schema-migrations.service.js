"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSchemaMigrations = runSchemaMigrations;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("../config/logger.js");
async function runSchemaMigrations() {
    try {
        // Idempotent: adds entidad_nombre_raw to atenciones if not present
        await prisma_js_1.pool.execute(`
      ALTER TABLE atenciones
      ADD COLUMN IF NOT EXISTS entidad_nombre_raw VARCHAR(255) NULL
    `);
        logger_js_1.logger.info('Schema migrations complete');
    }
    catch (err) {
        logger_js_1.logger.warn('Schema migration failed (non-fatal)', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
//# sourceMappingURL=schema-migrations.service.js.map