/**
 * Generador de PDF con marca Neurofic.
 *
 * jsPDF y jspdf-autotable se importan de forma DINAMICA: ~120 kB gzip que no
 * deben entrar al bundle principal. Este modulo exporta una unica funcion.
 *
 * La geometria y la paleta replican el comprobante de honorarios del backend
 * para que ambos documentos se vean como parte de la misma familia.
 */

import type jsPDFType from 'jspdf';
import type { ExportChartSection, ExportDoc, ExportKpiSection, ExportTableSection } from './types.js';
import { defaultAlign } from './types.js';
import { formatCell, toPdfSafe, totalsLayout } from './format.js';
import { BRAND, PAGE, RGB, pieDePagina } from './brand.js';
import { getLogoPng, LOGO_RATIO } from './logo.js';
import { svgToPng } from './svgToPng.js';

export interface PdfBuildResult {
  blob: Blob;
  warnings: string[];
}

/** Alto de la banda azul del encabezado. */
const BAND_H = 70;

/**
 * Tope de filas por PDF.
 *
 * autoTable maqueta todo el cuerpo de forma síncrona en el hilo principal:
 * 5.000 filas son ~170 páginas y varios minutos de pestaña congelada. Por
 * encima de esto se avisa y se sugiere Excel, que sí escala.
 */
const MAX_FILAS_PDF = 2000;

