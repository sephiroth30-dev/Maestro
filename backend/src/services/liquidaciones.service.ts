import PDFDocument from 'pdfkit';
import { calcularHonorariosRango } from './honorarios.service.js';
import {
  getLiquidacionesByPeriodo,
  getLiquidacionById,
  upsertLiquidacion,
  actualizarEstado,
  actualizarEstadoLote,
  type LiquidacionDB,
} from '../repositories/liquidaciones.repo.js';
import type { HonorariosProfesionalRow } from './honorarios.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

function fmtFecha(iso: string | Date | null | undefined): string {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });
}

// ─── Generar / actualizar liquidaciones para un período ───────────────────────

export async function generarLiquidaciones(
  fechaDesde: string,
  fechaHasta: string,
): Promise<LiquidacionDB[]> {
  const resultado = await calcularHonorariosRango(fechaDesde, fechaHasta);

  for (const row of resultado.rows) {
    await upsertLiquidacion({
      profesional_id: row.profesional_id,
      fecha_desde:    fechaDesde,
      fecha_hasta:    fechaHasta,
      monto_total:    row.total,
      datos_snapshot: row,
    });
  }

  return getLiquidacionesByPeriodo(fechaDesde, fechaHasta);
}

// ─── Aprobar ──────────────────────────────────────────────────────────────────

export async function aprobarLiquidacion(id: string, usuarioId: string): Promise<LiquidacionDB | null> {
  await actualizarEstado(id, 'APROBADO', usuarioId);
  return getLiquidacionById(id);
}

export async function aprobarLote(ids: string[], usuarioId: string): Promise<void> {
  await actualizarEstadoLote(ids, 'APROBADO', usuarioId);
}

// ─── Pagar ────────────────────────────────────────────────────────────────────

export async function pagarLiquidacion(id: string, usuarioId: string, notas?: string): Promise<LiquidacionDB | null> {
  await actualizarEstado(id, 'PAGADO', usuarioId, notas);
  return getLiquidacionById(id);
}

export async function pagarLote(ids: string[], usuarioId: string): Promise<void> {
  await actualizarEstadoLote(ids, 'PAGADO', usuarioId);
}

// ─── Re-exportar queries ──────────────────────────────────────────────────────

export { getLiquidacionesByPeriodo, getLiquidacionById };

// ─── Generación de PDF ────────────────────────────────────────────────────────

const CATS: { key: keyof Omit<HonorariosProfesionalRow, 'profesional_id' | 'nombre' | 'total' | 'sin_regla'>; label: string }[] = [
  { key: 'consulta',        label: 'Consulta' },
  { key: 'emg_vcn',         label: 'EMG / VCN' },
  { key: 'infiltracion',    label: 'Infiltración' },
  { key: 'ecografia',       label: 'Ecografía' },
  { key: 'terapia_choque',  label: 'Ondas de Choque' },
  { key: 'junta',           label: 'Junta Médica' },
  { key: 'eeg',             label: 'EEG' },
  { key: 'psg_lms',         label: 'PSG / MSLT' },
  { key: 'tlm',             label: 'Telemetría' },
  { key: 'pe',              label: 'Potenciales Evocados' },
];

