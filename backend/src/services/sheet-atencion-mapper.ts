import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../config/prisma.js';
import { normalizeDescripcion } from './normalizacion.service.js';
import { logger } from '../config/logger.js';
import type { DataRow } from '../connectors/base.connector.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── Column auto-detection patterns ──────────────────────────────────────────

const PATTERNS = {
  // Exclude "AUTORIZACION" so "FECHA DE ATENCIÓN DEL PACIENTE" is preferred over "FECHA DE AUTORIZACIÓN"
  fecha:        /^fecha(?!.*autori)/i,
  descripcion:  /^(descripcion|descripci[oó]n|servicio|description|detalle|item|concepto|procedimiento)/i,
  autorizacion: /^(autorizacion|autorizaci[oó]n|autori\b|auth\b|nro\.?\s*aut|n[uú]m\.?\s*aut|no\.?\s*aut|numero.*autori)/i,
  entidad:      /^(entidad|pagador|eps\b|aseguradora|empresa|convenio|paga)/i,
  profesional:  /^(profesional|m[eé]dico|doctor|terapeuta|especialista|prestador)/i,
  // Prefer "VALOR BRUTO" over "VALOR BRUTO POR CANTIDAD", "VALOR TOTAL", etc.
  valor:        /^valor\s*bruto\b|^(valor\b|monto|tarifa|precio|importe|vr\b|vlr\b)/i,
};

export function detectColumnMapping(columns: string[]): Record<keyof typeof PATTERNS, string | null> {
  const result = {} as Record<keyof typeof PATTERNS, string | null>;
  for (const field of Object.keys(PATTERNS) as Array<keyof typeof PATTERNS>) {
    result[field] = columns.find((c) => PATTERNS[field].test(c.trim())) ?? null;
  }
  return result;
}

// ─── Date parsing (handles DD/MM/YYYY, YYYY-MM-DD, Excel serial numbers) ──────

export function parseSheetDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === '') return null;

  // Excel serial number (number of days since 1899-12-30)
  if (typeof raw === 'number' && raw > 1000) {
    const ms = (raw - 25569) * 86400 * 1000; // 25569 = days from 1899-12-30 to 1970-01-01
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }

  const str = String(raw).trim();

  // DD/MM/YYYY or D/M/YYYY
  const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) {
    const d = new Date(Date.UTC(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1])));
    if (!isNaN(d.getTime())) return d;
  }

  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Date.UTC(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3])));
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

// ─── Value parsing ─────────────────────────────────────────────────────────────
// Handles Colombian (1.234.567,89), US (1,234,567.89), and mixed formats.
// Key rule: if the last separator group has exactly 3 digits, it's a thousands
// separator; 1-2 digits means it's a decimal separator.