export async function buildPdf(doc: ExportDoc): Promise<PdfBuildResult> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const warnings: string[] = [];
  const orientation = doc.orientation ?? 'portrait';
  // compress: true aplica FlateDecode a los streams; sin el, un PDF con una
  // grafica y el logo pesa ~3 MB.
  const pdf: jsPDFType = new jsPDF({ unit: 'pt', format: 'letter', orientation, compress: true });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const X = PAGE.marginLeft;
  const W = pageW - PAGE.marginLeft - PAGE.marginRight;

  // ── Banda de encabezado ────────────────────────────────────────────────────
  pdf.setFillColor(...RGB.azul);
  pdf.rect(X, PAGE.marginTop - 10, W, BAND_H, 'F');

  const logo = await getLogoPng();
  let textX = X + 16;
  if (logo) {
    const h = 42;
    const w = h / LOGO_RATIO;
    pdf.addImage(logo.dataUrl, 'PNG', X + 14, PAGE.marginTop - 10 + (BAND_H - h) / 2, w, h, 'logo', 'FAST');
    textX = X + 14 + w + 12;
  } else {
    warnings.push('No se pudo incrustar el logotipo.');
  }

  pdf.setTextColor(...RGB.blanco);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text(toPdfSafe(BRAND.nombre), textX, PAGE.marginTop + 14);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.text(toPdfSafe(BRAND.descriptor), textX, PAGE.marginTop + 28);

  // Chip del período, alineado a la derecha de la banda.
  const chip = toPdfSafe(doc.periodLabel);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  const chipW = pdf.getTextWidth(chip) + 20;
  pdf.setFillColor(...RGB.azulClaro);
  pdf.roundedRect(X + W - chipW - 14, PAGE.marginTop + 6, chipW, 22, 5, 5, 'F');
  pdf.text(chip, X + W - chipW / 2 - 14, PAGE.marginTop + 20, { align: 'center' });

  let y = PAGE.marginTop - 10 + BAND_H + 24;

  // ── Titulo ─────────────────────────────────────────────────────────────────
  pdf.setTextColor(...RGB.tinta);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text(toPdfSafe(doc.title).toUpperCase(), X + W / 2, y, { align: 'center' });
  y += 8;
  pdf.setDrawColor(...RGB.borde);
  pdf.line(X, y, X + W, y);
  y += 18;

  if (doc.subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...RGB.gris);
    pdf.text(toPdfSafe(doc.subtitle), X + W / 2, y, { align: 'center' });
    y += 16;
  }

  // ── Filtros aplicados ──────────────────────────────────────────────────────
  if (doc.filters.length > 0) {
    const colW = W / 2;
    doc.filters.forEach((f, i) => {
      const cx = X + (i % 2) * colW;
      const cy = y + Math.floor(i / 2) * 26;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...RGB.gris);
      pdf.text(toPdfSafe(f.label).toUpperCase(), cx, cy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...RGB.tinta);
      pdf.text(toPdfSafe(f.value), cx, cy + 11);
    });
    y += Math.ceil(doc.filters.length / 2) * 26 + 8;
  }

  /** Salto de pagina si no cabe `need` puntos. */
  const ensure = (need: number): void => {
    if (y + need > pageH - PAGE.marginBottom - 20) {
      pdf.addPage();
      y = PAGE.contentTop;
    }
  };

  const sectionTitle = (title: string, note?: string): void => {
    ensure(46);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...RGB.azul);
    pdf.text(toPdfSafe(title), X, y);
    y += note ? 12 : 14;
    if (note) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...RGB.gris);
      pdf.text(toPdfSafe(note), X, y);
      y += 12;
    }
  };

  // ── KPIs: cuadricula 2xN dibujada a mano (autoTable no es la herramienta) ──
  const drawKpis = (s: ExportKpiSection): void => {
    sectionTitle(s.title, s.note);
    const perRow = orientation === 'landscape' ? 4 : 3;
    const gap = 10;
    const cardW = (W - gap * (perRow - 1)) / perRow;
    const cardH = 46;

    s.items.forEach((item, i) => {
      const col = i % perRow;
      if (col === 0) ensure(cardH + 6);
      const cx = X + col * (cardW + gap);
      const cy = y;
      pdf.setFillColor(...RGB.claro);
      pdf.roundedRect(cx, cy, cardW, cardH, 4, 4, 'F');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(...RGB.gris);
      pdf.text(toPdfSafe(item.label).toUpperCase(), cx + 8, cy + 15, { maxWidth: cardW - 16 });
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(...RGB.tinta);
      pdf.text(toPdfSafe(formatCell(item.value, item.format)), cx + 8, cy + 33, { maxWidth: cardW - 16 });
      if (col === perRow - 1 || i === s.items.length - 1) y += cardH + gap;
    });
    y += 6;
  };

  // ── Tablas ─────────────────────────────────────────────────────────────────
  const drawTable = (t: ExportTableSection, titleOverride?: string): void => {
    if (t.columns.length === 0) return;
    if (t.rows.length > MAX_FILAS_PDF) {
      warnings.push(
        `"${t.title}" tiene ${t.rows.length.toLocaleString('es-CO')} filas y se omitió del PDF ` +
        `(máximo ${MAX_FILAS_PDF.toLocaleString('es-CO')}). Usa Excel o CSV para ese detalle.`,
      );
      return;
    }
    // Titulo + encabezado + un par de filas: evita el titulo huerfano.
    ensure(46 + 60);
    sectionTitle(titleOverride ?? t.title, t.note);

    const head = [t.columns.map((c) => toPdfSafe(c.header))];
    const body = t.rows.map((row) =>
      t.columns.map((c) => toPdfSafe(formatCell(c.accessor(row), c.format))),
    );

    let foot: string[][] | undefined;
    const totals = t.totals;
    if (totals) {
      const { labelKey, prefixFirst } = totalsLayout(t.columns.map((c) => c.key), totals.values);
      foot = [
        t.columns.map((c, idx) => {
          if (c.key === labelKey) return toPdfSafe(totals.label);
          const text = toPdfSafe(formatCell(totals.values[c.key] ?? null, c.format));
          return prefixFirst && idx === 0 ? `${toPdfSafe(totals.label)} ${text}` : text;
        }),
      ];
    }

    const columnStyles: Record<number, { halign: 'left' | 'center' | 'right'; cellWidth?: number }> = {};
    t.columns.forEach((c, i) => {
      columnStyles[i] = { halign: c.align ?? defaultAlign(c.format) };
    });

    autoTable(pdf, {
      head,
      body,
      foot,
      startY: y,
      margin: { left: X, right: PAGE.marginRight, top: PAGE.contentTop, bottom: PAGE.marginBottom + 16 },
      styles: { fontSize: 8.5, cellPadding: 4, overflow: 'linebreak', textColor: RGB.tinta },
      headStyles: {
        fillColor: RGB.claro,
        textColor: RGB.pizarra,
        fontStyle: 'bold',
        fontSize: 7.5,
      },
      alternateRowStyles: { fillColor: RGB.cebra },
      footStyles: {
        fillColor: RGB.azul,
        textColor: RGB.blanco,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      columnStyles,
    });

    const after = (pdf as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    y = (after?.finalY ?? y) + 22;
  };

  // ── Graficas ───────────────────────────────────────────────────────────────
  const drawChart = async (s: ExportChartSection): Promise<void> => {
    const shot = await svgToPng(s.getEl());
    if (!shot) {
      warnings.push(`La grafica "${s.title}" no estaba visible y se omitio.`);
      if (s.fallbackTable) drawTable(s.fallbackTable, s.title);
      return;
    }
    const drawW = Math.min(W, 460);
    const drawH = (drawW * shot.h) / shot.w;
    // Reservar titulo + imagen juntos: si se reserva solo el titulo, este queda
    // huerfano al pie de una pagina y la gráfica arranca sola en la siguiente.
    ensure(46 + drawH + 10);
    sectionTitle(s.title, s.note);
    pdf.addImage(shot.dataUrl, 'PNG', X + (W - drawW) / 2, y, drawW, drawH, `chart-${s.id}`, 'FAST');
    y += drawH + 18;
    // La leyenda de recharts vive fuera del <svg>, asi que la tabla equivalente
    // es la unica forma de que los valores lleguen al PDF.
    if (s.fallbackTable) drawTable(s.fallbackTable, `${s.title} - detalle`);
  };

  for (const s of doc.sections) {
    if (s.kind === 'kpis') drawKpis(s);
    else if (s.kind === 'table') drawTable(s);
    else await drawChart(s);
  }

  // ── Pie y numeracion, al final para conocer el total de paginas ────────────
  const total = pdf.getNumberOfPages();
  const pie = pieDePagina(new Date());
  for (let i = 1; i <= total; i += 1) {
    pdf.setPage(i);
    pdf.setDrawColor(...RGB.borde);
    pdf.line(X, pageH - PAGE.marginBottom - 8, X + W, pageH - PAGE.marginBottom - 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...RGB.gris);
    pdf.text(toPdfSafe(pie), X, pageH - PAGE.marginBottom + 4);
    pdf.text(`Página ${i} de ${total}`, X + W, pageH - PAGE.marginBottom + 4, { align: 'right' });
  }

  return { blob: pdf.output('blob'), warnings };
}
