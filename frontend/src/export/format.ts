/**
 * Formateo de celdas compartido por los tres generadores.
 *
 * Regla de oro: Excel recibe el valor CRUDO (numero o Date) mas un formato
 * numerico; PDF y CSV reciben el texto ya formateado. Un numero guardado como
 * texto en Excel no se puede sumar, que es justo para lo que se exporta.
 */

import type { CellFormat, CellValue } from './types.js';

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const NUM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/**
 * Parsea 'YYYY-MM-DD' como fecha LOCAL.
 *
 * `new Date('2026-07-01')` se interpreta como medianoche UTC y en Colombia
 * (UTC-5) se muestra como 30 de junio. Mismo criterio que Reportes.tsx y
 * Honorarios.tsx.
 */
export function parseLocalDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Convierte un valor de celda a Date, o null si no es representable. */
export function toDate(value: CellValue): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return parseLocalDate(value);
}

const DATE_FMT = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATETIME_FMT = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Representacion textual, usada por PDF y CSV. */
export function formatCell(value: CellValue, format: CellFormat = 'text'): string {
  if (value === null || value === undefined) return '';

  switch (format) {
    case 'currency': {
      const n = Number(value);
      return Number.isFinite(n) ? COP.format(n) : '';
    }
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? NUM.format(n) : '';
    }
    case 'percent': {
      const n = Number(value);
      return Number.isFinite(n) ? `${n.toFixed(1)}%` : '';
    }
    case 'date': {
      const d = toDate(value);
      return d ? DATE_FMT.format(d) : String(value);
    }
    case 'datetime': {
      const d = toDate(value);
      return d ? DATETIME_FMT.format(d) : String(value);
    }
    default:
      return String(value);
  }
}

/**
 * Valor crudo para Excel: numero para las metricas, Date para las fechas,
 * texto para el resto. Nunca una cadena pre-formateada de un numero.
 */
export function excelValue(
  value: CellValue,
  format: CellFormat = 'text',
): string | number | Date | null {
  if (value === null || value === undefined || value === '') return null;

  switch (format) {
    case 'currency':
    case 'number':
    case 'percent': {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'date':
    case 'datetime':
      return toDate(value);
    default:
      return String(value);
  }
}

/** Formato numerico de Excel por tipo de celda. */
export function excelNumFmt(format: CellFormat = 'text'): string | null {
  switch (format) {
    case 'currency':
      return '"$" #,##0';
    case 'number':
      return '#,##0';
    // La API devuelve 73.4 (no 0.734), asi que se anexa el simbolo en vez de
    // usar el formato porcentual nativo, que multiplicaria por 100.
    case 'percent':
      return '0.0"%"';
    case 'date':
      return 'dd/mm/yyyy';
    case 'datetime':
      return 'dd/mm/yyyy hh:mm';
    default:
      return null;
  }
}

/**
 * Sanea texto para las fuentes estandar de jsPDF (Helvetica / WinAnsi).
 *
 * WinAnsi (cp1252) SI cubre los acentos del espanol y signos como el punto
 * medio o los guiones largos, pero NO cubre los simbolos que esta app usa en
 * cadenas visibles (palomitas, equis, distinto-de, flechas, reloj, alerta).
 * Sin esta sustitucion salen como basura en el PDF.
 */
const PDF_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[✓✔]/g, 'Si'],
  [/[✗✘×]/g, 'No'],
  [/≠/g, 'distinto de'],
  [/≥/g, '>='],
  [/≤/g, '<='],
  [/[→⇒]/g, '->'],
  [/[←⇐]/g, '<-'],
  [/↑/g, '(asc)'],
  [/↓/g, '(desc)'],
  [/↕/g, ''],
  [/[⏳⌛]/g, ''],
  [/[⚠⚡]/g, ''],
  [/[•●]/g, '-'],
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/ /g, ' '],
];

export function toPdfSafe(input: string): string {
  let out = input;
  for (const [re, rep] of PDF_REPLACEMENTS) out = out.replace(re, rep);
  // Elimina cualquier resto fuera de Latin-1 (emojis, flechas exoticas, etc.).
  out = out.replace(/[^ -ÿ\n]/g, '');
  return out.replace(/[ \t]{2,}/g, ' ').trim();
}

/** Nombre de archivo seguro: ASCII, sin espacios ni acentos. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60);
}

/**
 * Decide donde va la etiqueta de la fila de totales.
 *
 * Va en la primera columna que no tenga valor propio. Si TODAS las columnas
 * visibles tienen valor (pasa al desmarcar las descriptivas y dejar solo las
 * numericas), no hay hueco: entonces se antepone al primer valor, porque una
 * fila de totales sin etiqueta es indistinguible de una fila de datos —
 * sobre todo en CSV, donde no hay negrita ni color que la delaten.
 */
export function totalsLayout(
  columnKeys: string[],
  values: Record<string, unknown>,
): { labelKey: string | null; prefixFirst: boolean } {
  const free = columnKeys.find((k) => values[k] === undefined);
  if (free !== undefined) return { labelKey: free, prefixFirst: false };
  return { labelKey: null, prefixFirst: true };
}
