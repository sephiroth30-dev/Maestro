/**
 * Descriptor de exportacion de la pagina Reportes.
 *
 * Todo sale de datos que React Query ya tiene en cache; no dispara peticiones.
 * Importante: la tabla de entidades exporta `tableRows` (el resultado de los
 * filtros cliente por tipo/grupo/entidad), no las filas crudas de la API, y
 * exporta TODAS las filas, no solo las 10 que la tabla muestra por defecto.
 */

import type {
  DiaSemanaRow,
  EntidadRow,
  KpisResult,
  SemanaRow,
  ServicioRow,
  ServiciosResult,
  TendenciaRow,
} from '../../api/reportes.js';
import type { ExportDoc, ExportFilterChip, ExportSection } from '../types.js';
import { defineTable } from '../types.js';
import { aggregateMix } from '../../components/widgets/ChartMixPagador.js';
import type { Slice } from '../../components/widgets/ChartMixPagador.js';

export interface ReportesDocInput {
  periodLabel: string;
  filters: ExportFilterChip[];
  kpis: KpisResult | undefined;
  flujoPct: number | null;
  flujoTarget: number;
  dias: DiaSemanaRow[];
  semanas: SemanaRow[];
  tendenciaAnio: TendenciaRow[];
  /** Filas ya filtradas por tipo/grupo/entidad: lo que muestra la tabla. */
  entidades: EntidadRow[];
  /** Filas sin filtros cliente: es lo que alimenta el donut en pantalla. */
  entidadesAll: EntidadRow[];
  servicios: ServiciosResult | undefined;
  isAnioMode: boolean;
  isRangoMode: boolean;
  getChartCumplimiento: () => HTMLElement | null;
  getChartMix: () => HTMLElement | null;
}

