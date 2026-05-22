import { createHash } from 'node:crypto';

/**
 * Normalizes a service description string using the same algorithm as
 * Apps Script V10.2 used in the Neurofic Google Sheets billing tracker.
 */
export function normalizeDescripcion(descRaw: string): string {
  let s = String(descRaw || '').trim();
  if (!s) return '';

  // 1. Uppercase + remove diacritics
  let u = s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // 2. Cut before NUA and ESTADO tokens
  for (const token of [' NUA', 'NUA', ' ESTADO', 'ESTADO']) {
    const idx = u.indexOf(token);
    if (idx !== -1) {
      u = u.slice(0, idx).trim();
      break;
    }
  }
  s = u;

  // 3. Remove specific phrases
  s = s
    .replace(/\bSEGUN\s+FABRICANTE\b/g, '')
    .replace(/\bREUTILIZABLE\b/g, '')
    .replace(/\bDE\s+CONTROL\b/g, 'CONTROL')
    .replace(/\bDE\s+SEGUIMIENTO\b/g, 'SEGUIMIENTO');

  // 4. Remove numbers, units, punctuation
  s = s
    .replace(/\b\d+([.,]\d+)?\b/g, '')
    .replace(/\bMM\b|\bCM\b|\bML\b|\bMG\b|\bGR\b/g, '')
    .replace(/[()\/\-_:;.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 5. Filter stopwords, max 8 tokens
  const STOP = new Set([
    'EL', 'LA', 'LOS', 'LAS', 'DE', 'DEL', 'AL', 'A', 'Y',
    'EN', 'PARA', 'POR', 'CON', 'SIN', 'UN', 'UNA', 'UNOS', 'UNAS',
  ]);

  const tokens = s
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t && !STOP.has(t))
    .slice(0, 8);

  return tokens.join(' ').trim() || s;
}

/**
 * Generates a deterministic SHA-256 hash for a billing row.
 * Used to deduplicate rows imported from Google Sheets.
 */
export function hashFila(fields: {
  descripcionRaw: string;
  autorizacion: string;
  entidad: string;
  profesional: string;
  valor: string;
  fecha: string;
}): string {
  const raw = `${fields.descripcionRaw}|${fields.autorizacion}|${fields.entidad}|${fields.profesional}|${fields.valor}|${fields.fecha}`;
  return createHash('sha256').update(raw).digest('hex');
}
