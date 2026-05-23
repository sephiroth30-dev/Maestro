"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectColumnMapping = detectColumnMapping;
exports.parseSheetDate = parseSheetDate;
exports.parseSheetValue = parseSheetValue;
exports.hashFila = hashFila;
exports.mapRowsToAtenciones = mapRowsToAtenciones;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
const normalizacion_service_js_1 = require("./normalizacion.service.js");
const logger_js_1 = require("../config/logger.js");
// ─── Column auto-detection patterns ──────────────────────────────────────────
const PATTERNS = {
    fecha: /^(fecha|date|dia\b|day\b)/i,
    descripcion: /^(descripcion|descripci[oó]n|servicio|description|detalle|item|concepto|procedimiento)/i,
    autorizacion: /^(autorizacion|autorizaci[oó]n|autori\b|auth\b|nro\.?\s*aut|n[uú]m\.?\s*aut|no\.?\s*aut)/i,
    entidad: /^(entidad|pagador|eps\b|aseguradora|empresa|convenio|paga)/i,
    profesional: /^(profesional|m[eé]dico|doctor|terapeuta|especialista|prestador)/i,
    valor: /^(valor|monto|tarifa|total\b|precio|importe|vr\b|vlr\b)/i,
};
function detectColumnMapping(columns) {
    const result = {};
    for (const field of Object.keys(PATTERNS)) {
        result[field] = columns.find((c) => PATTERNS[field].test(c.trim())) ?? null;
    }
    return result;
}
// ─── Date parsing (handles DD/MM/YYYY, YYYY-MM-DD, Excel serial numbers) ──────
function parseSheetDate(raw) {
    if (raw === null || raw === undefined || raw === '')
        return null;
    // Excel serial number (number of days since 1899-12-30)
    if (typeof raw === 'number' && raw > 1000) {
        const ms = (raw - 25569) * 86400 * 1000; // 25569 = days from 1899-12-30 to 1970-01-01
        const d = new Date(ms);
        if (!isNaN(d.getTime()))
            return d;
    }
    const str = String(raw).trim();
    // DD/MM/YYYY or D/M/YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
        const d = new Date(Date.UTC(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1])));
        if (!isNaN(d.getTime()))
            return d;
    }
    // YYYY-MM-DD
    const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (ymd) {
        const d = new Date(Date.UTC(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3])));
        if (!isNaN(d.getTime()))
            return d;
    }
    return null;
}
// ─── Value parsing ─────────────────────────────────────────────────────────────
function parseSheetValue(raw) {
    if (typeof raw === 'number')
        return raw;
    if (!raw)
        return 0;
    // Remove currency symbols, dots as thousand separators, replace comma decimal
    const cleaned = String(raw).replace(/[$€\s]/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
}
// ─── Hash (same algorithm as seed) ───────────────────────────────────────────
function hashFila(fields) {
    const str = [
        fields.descripcionRaw,
        fields.autorizacion,
        fields.entidad,
        fields.profesional,
        fields.valor,
        fields.fecha,
    ].join('|');
    return (0, node_crypto_1.createHash)('sha256').update(str).digest('hex').slice(0, 64);
}
async function buildCache() {
    const [[entidadRows], [profesionalRows]] = await Promise.all([
        prisma_js_1.pool.query('SELECT id, nombres_raw FROM entidades WHERE activa = 1'),
        prisma_js_1.pool.query('SELECT id, nombres_raw FROM profesionales WHERE activo = 1'),
    ]);
    return {
        entidades: entidadRows.map((row) => ({
            id: row['id'],
            nombres: (typeof row['nombres_raw'] === 'string'
                ? JSON.parse(row['nombres_raw'])
                : row['nombres_raw']).map((n) => n.toUpperCase()),
        })),
        profesionales: profesionalRows.map((row) => ({
            id: row['id'],
            nombres: (typeof row['nombres_raw'] === 'string'
                ? JSON.parse(row['nombres_raw'])
                : row['nombres_raw']).map((n) => n.toUpperCase()),
        })),
    };
}
function resolveId(rawName, catalog) {
    if (!rawName)
        return null;
    const upper = String(rawName).toUpperCase().trim();
    if (!upper)
        return null;
    // 1. Exact match
    for (const entry of catalog) {
        if (entry.nombres.some((n) => n === upper))
            return entry.id;
    }
    // 2. Contains match (sheet value contains known name)
    for (const entry of catalog) {
        if (entry.nombres.some((n) => upper.includes(n)))
            return entry.id;
    }
    // 3. Known name contains sheet value (partial)
    for (const entry of catalog) {
        if (entry.nombres.some((n) => n.includes(upper) && upper.length >= 4))
            return entry.id;
    }
    return null;
}
async function mapRowsToAtenciones(rows, conectorId) {
    if (rows.length === 0)
        return { created: 0, skipped: 0, errors: 0 };
    // Detect columns from first row keys
    const columns = Object.keys(rows[0] ?? {});
    const colMap = detectColumnMapping(columns);
    logger_js_1.logger.info('Sheet column mapping detected', { colMap });
    if (!colMap.descripcion && !colMap.valor) {
        logger_js_1.logger.warn('Cannot map sheet rows: no descripcion or valor column found', { columns });
        return { created: 0, skipped: 0, errors: 0 };
    }
    const cache = await buildCache();
    let created = 0;
    let skipped = 0;
    let errors = 0;
    const toInsert = [];
    for (const row of rows) {
        try {
            const rawDescripcion = colMap.descripcion ? String(row[colMap.descripcion] ?? '') : '';
            const rawValor = colMap.valor ? row[colMap.valor] : null;
            const rawFecha = colMap.fecha ? row[colMap.fecha] : null;
            const rawAutorizacion = colMap.autorizacion ? String(row[colMap.autorizacion] ?? '') : '';
            const rawEntidad = colMap.entidad ? String(row[colMap.entidad] ?? '') : '';
            const rawProfesional = colMap.profesional ? String(row[colMap.profesional] ?? '') : '';
            // Skip rows without meaningful data
            const valor = parseSheetValue(rawValor);
            if (!rawDescripcion.trim() && valor === 0) {
                skipped++;
                continue;
            }
            const fechaDia = parseSheetDate(rawFecha);
            if (!fechaDia) {
                skipped++;
                continue;
            }
            const mesIdx = fechaDia.getUTCMonth() + 1;
            const anio = fechaDia.getUTCFullYear();
            const entidadId = resolveId(rawEntidad, cache.entidades);
            const profesionalId = resolveId(rawProfesional, cache.profesionales);
            const fechaStr = fechaDia.toISOString().slice(0, 10);
            const hash = hashFila({
                descripcionRaw: rawDescripcion,
                autorizacion: rawAutorizacion,
                entidad: rawEntidad,
                profesional: rawProfesional,
                valor: String(valor),
                fecha: fechaStr,
            });
            toInsert.push({
                descripcionRaw: rawDescripcion,
                descripcionNorm: (0, normalizacion_service_js_1.normalizeDescripcion)(rawDescripcion),
                fechaDia,
                mesIdx,
                anio,
                valorBruto: valor,
                numeroAutorizacion: rawAutorizacion || null,
                esTelemetria: rawDescripcion.toUpperCase().includes('TELEMETRIA'),
                hashFila: hash,
                entidadId,
                profesionalId,
                conectorId,
            });
        }
        catch (err) {
            errors++;
            logger_js_1.logger.warn('Failed to map sheet row to atencion', {
                error: err instanceof Error ? err.message : String(err),
                row,
            });
        }
    }
    if (toInsert.length > 0) {
        const values = toInsert.map((item) => [
            (0, node_crypto_1.randomUUID)(),
            item.descripcionRaw,
            item.descripcionNorm,
            item.fechaDia,
            item.mesIdx,
            item.anio,
            item.valorBruto,
            item.numeroAutorizacion,
            item.esTelemetria ? 1 : 0,
            item.hashFila,
            item.entidadId,
            item.profesionalId,
            null, // servicio_id
            item.conectorId,
        ]);
        const [insertResult] = await prisma_js_1.pool.query('INSERT IGNORE INTO atenciones (id, descripcion_raw, descripcion_norm, fecha_dia, mes_idx, anio, valor_bruto, numero_autorizacion, es_telemetria, hash_fila, entidad_id, profesional_id, servicio_id, conector_id) VALUES ?', [values]);
        created = insertResult.affectedRows;
        skipped += toInsert.length - insertResult.affectedRows;
    }
    return { created, skipped, errors };
}
//# sourceMappingURL=sheet-atencion-mapper.js.map