export function buildReportesDoc(i: ReportesDocInput): ExportDoc {
  const sections: ExportSection[] = [];

  // ── Indicadores ────────────────────────────────────────────────────────────
  if (i.kpis) {
    const k = i.kpis;
    sections.push({
      kind: 'kpis',
      id: 'kpis',
      title: 'Indicadores del período',
      items: [
        { label: 'Facturación bruta', value: k.facturacion_bruta, format: 'currency', money: true },
        { label: 'Presupuesto', value: k.presupuesto, format: 'currency', money: true },
        { label: 'Cumplimiento', value: k.cumplimiento_pct, format: 'percent' },
        { label: 'Atenciones', value: k.atenciones, format: 'number' },
        { label: 'Ticket promedio', value: k.ticket_promedio, format: 'currency', money: true },
        { label: 'Promedio diario', value: k.promedio_diario, format: 'currency', money: true },
        { label: 'Proyección de cierre', value: k.proyeccion_cierre, format: 'currency', money: true },
        { label: 'Proyección cumplimiento', value: k.proyeccion_cumplimiento_pct, format: 'percent' },
        { label: 'Dias transcurridos', value: k.dias_transcurridos, format: 'number' },
        { label: 'Dias restantes', value: k.dias_restantes, format: 'number' },
        { label: 'Semanas en meta', value: `${k.semanas_en_meta} de ${k.semanas_total}` },
      ],
    });
  }

  // ── Flujo de caja ──────────────────────────────────────────────────────────
  if (i.flujoPct !== null) {
    sections.push({
      kind: 'kpis',
      id: 'flujo-caja',
      title: 'Flujo de caja',
      note: `Meta: ${i.flujoTarget}% del ingreso del período entre particulares y entidades de pago inmediato.`,
      items: [
        { label: 'Participación flujo de caja', value: i.flujoPct, format: 'percent' },
        { label: 'Meta', value: i.flujoTarget, format: 'percent' },
        { label: 'Brecha (puntos)', value: Math.round((i.flujoPct - i.flujoTarget) * 10) / 10, format: 'number' },
      ],
    });
  }

  // ── Facturado por dia de la semana ─────────────────────────────────────────
  if (i.dias.length > 0) {
    sections.push(
      defineTable<DiaSemanaRow>({
        id: 'dias',
        title: 'Facturado por dia de la semana',
        columns: [
          { key: 'dia', header: 'Dia', accessor: (r) => r.dia, width: 16 },
          { key: 'atenciones', header: 'Atenciones', accessor: (r) => r.atenciones, format: 'number' },
          { key: 'total', header: 'Total facturado', accessor: (r) => r.total, format: 'currency', money: true },
          { key: 'promedio', header: 'Promedio', accessor: (r) => r.promedio, format: 'currency', money: true },
        ],
        rows: i.dias,
        totals: {
          label: 'TOTAL',
          values: {
            atenciones: i.dias.reduce((s, r) => s + r.atenciones, 0),
            total: i.dias.reduce((s, r) => s + r.total, 0),
          },
        },
      }),
    );
  }

  // ── Cumplimiento ───────────────────────────────────────────────────────────
  // Debe seguir la MISMA variante que la gráfica en pantalla (mensual en modo
  // ano, diaria en modo rango, semanal en modo mes); si no, la imagen y la
  // tabla de detalle contarian cosas distintas.
  const cumplimientoTable = i.isRangoMode
    ? defineTable<DiaSemanaRow>({
        id: 'cumplimiento',
        title: 'Cumplimiento diario',
        columns: [
          { key: 'dia', header: 'Dia', accessor: (r) => r.dia, width: 16 },
          { key: 'atenciones', header: 'Atenciones', accessor: (r) => r.atenciones, format: 'number' },
          { key: 'total', header: 'Facturado', accessor: (r) => r.total, format: 'currency', money: true },
          { key: 'promedio', header: 'Promedio', accessor: (r) => r.promedio, format: 'currency', money: true },
        ],
        rows: i.dias,
        totals: {
          label: 'TOTAL',
          values: {
            atenciones: i.dias.reduce((s, r) => s + r.atenciones, 0),
            total: i.dias.reduce((s, r) => s + r.total, 0),
          },
        },
      })
    : i.isAnioMode
    ? defineTable<TendenciaRow>({
        id: 'cumplimiento',
        title: 'Cumplimiento mensual',
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
        rows: i.tendenciaAnio,
        totals: {
          label: 'TOTAL',
          values: {
            total: i.tendenciaAnio.reduce((s, r) => s + r.total, 0),
            presupuesto: i.tendenciaAnio.reduce((s, r) => s + r.presupuesto, 0),
          },
        },
      })
    : defineTable<SemanaRow>({
        id: 'cumplimiento',
        title: 'Cumplimiento semanal',
        columns: [
          { key: 'número', header: 'Semana', accessor: (r) => r.numero, format: 'number', width: 12 },
          { key: 'ini', header: 'Desde', accessor: (r) => r.fecha_ini, format: 'date' },
          { key: 'fin', header: 'Hasta', accessor: (r) => r.fecha_fin, format: 'date' },
          { key: 'estimado', header: 'Estimado', accessor: (r) => r.estimado, format: 'currency', money: true },
          { key: 'venta', header: 'Venta', accessor: (r) => r.venta, format: 'currency', money: true },
          { key: 'pct', header: 'Cumplimiento', accessor: (r) => r.cumplimiento_pct, format: 'percent' },
          { key: 'estado', header: 'Estado', accessor: (r) => r.estado },
        ],
        rows: i.semanas,
        totals: {
          label: 'TOTAL',
          values: {
            estimado: i.semanas.reduce((s, r) => s + r.estimado, 0),
            venta: i.semanas.reduce((s, r) => s + r.venta, 0),
          },
        },
      });

  if (cumplimientoTable.rows.length > 0) {
    sections.push({
      kind: 'chart',
      id: 'chart-cumplimiento',
      title: i.isRangoMode
        ? 'Cumplimiento diario'
        : i.isAnioMode
          ? 'Cumplimiento mensual'
          : 'Cumplimiento semanal',
      getEl: i.getChartCumplimiento,
      fallbackTable: cumplimientoTable,
    });
  }

  // ── Mix pagador ────────────────────────────────────────────────────────────
  if (i.entidadesAll.length > 0) {
    // aggregateMix sobre las filas SIN filtrar: es exactamente lo que dibuja el
    // donut. Usar las filtradas produciria una imagen y una tabla que se
    // contradicen (el donut completo junto a una sola fila al 100 %).
    const mix = aggregateMix(i.entidadesAll);
    sections.push({
      kind: 'chart',
      id: 'mix-pagador',
      title: 'Mix por tipo de pagador',
      getEl: i.getChartMix,
      fallbackTable: defineTable<Slice>({
        id: 'mix-pagador',
        title: 'Mix por tipo de pagador',
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
  }

  // ── Facturación por entidad ────────────────────────────────────────────────
  const valorFiltrado = i.entidades.reduce((s, r) => s + r.valor_bruto, 0);
  const valorPeríodo = i.entidadesAll.reduce((s, r) => s + r.valor_bruto, 0);
  if (i.entidades.length > 0) {
    sections.push(
      defineTable<EntidadRow>({
        id: 'entidades',
        title: 'Facturación por entidad',
        note: `Se exportan las ${i.entidades.length} filas del filtro actual, no solo las visibles en pantalla.`,
        columns: [
          { key: 'entidad', header: 'Entidad', accessor: (r) => r.entidad, width: 34 },
          { key: 'tipo', header: 'Tipo', accessor: (r) => (r.es_grupo ? `${r.tipo} (caja)` : r.tipo) },
          { key: 'cantidad', header: 'Atenciones', accessor: (r) => r.cantidad, format: 'number' },
          { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor_bruto, format: 'currency', money: true },
          { key: 'part', header: 'Participación', accessor: (r) => r.participacion_pct, format: 'percent' },
        ],
        rows: i.entidades,
        totals: {
          label: 'TOTAL',
          values: {
            cantidad: i.entidades.reduce((s, r) => s + r.cantidad, 0),
            valor: valorFiltrado,
            // Recalculado sobre el total del período: sumar los porcentajes ya
            // redondeados de la API da 100,3 % con muchas entidades.
            part: valorPeríodo > 0 ? (valorFiltrado / valorPeríodo) * 100 : null,
          },
        },
      }),
    );
  }

  // ── Mix por servicio ───────────────────────────────────────────────────────
  const svc = i.servicios;
  if (svc && svc.rows.length > 0) {
    const totalValor = svc.rows.reduce((s, r) => s + r.valor_bruto, 0) + svc.valor_sin_clasificar;
    sections.push(
      defineTable<ServicioRow>({
        id: 'servicios',
        title: 'Mix por servicio',
        note:
          svc.sin_clasificar > 0
            ? `Ademas hay ${svc.sin_clasificar} registros sin clasificar por ${svc.valor_sin_clasificar.toLocaleString('es-CO')} COP.`
            : undefined,
        columns: [
          { key: 'nombre', header: 'Servicio', accessor: (r) => r.nombre, width: 34 },
          { key: 'conteo', header: 'Modo conteo', accessor: (r) => (r.tipo_conteo === 'sesion' ? 'Sesion' : 'Unidad') },
          { key: 'cantidad', header: 'Cantidad', accessor: (r) => r.cantidad, format: 'number' },
          { key: 'valor', header: 'Valor bruto', accessor: (r) => r.valor_bruto, format: 'currency', money: true },
          {
            key: 'promedio',
            header: 'Ticket promedio',
            accessor: (r) => (r.cantidad > 0 ? r.valor_bruto / r.cantidad : null),
            format: 'currency',
            money: true,
          },
          {
            key: 'pct',
            header: '% del valor',
            accessor: (r) => (totalValor > 0 ? (r.valor_bruto / totalValor) * 100 : null),
            format: 'percent',
          },
        ],
        rows: svc.rows,
        totals: {
          label: 'TOTAL',
          values: {
            cantidad: svc.rows.reduce((s, r) => s + r.cantidad, 0),
            valor: svc.rows.reduce((s, r) => s + r.valor_bruto, 0),
          },
        },
      }),
    );
  }

  return {
    fileBase: 'reportes-facturacion',
    title: 'Reportes de Facturación',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: i.filters,
    sections,
    orientation: 'portrait',
  };
}
