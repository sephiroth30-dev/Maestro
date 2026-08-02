/**
 * Generador CSV sin dependencias.
 *
 * Es la salida correcta para volcados grandes (Auditoria) donde armar un
 * workbook en memoria seria caro. Separador ';' porque Excel en configuracion
 * regional es-CO lo espera; coma partiria los miles.
 */

import type { ExportDoc, ExportTableSection } from './types.js';
import { formatCell, totalsLayout } from './format.js';
import { fmtFechaLarga } from './brand.js';

function esc(v: string): string {
  // Excel interpreta como formula toda celda que empiece por = + - @ o tab. Un
  // nombre de entidad venido del Sheet puede empezar asi, y al abrir el archivo
  // se ejecutaria. El apostrofo inicial la neutraliza.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(doc: ExportDoc): Blob {
  const lines: string[] = [];
  lines.push(esc(doc.title));
  lines.push(esc(`Periodo: ${doc.periodLabel}`));
  for (const f of doc.filters) lines.push(esc(`${f.label}: ${f.value}`));
  lines.push(esc(`Generado: ${fmtFechaLarga(new Date())}`));

  for (const s of doc.sections) {
    lines.push('');

    if (s.kind === 'kpis') {
      lines.push(esc(`### ${s.title}`));
      lines.push(['Indicador', 'Valor'].join(';'));
      for (const i of s.items) {
        lines.push([esc(i.label), esc(formatCell(i.value, i.format))].join(';'));
      }
      continue;
    }

    const table: ExportTableSection | null =
      s.kind === 'table' ? s : (s.fallbackTable ?? null);
    if (!table || table.columns.length === 0) continue;

    lines.push(esc(`### ${table.title || s.title}`));
    lines.push(table.columns.map((c) => esc(c.header)).join(';'));

    for (const row of table.rows) {
      lines.push(table.columns.map((c) => esc(formatCell(c.accessor(row), c.format))).join(';'));
    }

    const totals = table.totals;
    if (totals) {
      const { labelKey, prefixFirst } = totalsLayout(table.columns.map((c) => c.key), totals.values);
      lines.push(
        table.columns
          .map((c, idx) => {
            if (c.key === labelKey) return esc(totals.label);
            const text = formatCell(totals.values[c.key] ?? null, c.format);
            return esc(prefixFirst && idx === 0 ? `${totals.label} ${text}` : text);
          })
          .join(';'),
      );
    }
  }

  // BOM para que Excel en Windows detecte UTF-8 y no rompa los acentos.
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
}
