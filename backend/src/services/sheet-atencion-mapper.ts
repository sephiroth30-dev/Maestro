import { createHash, randomUUID } from 'node:crypto';
import { pool } from '../config/prisma.js';
import { normalizeDescripcion } from './normalizacion.service.js';
import { logger } from '../config/logger.js';
import type { DataRow } from '../connectors/base.connector.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── Column auto-detection patterns ──────────────────────────────────────────

const PATTERNS = {
  fecha:        /^fecha(?!.*autori)/i,
  descripcion:  /^(descripcion|descripci[oó]n|servicio|description|detalle|item|concepto|procedimiento)/i,
  autorizacion: /^(autorizacion|autorizaci[oó]n|autori\b|auth\b|nro\.?\s*aut|n[uú]m\.?\s*aut|no\.?\s*aut|numero.*autori)/i,
  entidad:      /^(entidad|pagador|eps\b|aseguradora|empresa|convenio|paga)/i,
  profesional:  /^(profesional|m[eé]dico|doctor|terapeuta|especialista|prestador)/i,
  valor:        /^valor\s*bruto\b|^(valor\b|monto|tarifa|precio|importe|vr\b|vlr\b)/i,
  paciente:     /^(paciente|nombre.*(del\s*)?paciente|nombre\s*beneficiario|nombres?\s*paciente|nombres?\s*completo)/i,
  documento:    /^(documento|cc\b|c\.c\.|cedula|ced\b|n[uú]m(ero)?\s*(de\s*)?doc|nro\s*(de\s*)?doc|identificacion|historia\s*cl|hc\b)/i,
};

// Terms that disqualify a column from being the gross billing amount
const VALOR_EXCLUSION = /neto|copago|cuota|moderadora|paciente|descuento|bonif/i;

export function detectColumnMapping(columns: string[]): Record<keyof typeof PATTERNS, string | null> {
  const result = {} as Record<keyof typeof PATTERNS, string | null>;
  for (const field of Object.keys(PATTERNS) as Array<keyof typeof PATTERNS>) {
    if (field === 'valor') {
      // P0: "VALOR BRUTO POR CANTIDAD" — tarifa × unidades = total facturado real
      const brutoXCant = columns.find((c) =>
        /^valor\s*bruto\s*(por\s*cant|x\s*cant|\*\s*cant)/i.test(c.trim())
      );
      if (brutoXCant) { result[field] = brutoXCant; continue; }

      // P1: exact "VALOR BRUTO" (no trailing words)
      const exact = columns.find((c) => /^valor\s*bruto$/i.test(c.trim()));
      if (exact) { result[field] = exact; continue; }

      // P2: "VALOR BRUTO *" without neto/copago/cuota qualifiers
      const brutoClean = columns.find((c) => {
        const t = c.trim();
        return /^valor\s*bruto\b/i.test(t) && !VALOR_EXCLUSION.test(t);
      });
      if (brutoClean) { result[field] = brutoClean; continue; }

      // P3: any "VALOR BRUTO *" (even with qualifier — last resort before generic)
      const brutoAny = columns.find((c) => /^valor\s*bruto\b/i.test(c.trim()));
      if (brutoAny) { result[field] = brutoAny; continue; }

      // P4: generic value columns, but exclude neto/copago/cuota columns
      result[field] = columns.find((c) => {
        const t = c.trim();
        if (VALOR_EXCLUSION.test(t)) return false;
        return PATTERNS[field].test(t);
      }) ?? null;
    } else {
      result[field] = columns.find((c) => PATTERNS[field].test(c.trim())) ?? null;
    }
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
  rowIndex: number;
}): string {
  const str = [
    fields.descripcionRaw,
    fields.autorizacion,
    fields.entidad,
    fields.profesional,
    fields.valor,
    fields.fecha,
    String(fields.rowIndex),
  ].join('|');
  return createHash('sha256').update(str).digest('hex').slice(0, 64);
}

// ─── Entity/Professional resolution cache ─────────────────────────────────────

