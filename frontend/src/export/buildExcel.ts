/**
 * Generador de libros de Excel.
 *
 * ExcelJS se importa de forma DINAMICA a proposito: son ~270 kB gzip que no
 * deben entrar al bundle principal. Por eso este modulo exporta una unica
 * funcion async y el unico `import` estatico de exceljs es de tipos.
 */

import type { Workbook, Worksheet } from 'exceljs';
import type { ExportDoc, ExportTableSection } from './types.js';
import { defaultAlign } from './types.js';
import { excelNumFmt, excelValue, formatCell, totalsLayout } from './format.js';
import { ARGB, BRAND, fmtFechaLarga } from './brand.js';

/** Excel rechaza nombres de hoja >31 chars, con []:*?/\ o duplicados. */
function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[[\]:*?/\\]/g, '').trim().slice(0, 31) || 'Hoja';
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function writeTable(ws: Worksheet, table: ExportTableSection): void {
  const cols = table.columns;

  ws.columns = cols.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(12, Math.min(48, c.header.length + 6)),
  }));

  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: ARGB.encabezadoTexto } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.encabezadoFondo } };
  head.alignment = { vertical: 'middle', wrapText: true };
  head.height = 22;

  for (const row of table.rows) {
    const values: Record<string, string | number | Date | null> = {};
    for (const c of cols) values[c.key] = excelValue(c.accessor(row), c.format);
    ws.addRow(values);
  }

  const totals = table.totals;
  if (totals) {
    const { labelKey, prefixFirst } = totalsLayout(cols.map((c) => c.key), totals.values);
    const values: Record<string, string | number | Date | null> = {};
    cols.forEach((c, idx) => {
      if (c.key === labelKey) {
        values[c.key] = totals.label;
      } else if (prefixFirst && idx === 0) {
        // Sin columna libre: la etiqueta se antepone al texto para que la fila
        // siga siendo reconocible. Deja de ser numerica, pero es la ultima fila.
        values[c.key] = `${totals.label} ${formatCell(totals.values[c.key] ?? null, c.format)}`;
      } else {
        values[c.key] = excelValue(totals.values[c.key] ?? null, c.format);
      }
    });
    const r = ws.addRow(values);
    r.font = { bold: true, color: { argb: ARGB.totalTexto } };
    r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.totalFondo } };
  }

  // Formato por columna despues de escribir: aplicar antes lo pisa addRow.
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    const fmt = excelNumFmt(c.format);
    if (fmt) col.numFmt = fmt;
    col.alignment = { horizontal: c.align ?? defaultAlign(c.format), wrapText: (c.width ?? 0) > 40 };
  });

  ws.views = [{ state: 'frozen', ySplit: 1 }];
  if (cols.length > 0 && table.rows.length > 0) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }
}

export async function buildExcel(doc: ExportDoc): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = 'Neurofic Admin';
  wb.created = new Date();

  // ── Portada: el contexto que se pierde en cuanto alguien copia una hoja ──
  const cover = wb.addWorksheet('Portada');
  cover.columns = [{ width: 32 }, { width: 60 }];
  const title = cover.addRow([doc.title]);
  title.font = { bold: true, size: 16, color: { argb: ARGB.tituloTexto } };
  if (doc.subtitle) {
    cover.addRow([doc.subtitle]).font = { color: { argb: ARGB.notaTexto } };
  }
  cover.addRow([]);
  cover.addRow(['Período', doc.periodLabel]).getCell(1).font = { bold: true };
  for (const f of doc.filters) {
    cover.addRow([f.label, f.value]).getCell(1).font = { bold: true };
  }
  cover.addRow(['Generado', fmtFechaLarga(new Date())]).getCell(1).font = { bold: true };
  cover.addRow(['Origen', `${BRAND.nombre} Admin - ${BRAND.sitio}`]).getCell(1).font = { bold: true };
  cover.addRow([]);
  const idxHead = cover.addRow(['Contenido', 'Filas']);
  idxHead.font = { bold: true, color: { argb: ARGB.encabezadoTexto } };
  idxHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.encabezadoFondo } };

  const used = new Set<string>(['portada']);

  for (const s of doc.sections) {
    if (s.kind === 'kpis') {
      const ws = wb.addWorksheet(sheetName(s.title, used));
      ws.columns = [{ header: 'Indicador', key: 'k', width: 34 }, { header: 'Valor', key: 'v', width: 22 }];
      const h = ws.getRow(1);
      h.font = { bold: true, color: { argb: ARGB.encabezadoTexto } };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ARGB.encabezadoFondo } };
      for (const item of s.items) {
        const row = ws.addRow({ k: item.label, v: excelValue(item.value, item.format) });
        const fmt = excelNumFmt(item.format);
        if (fmt) row.getCell(2).numFmt = fmt;
      }
      ws.views = [{ state: 'frozen', ySplit: 1 }];
      cover.addRow([s.title, s.items.length]);
      continue;
    }

    // Las graficas no se incrustan en Excel; se exporta su tabla equivalente,
    // que ademas es lo que el usuario puede analizar.
    const table: ExportTableSection | null =
      s.kind === 'table' ? s : (s.fallbackTable ?? null);
    if (!table || table.columns.length === 0) continue;

    const ws = wb.addWorksheet(sheetName(table.title || s.title, used));
    writeTable(ws, table);
    cover.addRow([table.title || s.title, table.rows.length]);
    if (table.note) {
      const note = ws.addRow([]);
      note.getCell(1).value = table.note;
      note.font = { italic: true, color: { argb: ARGB.notaTexto } };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
