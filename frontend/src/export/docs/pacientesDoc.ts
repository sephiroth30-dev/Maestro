/**
 * Descriptores de exportacion de Pacientes y del detalle de atenciones.
 */

import type { DetalleAtencionRow, PacientesResult, DimensionRow, RetencionRow } from '../../api/pacientes.js';
import type { ExportDoc, ExportFilterChip, ExportSection } from '../types.js';
import { defineTable } from '../types.js';

type ServicioRow = PacientesResult['por_servicio'][number];
type FrecuenciaRow = PacientesResult['frecuencia'][number];
type ConectorRow = PacientesResult['cobertura']['por_conector'][number];

export interface PacientesDocInput {
  periodLabel: string;
  filters: ExportFilterChip[];
  data: PacientesResult;
  getChartFrecuencia: () => HTMLElement | null;
  getChartRetencion: () => HTMLElement | null;
}

export function buildPacientesDoc(i: PacientesDocInput): ExportDoc {
  const { cobertura, resumen } = i.data;
  const sections: ExportSection[] = [];

  const aviso =
    `Calculado sobre ${cobertura.filas_con_paciente.toLocaleString('es-CO')} de ` +
    `${cobertura.filas.toLocaleString('es-CO')} registros (${cobertura.cobertura_pct}%), ` +
    'que son los que traen identificación del paciente.';

  sections.push({
    kind: 'kpis',
    id: 'resumen',
    title: 'Resumen de pacientes',
    note: aviso,
    items: [
      { label: 'Pacientes únicos', value: resumen.pacientes_unicos, format: 'number' },
      { label: 'Pacientes nuevos', value: resumen.nuevos, format: 'number' },
      { label: 'Pacientes recurrentes', value: resumen.recurrentes, format: 'number' },
      { label: '% nuevos', value: resumen.nuevos_pct, format: 'percent' },
      { label: 'Visitas (fechas distintas)', value: resumen.visitas_unicas, format: 'number' },
      { label: 'Atenciones por paciente', value: resumen.promedio_atenciones, format: 'number' },
      { label: 'Visitas por paciente', value: resumen.promedio_visitas, format: 'number' },
      { label: 'En más de un pagador', value: i.data.pacientes_multi_pagador, format: 'number' },
    ],
  });

  sections.push({
    kind: 'kpis',
    id: 'cobertura',
    title: 'Cobertura de identificación',
    note:
      resumen.historia_desde
        ? `"Nuevo" significa sin registros anteriores desde ${resumen.historia_desde}, no que nunca se haya atendido en la clinica.`
        : undefined,
    items: [
      { label: 'Registros del período', value: cobertura.filas, format: 'number' },
      { label: 'Con identificación', value: cobertura.filas_con_paciente, format: 'number' },
      { label: 'Cobertura', value: cobertura.cobertura_pct, format: 'percent' },
      { label: 'Con documento', value: cobertura.cobertura_documento_pct, format: 'percent' },
      { label: 'Valor sin identificar', value: cobertura.valor_sin_paciente, format: 'currency', money: true },
    ],
  });

  if (cobertura.por_conector.length > 0) {
    sections.push(
      defineTable<ConectorRow>({
        id: 'cobertura-fuente',
        title: 'Cobertura por fuente',
        note: 'Una fuente al 0% es un Sheet cuya cabecera no tiene columna de paciente.',
        columns: [
          { key: 'fuente', header: 'Fuente', accessor: (r) => r.conector_nombre, width: 30 },
          { key: 'filas', header: 'Registros', accessor: (r) => r.filas, format: 'number' },
          { key: 'con', header: 'Con paciente', accessor: (r) => r.filas_con_paciente, format: 'number' },
          { key: 'pct', header: 'Cobertura', accessor: (r) => r.cobertura_pct, format: 'percent' },
        ],
        rows: cobertura.por_conector,
      }),
    );
  }

  const frecuenciaTable = defineTable<FrecuenciaRow>({
    id: 'frecuencia',
    title: 'Distribución de frecuencia',
    note: 'Los tramos cuentan visitas (fechas distintas), no atenciones.',
    columns: [
      { key: 'bucket', header: 'Visitas en el período', accessor: (r) => r.bucket, width: 22 },
      { key: 'pacientes', header: 'Pacientes', accessor: (r) => r.pacientes, format: 'number' },
      { key: 'pct', header: '% del total', accessor: (r) => r.pct, format: 'percent' },
    ],
    rows: i.data.frecuencia,
    totals: { label: 'TOTAL', values: { pacientes: resumen.pacientes_unicos, pct: 100 } },
  });

  sections.push({
    kind: 'chart',
    id: 'chart-frecuencia',
    title: 'Distribución de frecuencia',
    getEl: i.getChartFrecuencia,
    fallbackTable: frecuenciaTable,
  });

  sections.push(
    defineTable<DimensionRow>({
      id: 'por-pagador',
      title: 'Pacientes por tipo de pagador',
      // El aviso importa: sin el, alguien suma la columna y no le da el total.
      note: 'Un paciente atendido por dos pagadores se cuenta en ambos, así que estas cifras no suman el total de pacientes únicos.',
      columns: [
        { key: 'tipo', header: 'Tipo de pagador', accessor: (r) => r.nombre, width: 24 },
        { key: 'pacientes', header: 'Pacientes', accessor: (r) => r.pacientes, format: 'number' },
        { key: 'atenciones', header: 'Atenciones', accessor: (r) => r.atenciones, format: 'number' },
        { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor, format: 'currency', money: true },
      ],
      rows: i.data.por_pagador,
    }),
  );

  sections.push(
    defineTable<ServicioRow>({
      id: 'por-servicio',
      title: 'Pacientes por servicio',
      note: 'Mismo criterio: un paciente con dos servicios aparece en ambos.',
      columns: [
        { key: 'servicio', header: 'Servicio', accessor: (r) => r.nombre, width: 32 },
        { key: 'pacientes', header: 'Pacientes', accessor: (r) => r.pacientes, format: 'number' },
        { key: 'atenciones', header: 'Atenciones', accessor: (r) => r.atenciones, format: 'number' },
        { key: 'app', header: 'Atenciones por paciente', accessor: (r) => r.atenciones_por_paciente, format: 'number' },
        { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor, format: 'currency', money: true },
      ],
      rows: i.data.por_servicio,
    }),
  );

  if (i.data.retencion.length > 0) {
    sections.push({
      kind: 'chart',
      id: 'chart-retencion',
      title: 'Retención mes a mes',
      getEl: i.getChartRetencion,
      fallbackTable: defineTable<RetencionRow>({
        id: 'chart-retencion',
        title: 'Retención mes a mes',
        note: 'Retenidos = pacientes del mes que vuelven al mes siguiente. El último mes queda vacío porque su mes siguiente aún no termina.',
        columns: [
          { key: 'mes', header: 'Mes', accessor: (r) => r.label, width: 14 },
          { key: 'pacientes', header: 'Pacientes', accessor: (r) => r.pacientes, format: 'number' },
          { key: 'retenidos', header: 'Vuelven al mes siguiente', accessor: (r) => r.retenidos, format: 'number' },
          { key: 'pct', header: 'Retención', accessor: (r) => r.retencion_pct, format: 'percent' },
        ],
        rows: i.data.retencion,
      }),
    });
  }

  return {
    fileBase: 'pacientes',
    title: 'Analítica de Pacientes',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: i.filters,
    sections,
    orientation: 'portrait',
  };
}