interface ResolverCache {
  entidades: Array<{ id: string; nombres: string[] }>;
  profesionales: Array<{ id: string; nombres: string[] }>;
  servicios: Array<{ id: string; palabrasClave: string[] }>;
}

async function buildCache(): Promise<ResolverCache> {
  const [[entidadRows], [profesionalRows], [servicioRows]] = await Promise.all([
    pool.query<RowDataPacket[]>('SELECT id, nombres_raw FROM entidades WHERE activa = 1'),
    pool.query<RowDataPacket[]>('SELECT id, nombres_raw FROM profesionales WHERE activo = 1'),
    pool.query<RowDataPacket[]>('SELECT id, palabras_clave FROM servicios ORDER BY orden ASC'),
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
    servicios: (servicioRows as RowDataPacket[])
      .filter((row) => row['palabras_clave'] != null)
      .map((row) => ({
        id: row['id'] as string,
        palabrasClave: ((typeof row['palabras_clave'] === 'string'
          ? JSON.parse(row['palabras_clave'])
          : row['palabras_clave']) as string[]).map((kw) =>
          // Normalize keyword same way as descripcionNorm: uppercase + no diacritics
          kw.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        ),
      })),
  };
}

function resolveServicioId(
  descripcionNorm: string,
  catalog: Array<{ id: string; palabrasClave: string[] }>
): string | null {
  const upper = descripcionNorm.toUpperCase();
  for (const servicio of catalog) {
    for (const kw of servicio.palabrasClave) {
      if (upper.includes(kw)) return servicio.id;
    }
  }
  return null;
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

// Per-row column mapping cache (keyed by sorted column names signature).
// Needed because folder-mode connectors combine rows from multiple files,
// each potentially having different column names for the same semantic field.
function getColMapForRow(
  row: DataRow,
  cache: Map<string, Record<keyof typeof PATTERNS, string | null>>
): Record<keyof typeof PATTERNS, string | null> {
  const sig = Object.keys(row).sort().join('\x00');
  if (!cache.has(sig)) {
    const colMap = detectColumnMapping(Object.keys(row));
    cache.set(sig, colMap);
    logger.info('Column mapping detected for row set', {
      columns: Object.keys(row),
      colMap,
    });
  }
  return cache.get(sig)!;
}

export async function mapRowsToAtenciones(
  rows: DataRow[],
  conectorId: string
): Promise<MapperResult> {
  if (rows.length === 0) return { created: 0, skipped: 0, errors: 0 };

  // Verify at least the first row has usable columns
  const firstColMap = detectColumnMapping(Object.keys(rows[0] ?? {}));
  if (!firstColMap.descripcion && !firstColMap.valor) {
    logger.warn('Cannot map sheet rows: no descripcion or valor column found', {
      columns: Object.keys(rows[0] ?? {}),
    });
    return { created: 0, skipped: 0, errors: 0 };
  }

  const colMapCache = new Map<string, Record<keyof typeof PATTERNS, string | null>>();
  const entityCache = await buildCache();
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
    entidadNombreRaw: string;
    profesionalId: string | null;
    servicioId: string | null;
    pacienteNombre: string | null;
    pacienteDocumento: string | null;
    conectorId: string;
  }
  const toInsert: AtencionInsert[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex]!;
    try {
      // Use per-row column mapping — critical for folder-mode where different
      // files may have different column names for the same semantic field.
      const colMap = getColMapForRow(row, colMapCache);

      const rawDescripcion  = colMap.descripcion  ? String(row[colMap.descripcion]  ?? '') : '';
      const rawValor        = colMap.valor         ? row[colMap.valor]                : null;
      const rawFecha        = colMap.fecha         ? row[colMap.fecha]                : null;
      const rawAutorizacion = colMap.autorizacion  ? String(row[colMap.autorizacion] ?? '') : '';
      const rawEntidad      = colMap.entidad       ? String(row[colMap.entidad]      ?? '') : '';
      const rawProfesional  = colMap.profesional   ? String(row[colMap.profesional]  ?? '') : '';
      const rawPaciente     = colMap.paciente      ? String(row[colMap.paciente]     ?? '').trim() : '';
      const rawDocumento    = colMap.documento     ? String(row[colMap.documento]    ?? '').trim() : '';

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

      const entidadId     = resolveId(rawEntidad,     entityCache.entidades);
      const profesionalId = resolveId(rawProfesional, entityCache.profesionales);
      const descripcionNorm = normalizeDescripcion(rawDescripcion);
      const servicioId    = resolveServicioId(descripcionNorm, entityCache.servicios);

      const fechaStr = fechaDia.toISOString().slice(0, 10);
      const hash = hashFila({
        descripcionRaw: rawDescripcion,
        autorizacion:   rawAutorizacion,
        entidad:        rawEntidad,
        profesional:    rawProfesional,
        valor:          String(valor),
        fecha:          fechaStr,
        rowIndex,
      });

      toInsert.push({
        descripcionRaw:     rawDescripcion,
        descripcionNorm,
        fechaDia,
        mesIdx,
        anio,
        valorBruto:         valor,
        numeroAutorizacion: rawAutorizacion || null,
        esTelemetria:       rawDescripcion.toUpperCase().includes('TELEMETRIA'),
        hashFila:           hash,
        entidadId,
        entidadNombreRaw:   rawEntidad,
        profesionalId,
        servicioId,
        pacienteNombre:     rawPaciente  || null,
        pacienteDocumento:  rawDocumento || null,
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
    const totalValor = toInsert.reduce((s, r) => s + r.valorBruto, 0);
    const zeroValor  = toInsert.filter((r) => r.valorBruto === 0).length;
    logger.info('Mapper summary before insert', {
      conectorId,
      rows: toInsert.length,
      skipped,
      errors,
      totalValorBruto: totalValor,
      rowsWithValorCero: zeroValor,
      columnSets: colMapCache.size,
    });

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
      item.servicioId,
      item.conectorId,
      item.entidadNombreRaw || null,
      item.pacienteNombre,
      item.pacienteDocumento,
    ]);

    // Full-refresh inside a transaction to avoid deadlocks when two syncs race.
    // MySQL deadlocks on concurrent DELETE→INSERT on the same conector_id rows;
    // serializing both operations in one transaction eliminates the race.
    let insertResult!: ResultSetHeader;
    const MAX_DEADLOCK_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_DEADLOCK_RETRIES; attempt++) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM atenciones WHERE conector_id = ?', [conectorId]);
        const [res] = await conn.query<ResultSetHeader>(
          'INSERT INTO atenciones (id, descripcion_raw, descripcion_norm, fecha_dia, mes_idx, anio, valor_bruto, numero_autorizacion, es_telemetria, hash_fila, entidad_id, profesional_id, servicio_id, conector_id, entidad_nombre_raw, paciente_nombre, paciente_documento) VALUES ?',
          [values]
        );
        await conn.commit();
        insertResult = res;
        break;
      } catch (err) {
        await conn.rollback();
        const isDeadlock = err instanceof Error &&
          (err.message.includes('Deadlock') || (err as { errno?: number }).errno === 1213);
        if (isDeadlock && attempt < MAX_DEADLOCK_RETRIES) {
          logger.warn('Deadlock on atenciones upsert — retrying', { conectorId, attempt });
          await new Promise((r) => setTimeout(r, 150 * attempt));
        } else {
          throw err;
        }
      } finally {
        conn.release();
      }
    }
    created = insertResult.affectedRows;
  }

  // Log unmatched entity names so admins can fix the catalog
  const unmatched = toInsert
    .filter((r) => !r.entidadId && r.entidadNombreRaw)
    .reduce((acc, r) => {
      acc.set(r.entidadNombreRaw, (acc.get(r.entidadNombreRaw) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());
  if (unmatched.size > 0) {
    logger.warn('entity-mapper: unmatched entity names (check catalog)', {
      conectorId,
      count: unmatched.size,
      nombres: Object.fromEntries(unmatched),
    });
  }

  return { created, skipped, errors };
}
