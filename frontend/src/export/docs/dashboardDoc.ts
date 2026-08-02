/**
 * Descriptor de exportacion del Dashboard.
 *
 * El periodo esta fijado al ano en curso: la pagina no tiene filtros.
 */

import type { EntidadRow, KpisResult, TendenciaRow } from '../../api/reportes.js';
import type { ExportDoc, ExportSection } from '../types.js';
import { defineTable } from '../types.js';
import { aggregateMix } from '../../components/widgets/ChartMixPagador.js';
import type { Slice } from '../../components/widgets/ChartMixPagador.js';

export interface DashboardDocInput {
  anio: number;
  mesActual: number;
  mesNombre: string;
  kpis: KpisResult | undefined;
  tendencia: TendenciaRow[];
  entidades: EntidadRow[];
  getChartTendencia: () => HTMLElement | null;
  getChartMix: () => HTMLElement | null;
}

export function buildDashboardDoc(i: DashboardDocInput): ExportDoc {
  const sections: ExportSection[] = [];

  if (i.kpis) {
    const k = i.kpis;
    sections.push({
      kind: 'kpis',
      id: 'hero',
      title: 'Indicadores acumulados del ano',
      items: [
        { label: 'Facturacion bruta', value: k.facturacion_bruta, format: 'currency', money: true },
        { label: 'Presupuesto', value: k.presupuesto, format: 'currency', money: true },
        { label: 'Cumplimiento', value: k.cumplimiento_pct, format: 'percent' },
        { label: 'Atenciones', value: k.atenciones, format: 'number' },
        { label: 'Ticket promedio', value: k.ticket_promedio, format: 'currency', money: true },
        { label: 'Promedio diario', value: k.promedio_diario, format: 'currency', money: true },
        { label: 'Proyeccion de cierre', value: k.proyeccion_cierre, format: 'currency', money: true },
        { label: 'Dias habiles restantes', value: k.dias_restantes, format: 'number' },
      ],
    });
  }

  const tendenciaTable = defineTable<TendenciaRow>({
    id: 'tendencia',
    title: 'Tendencia de facturacion',
    columns: [
      { key: 'mes', header: 'Mes', accessor: (r) => r.mes, width: 16 },
      { key: 'anio', header: 'Ano', accessor: (r) => r.anio, format: 'number' },
      { key: 'total', header: 'Facturado', accessor: (r) => r.total, format: 'currency', money: true },
      { key: 'presupuesto', header: 'Presupuesto', accessor: (r) => r.presupuesto, format: 'currency', money: true },
      {
        key: 'pct',
        header: 'Cumplimiento',
        accessor: (r) => (r.presupuesto > 0 ? (r.total / r.presupuesto) * 100 : null),
        format: 'percent',
      },
    ],
    rows: i.tendencia,
    totals: {
      label: 'TOTAL',
      values: {
        total: i.tendencia.reduce((s, r) => s + r.total, 0),
        presupuesto: i.tendencia.reduce((s, r) => s + r.presupuesto, 0),
      },
    },
  });

  if (i.tendencia.length > 0) {
    sections.push({
      kind: 'chart',
      id: 'chart-tendencia',
      title: 'Tendencia de facturacion',
      getEl: i.getChartTendencia,
      fallbackTable: tendenciaTable,
    });
  }

  if (i.entidades.length > 0) {
    const mix = aggregateMix(i.entidades);
    sections.push({
      kind: 'chart',
      id: 'mix-pagador',
      title: 'Mix de pagadores',
      getEl: i.getChartMix,
      fallbackTable: defineTable<Slice>({
        id: 'mix-pagador',
        title: 'Mix de pagadores',
        columns: [
          { key: 'label', header: 'Tipo', accessor: (r) => r.label, width: 26 },
          { key: 'grupo', header: 'Grupo', accessor: (r) => (r.group === 'caja' ? 'Flujo de caja' : 'Cobro a entidades') },
          { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor, format: 'currency', money: true },
          { key: 'pct', header: '% del total', accessor: (r) => r.pct, format: 'percent' },
        ],
        rows: mix.slices,
        totals: { label: 'TOTAL', values: { valor: mix.grandTotal, pct: 100 } },
      }),
    });

    const total = i.entidades.reduce((s, r) => s + r.valor_bruto, 0);
    sections.push(
      defineTable<EntidadRow>({
        id: 'entidades',
        title: 'Facturacion por entidad',
        columns: [
          { key: 'entidad', header: 'Entidad', accessor: (r) => r.entidad, width: 34 },
          { key: 'tipo', header: 'Tipo', accessor: (r) => (r.es_grupo ? `${r.tipo} (caja)` : r.tipo) },
          { key: 'cantidad', header: 'Atenciones', accessor: (r) => r.cantidad, format: 'number' },
          { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor_bruto, format: 'currency', money: true },
          { key: 'part', header: 'Participacion', accessor: (r) => r.participacion_pct, format: 'percent' },
        ],
        rows: i.entidades,
        totals: {
          label: 'TOTAL',
          values: {
            cantidad: i.entidades.reduce((s, r) => s + r.cantidad, 0),
            valor: total,
            part: 100,
          },
        },
      }),
    );
  }

  return {
    fileBase: 'dashboard',
    title: 'Panel de Control',
    subtitle: 'Clinica Neurofic',
    periodLabel: `Ano ${i.anio}`,
    filters: [
      { label: 'Periodo', value: `Enero a ${i.mesNombre} de ${i.anio}` },
    ],
    sections,
    orientation: 'portrait',
  };
}