// ─── Detalle de atenciones ────────────────────────────────────────────────────

export interface DetalleDocInput {
  periodLabel: string;
  filters: ExportFilterChip[];
  rows: DetalleAtencionRow[];
  total: number;
  truncado: boolean;
}

export function buildDetalleDoc(i: DetalleDocInput): ExportDoc {
  return {
    fileBase: 'detalle-atenciones',
    title: 'Detalle de Atenciones',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: i.filters,
    orientation: 'landscape',
    sections: [
      defineTable<DetalleAtencionRow>({
        id: 'detalle',
        title: 'Atenciones',
        note: i.truncado
          ? `Se exportan ${i.rows.length.toLocaleString('es-CO')} de ${i.total.toLocaleString('es-CO')} atenciones. Acota el período para incluir el resto.`
          : `${i.rows.length.toLocaleString('es-CO')} atenciones.`,
        columns: [
          { key: 'fecha', header: 'Fecha', accessor: (r) => r.fecha, format: 'date', width: 12 },
          { key: 'paciente', header: 'Paciente', accessor: (r) => r.paciente ?? '', width: 30 },
          { key: 'documento', header: 'Documento', accessor: (r) => r.documento ?? '', width: 16 },
          { key: 'entidad', header: 'Entidad', accessor: (r) => r.entidad ?? '', width: 26 },
          { key: 'tipo', header: 'Tipo', accessor: (r) => r.entidad_tipo ?? '', width: 12 },
          { key: 'profesional', header: 'Profesional', accessor: (r) => r.profesional ?? '', width: 26 },
          { key: 'servicio', header: 'Servicio', accessor: (r) => r.servicio ?? 'Sin clasificar', width: 24 },
          { key: 'descripción', header: 'Descripción en el Sheet', accessor: (r) => r.descripcion, width: 40, hidden: true },
          { key: 'autorización', header: 'Autorización', accessor: (r) => r.autorizacion ?? '', width: 18, hidden: true },
          { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor_bruto, format: 'currency', money: true },
        ],
        rows: i.rows,
        totals: {
          label: 'TOTAL',
          values: { valor: i.rows.reduce((s, r) => s + r.valor_bruto, 0) },
        },
      }),
    ],
  };
}