export function parseSheetValue(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (!raw) return 0;

  let str = String(raw).replace(/[$€\s]/g, '').trim();
  if (!str || str === '-') return 0;

  const hasDot = str.includes('.');
  const hasComma = str.includes(',');

  if (hasDot && hasComma) {
    // Both separators present — whichever comes LAST is the decimal separator.
    if (str.lastIndexOf('.') > str.lastIndexOf(',')) {
      // e.g. "1,234.56" → comma=thousands, dot=decimal
      str = str.replace(/,/g, '');
    } else {
      // e.g. "1.234,56" → dot=thousands, comma=decimal (Colombian)
      str = str.replace(/\./g, '').replace(',', '.');
    }
  } else if (hasComma && !hasDot) {
    // Only commas: if the last segment is exactly 3 digits, it's a thousands separator.
    // "31,096" → [31][096] → last part 3 digits → thousands → 31096
    // "31,5"   → [31][5]   → last part 1 digit  → decimal  → 31.5
    const parts = str.split(',');
    const lastPart = parts[parts.length - 1] ?? '';
    if (lastPart.length === 3 && /^\d+$/.test(lastPart) && parts.length > 1) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (hasDot && !hasComma) {
    // Only dots: same rule — last segment 3 digits means thousands separator.
    // "31.096" → thousands → 31096
    // "31.5"   → decimal  → 31.5
    const parts = str.split('.');
    const lastPart = parts[parts.length - 1] ?? '';
    if (lastPart.length === 3 && /^\d+$/.test(lastPart) && parts.length > 1) {
      str = str.replace(/\./g, '');
    }
    // else keep as-is (decimal dot)
  }

  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

// ─── Hash (same algorithm as seed) ───────────────────────────────────────────

export function hashFila(fields: {
  descripcionRaw: string;
  autorizacion: string;
  entidad: string;
  profesional: string;
  valor: string;
  fecha: string;
}): string {
  const str = [
    fields.descripcionRaw,
    fields.autorizacion,
    fields.entidad,
    fields.profesional,
    fields.valor,
    fields.fecha,
  ].join('|');
  return createHash('sha256').update(str).digest('hex').slice(0, 64);
}

// ─── Entity/Professional resolution cache ─────────────────────────────────────

interface ResolverCache {
  entidades: Array<{ id: string; nombres: string[] }>;
  profesionales: Array<{ id: string; nombres: string[] }>;
}

async function buildCache(): Promise<ResolverCache> {
  const [[entidadRows], [profesionalRows]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT id, nombres_raw FROM entidades WHERE activa = 1'),
    pool.query<RowDataPacket[]>('SELECT id, nombres_raw FROM profesionales WHERE activo = 1'),
  ]);

  return {
    entidades: (entidadRows as RowDataPacket[]).map((row) => ({
      id: row['id'] as string,
      nombres: ((typeof row['nombres_raw'] === 'string'
        ? JSON.parse(row['nombres_raw'])
        : row['nombres_raw']) as string[]).map((n) => n.toUpperCase()),
    })),
    profesionales: (profesionalRows as RowDataPacket[]).map((row) => ({
      id: row['id'] as string,
      nombres: ((typeof row['nombres_raw'] === 'string'
        ? JSON.parse(row['nombres_raw'])
        : row['nombres_raw']) as string[]).map((n) => n.toUpperCase()),
    })),
  };
}

function resolveId(
  rawName: string | null | undefined,
  catalog: Array<{ id: string; nombres: string[] }>
): string | null {
  if (!rawName) return null;
  const upper = String(rawName).toUpperCase().trim();
  if (!upper) return null;

  // 1. Exact match
  for (const entry of catalog) {
    if (entry.nombres.some((n) => n === upper)) return entry.id;
  }
  // 2. Contains match (sheet value contains known name)
  for (const entry of catalog) {
    if (entry.nombres.some((n) => upper.includes(n))) return entry.id;
  }
  // 3. Known name contains sheet value (partial)
  for (const entry of catalog) {
    if (entry.nombres.some((n) => n.includes(upper) && upper.length >= 4)) return entry.id;
  }
  return null;
}

// ─── Main mapper ──────────────────────────────────────────────────────────────

export interface MapperResult {
  created: number;
  skipped: number;
  errors: number;
}

export async function mapRowsToAtenciones(
  rows: DataRow[],
  conectorId: string
): Promise<MapperResult> {
  if (rows.length === 0) return { created: 0, skipped: 0, errors: 0 };

  // Detect columns from first row keys
  const columns = Object.keys(rows[0] ?? {});
  const colMap = detectColumnMapping(columns);

  logger.info('Sheet column mapping detected', { colMap });

  if (!colMap.descripcion && !colMap.valor) {
    logger.warn('Cannot map sheet rows: no descripcion or valor column found', { columns });
    return { created: 0, skipped: 0, errors: 0 };
  }

  const cache = await buildCache();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  interface AtencionInsert {
    descripcionRaw: string;
    descripcionNorm: string;
    fechaDia: Date;
    mesIdx: number;
    anio: number;
    valorBruto: number;
    numeroAutorizacion: string | null;
    esTelemetria: boolean;
    hashFila: string;
    entidadId: string | null;
    profesionalId: string | null;
    conectorId: string;
  }
  const toInsert: AtencionInsert[] = [];

  for (const row of rows) {
    try {
      const rawDescripcion = colMap.descripcion ? String(row[colMap.descripcion] ?? '') : '';
      const rawValor       = colMap.valor        ? row[colMap.valor]        : null;
      const rawFecha       = colMap.fecha        ? row[colMap.fecha]        : null;
      const rawAutorizacion = colMap.autorizacion ? String(row[colMap.autorizacion] ?? '') : '';
      const rawEntidad     = colMap.entidad      ? String(row[colMap.entidad] ?? '')      : '';
      const rawProfesional = colMap.profesional  ? String(row[colMap.profesional] ?? '')  : '';

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
      const anio   = fechaDia.getUTCFullYear();

      const entidadId     = resolveId(rawEntidad, cache.entidades);
      const profesionalId = resolveId(rawProfesional, cache.profesionales);

      const fechaStr = fechaDia.toISOString().slice(0, 10);
      const hash = hashFila({
        descripcionRaw: rawDescripcion,
        autorizacion:   rawAutorizacion,
        entidad:        rawEntidad,
        profesional:    rawProfesional,
        valor:          String(valor),
        fecha:          fechaStr,
      });

      toInsert.push({
        descripcionRaw:     rawDescripcion,
        descripcionNorm:    normalizeDescripcion(rawDescripcion),
        fechaDia,
        mesIdx,
        anio,
        valorBruto:         valor,
        numeroAutorizacion: rawAutorizacion || null,
        esTelemetria:       rawDescripcion.toUpperCase().includes('TELEMETRIA'),
        hashFila:           hash,
        entidadId,
        profesionalId,
        conectorId,
      });
    } catch (err) {
      errors++;
      logger.warn('Failed to map sheet row to atencion', {
        error: err instanceof Error ? err.message : String(err),
        row,
      });
    }
  }

  if (toInsert.length > 0) {
    const values = toInsert.map((item) => [
      randomUUID(),
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
    const [insertResult] = await pool.query<ResultSetHeader>(
      'INSERT IGNORE INTO atenciones (id, descripcion_raw, descripcion_norm, fecha_dia, mes_idx, anio, valor_bruto, numero_autorizacion, es_telemetria, hash_fila, entidad_id, profesional_id, servicio_id, conector_id) VALUES ?',
      [values]
    );
    created = insertResult.affectedRows;
    skipped += toInsert.length - insertResult.affectedRows;
  }

  return { created, skipped, errors };
}
