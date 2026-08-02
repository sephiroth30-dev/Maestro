/**
 * Harness de pruebas del sistema de exportacion.
 *
 * Se sirve solo en desarrollo desde /export-test.html y no forma parte del
 * build de produccion (vite solo empaqueta index.html). Expone
 * window.__exportTest para que Playwright dispare cada formato con datos
 * sinteticos que incluyen acentos, simbolos fuera de cp1252 y una grafica de
 * recharts real.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import type { ExportDoc } from './export/types.js';
import { defineTable } from './export/types.js';
import { applySelection } from './export/useExportSelection.js';
import type { ExportSelection } from './export/types.js';

interface Fila {
  entidad: string;
  tipo: string;
  cantidad: number;
  valor: number;
  part: number;
  fecha: string;
}

const FILAS: Fila[] = [
  { entidad: 'NUEVA EPS', tipo: 'EPS', cantidad: 412, valor: 38_450_000, part: 41.2, fecha: '2026-07-01' },
  { entidad: 'SURA — Medicina Prepagada', tipo: 'PREPAGADA', cantidad: 208, valor: 21_300_500, part: 22.8, fecha: '2026-07-15' },
  { entidad: 'PARTICULAR', tipo: 'PARTICULAR', cantidad: 173, valor: 15_980_000, part: 17.1, fecha: '2026-07-31' },
  { entidad: 'Colmédica ✓ ARL ≠ Positiva → 2026', tipo: 'ARL', cantidad: 96, valor: 9_120_000, part: 9.8, fecha: '2026-07-09' },
  { entidad: 'Señor Ñandú Ángel Óscar Übercharge', tipo: 'CONVENIO', cantidad: 84, valor: 8_470_000, part: 9.1, fecha: '2026-07-22' },
];

// Suficientes filas para forzar salto de pagina y repeticion de encabezado.
const FILAS_LARGAS: Fila[] = Array.from({ length: 90 }, (_, i) => ({
  entidad: `Entidad de prueba número ${i + 1} — con acentos áéíóú`,
  tipo: ['EPS', 'ARL', 'CONVENIO', 'PARTICULAR'][i % 4]!,
  cantidad: (i + 1) * 7,
  valor: (i + 1) * 123_456,
  part: Math.round((100 / 90) * 10) / 10,
  fecha: `2026-07-${String((i % 28) + 1).padStart(2, '0')}`,
}));

function makeDoc(getChart: () => HTMLElement | null): ExportDoc {
  return {
    fileBase: 'prueba-exportacion',
    title: 'Reportes de Facturación',
    subtitle: 'Clínica Neurofic — prueba automatizada',
    periodLabel: 'Julio de 2026',
    filters: [
      { label: 'Modo', value: 'Mes' },
      { label: 'Período', value: 'Julio de 2026' },
      { label: 'Día', value: 'Miércoles' },
      { label: 'Entidad', value: 'NUEVA EPS' },
    ],
    orientation: 'portrait',
    sections: [
      {
        kind: 'kpis',
        id: 'kpis',
        title: 'Indicadores del período',
        items: [
          { label: 'Facturación bruta', value: 93_320_500, format: 'currency', money: true },
          { label: 'Presupuesto', value: 100_000_000, format: 'currency', money: true },
          { label: 'Cumplimiento', value: 93.3, format: 'percent' },
          { label: 'Atenciones', value: 973, format: 'number' },
          { label: 'Ticket promedio', value: 95_910, format: 'currency', money: true },
        ],
      },
      {
        kind: 'chart',
        id: 'grafica',
        title: 'Facturado por día',
        getEl: getChart,
        fallbackTable: defineTable<Fila>({
          id: 'grafica',
          title: 'Facturado por día',
          columns: [
            { key: 'entidad', header: 'Entidad', accessor: (r) => r.entidad, width: 34 },
            { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor, format: 'currency', money: true },
          ],
          rows: FILAS,
        }),
      },
      defineTable<Fila>({
        id: 'entidades',
        title: 'Facturación por entidad',
        note: 'Se exportan todas las filas del filtro actual.',
        columns: [
          { key: 'entidad', header: 'Entidad', accessor: (r) => r.entidad, width: 34 },
          { key: 'tipo', header: 'Tipo', accessor: (r) => r.tipo },
          { key: 'fecha', header: 'Fecha', accessor: (r) => r.fecha, format: 'date' },
          { key: 'cantidad', header: 'Atenciones', accessor: (r) => r.cantidad, format: 'number' },
          { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor, format: 'currency', money: true },
          { key: 'part', header: 'Participación', accessor: (r) => r.part, format: 'percent' },
        ],
        rows: FILAS,
        totals: {
          label: 'TOTAL',
          values: {
            cantidad: FILAS.reduce((s, r) => s + r.cantidad, 0),
            valor: FILAS.reduce((s, r) => s + r.valor, 0),
            part: 100,
          },
        },
      }),
      defineTable<Fila>({
        id: 'largas',
        title: 'Tabla larga (salto de página)',
        columns: [
          { key: 'entidad', header: 'Entidad', accessor: (r) => r.entidad, width: 40 },
          { key: 'cantidad', header: 'Atenciones', accessor: (r) => r.cantidad, format: 'number' },
          { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor, format: 'currency', money: true },
        ],
        rows: FILAS_LARGAS,
        totals: {
          label: 'TOTAL',
          values: {
            cantidad: FILAS_LARGAS.reduce((s, r) => s + r.cantidad, 0),
            valor: FILAS_LARGAS.reduce((s, r) => s + r.valor, 0),
          },
        },
      }),
    ],
  };
}

function fullSelection(doc: ExportDoc): ExportSelection {
  const sections: Record<string, boolean> = {};
  const columns: Record<string, Record<string, boolean>> = {};
  for (const s of doc.sections) {
    sections[s.id] = true;
    const t = s.kind === 'table' ? s : s.kind === 'chart' ? s.fallbackTable : null;
    if (t) {
      const cols: Record<string, boolean> = {};
      for (const c of t.columns) cols[c.key] = true;
      columns[s.id] = cols;
    }
  }
  return { sections, columns, orientation: doc.orientation ?? 'portrait', format: 'pdf' };
}

declare global {
  interface Window {
    __exportTest: {
      run: (
        format: 'pdf' | 'excel' | 'csv',
        permitirValores: boolean,
        drop?: string[],
      ) => Promise<{ base64: string; size: number; warnings: string[] }>;
    };
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return btoa(bin);
}

function App(): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    window.__exportTest = {
      run: async (format, permitirValores, drop = []) => {
        const doc = makeDoc(() => ref.current);
        const sel = fullSelection(doc);
        for (const key of drop) {
          for (const cols of Object.values(sel.columns)) {
            if (key in cols) cols[key] = false;
          }
        }
        const filtered = applySelection(doc, sel, permitirValores);
        let blob: Blob;
        let warnings: string[] = [];
        if (format === 'pdf') {
          const { buildPdf } = await import('./export/buildPdf.js');
          const res = await buildPdf(filtered);
          blob = res.blob;
          warnings = res.warnings;
        } else if (format === 'excel') {
          const { buildExcel } = await import('./export/buildExcel.js');
          blob = await buildExcel(filtered);
        } else {
          const { buildCsv } = await import('./export/buildCsv.js');
          blob = buildCsv(filtered);
        }
        return { base64: await blobToBase64(blob), size: blob.size, warnings };
      },
    };
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h1>Export harness</h1>
      <div ref={ref} style={{ width: 560, height: 260 }} data-testid="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={FILAS}>
            <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
              {FILAS.map((_, i) => (
                <Cell key={i} fill={['#1e40af', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][i]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