export async function generarPDFLiquidacion(id: string): Promise<Buffer> {
  const liq = await getLiquidacionById(id);
  if (!liq) throw new Error('Liquidación no encontrada');

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 50, bottom: 50, left: 60, right: 60 },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 120; // usable width
    const X = 60;                   // left margin
    const BLUE = '#1e40af';
    const GRAY = '#64748b';
    const LIGHT = '#f1f5f9';

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(X, 40, W, 70).fill(BLUE);

    doc.fillColor('white')
       .fontSize(22).font('Helvetica-Bold')
       .text('NEUROFIC', X + 16, 52, { width: W / 2 });

    doc.fontSize(9).font('Helvetica')
       .text('Centro Neurológico de Rehabilitación', X + 16, 76);

    const estado = liq.estado;
    const estadoColor = estado === 'PAGADO' ? '#22c55e' : estado === 'APROBADO' ? '#3b82f6' : '#f59e0b';
    doc.roundedRect(X + W - 110, 55, 94, 22, 4).fill(estadoColor);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
       .text(estado, X + W - 110, 60, { width: 94, align: 'center' });

    // ── Subtitle ──────────────────────────────────────────────────────────────
    doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold')
       .text('COMPROBANTE DE HONORARIOS MÉDICOS', X, 128, { width: W, align: 'center' });

    doc.moveTo(X, 148).lineTo(X + W, 148).strokeColor('#cbd5e1').lineWidth(1).stroke();

    // ── Info profesional ──────────────────────────────────────────────────────
    const infoY = 158;
    const col2 = X + W / 2;

    const infoRow = (label: string, value: string, y: number, col = X) => {
      doc.fillColor(GRAY).fontSize(8).font('Helvetica').text(label.toUpperCase(), col, y);
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(value, col, y + 11, { width: W / 2 - 10 });
    };

    infoRow('Profesional', liq.profesional_display, infoY);
    infoRow('Período', `${fmtFecha(liq.fecha_desde)} — ${fmtFecha(liq.fecha_hasta)}`, infoY, col2);
    if (liq.especialidad) infoRow('Especialidad', liq.especialidad, infoY + 36);
    infoRow('N° Comprobante', liq.id.substring(0, 8).toUpperCase(), infoY + 36, col2);

    doc.moveTo(X, infoY + 68).lineTo(X + W, infoY + 68).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

    // ── Tabla de servicios ────────────────────────────────────────────────────
    const tableY = infoY + 80;
    const colWidths = [W * 0.50, W * 0.20, W * 0.30];

    // Header de tabla
    doc.rect(X, tableY, W, 20).fill(LIGHT);
    doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold');
    doc.text('CATEGORÍA DE SERVICIO', X + 8, tableY + 6, { width: colWidths[0] - 8 });
    doc.text('CANTIDAD', X + colWidths[0], tableY + 6, { width: colWidths[1], align: 'center' });
    doc.text('HONORARIO', X + colWidths[0] + colWidths[1], tableY + 6, { width: colWidths[2] - 8, align: 'right' });

    let rowY = tableY + 20;
    let rowIdx = 0;
    const snapshot = liq.datos_snapshot;

    for (const { key, label } of CATS) {
      const celda = snapshot[key] as { monto: number; cnt: number };
      if (!celda || celda.monto === 0) continue;

      if (rowIdx % 2 === 0) {
        doc.rect(X, rowY, W, 18).fill('#fafafa');
      }
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica')
         .text(label, X + 8, rowY + 4, { width: colWidths[0] - 8 });
      doc.text(String(celda.cnt), X + colWidths[0], rowY + 4, { width: colWidths[1], align: 'center' });
      doc.font('Helvetica-Bold')
         .text(fmtCOP(celda.monto), X + colWidths[0] + colWidths[1], rowY + 4, { width: colWidths[2] - 8, align: 'right' });
      rowY += 18;
      rowIdx++;
    }

    // Sin regla (si aplica)
    if (snapshot.sin_regla?.monto > 0) {
      doc.rect(X, rowY, W, 18).fill('#fef9c3');
      doc.fillColor('#92400e').fontSize(9.5).font('Helvetica')
         .text('Sin regla (valor facturado)', X + 8, rowY + 4, { width: colWidths[0] - 8 });
      doc.text(String(snapshot.sin_regla.cnt), X + colWidths[0], rowY + 4, { width: colWidths[1], align: 'center' });
      doc.font('Helvetica-Bold')
         .text(fmtCOP(snapshot.sin_regla.monto), X + colWidths[0] + colWidths[1], rowY + 4, { width: colWidths[2] - 8, align: 'right' });
      rowY += 18;
    }

    // Total
    doc.rect(X, rowY, W, 24).fill(BLUE);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
       .text('TOTAL HONORARIOS', X + 8, rowY + 6, { width: colWidths[0] + colWidths[1] - 8 });
    doc.text(fmtCOP(liq.monto_total), X + colWidths[0] + colWidths[1], rowY + 6,
             { width: colWidths[2] - 8, align: 'right' });
    rowY += 24;

    // ── Info aprobación / pago ────────────────────────────────────────────────
    rowY += 20;
    if (liq.aprobado_en) {
      doc.fillColor(GRAY).fontSize(8).font('Helvetica').text('APROBADO POR', X, rowY);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
         .text(`${liq.aprobado_por_nombre ?? '—'}  •  ${fmtFecha(liq.aprobado_en)}`, X, rowY + 11);
      rowY += 32;
    }
    if (liq.pagado_en) {
      doc.fillColor(GRAY).fontSize(8).font('Helvetica').text('PAGO REGISTRADO POR', X, rowY);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold')
         .text(`${liq.pagado_por_nombre ?? '—'}  •  ${fmtFecha(liq.pagado_en)}`, X, rowY + 11);
      if (liq.notas) {
        doc.fillColor(GRAY).fontSize(8).font('Helvetica').text('NOTAS', X, rowY + 30);
        doc.fillColor('#334155').fontSize(9).font('Helvetica').text(liq.notas, X, rowY + 41);
      }
      rowY += 52;
    }

    // ── Firma ──────────────────────────────────────────────────────────────────
    rowY += 20;
    const sigWidth = 180;
    doc.moveTo(X, rowY + 30).lineTo(X + sigWidth, rowY + 30).strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text('Firma del profesional', X, rowY + 34, { width: sigWidth, align: 'center' });

    doc.moveTo(X + W - sigWidth, rowY + 30).lineTo(X + W, rowY + 30).strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
       .text('Fecha', X + W - sigWidth, rowY + 34, { width: sigWidth, align: 'center' });

    // ── Footer ─────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.moveTo(X, footerY - 8).lineTo(X + W, footerY - 8).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fillColor(GRAY).fontSize(7.5).font('Helvetica')
       .text(
         `Generado el ${fmtFecha(new Date().toISOString())} · Neurofic Admin · neurofic.easystem.co`,
         X, footerY, { width: W, align: 'center' },
       );

    doc.end();
  });
}
