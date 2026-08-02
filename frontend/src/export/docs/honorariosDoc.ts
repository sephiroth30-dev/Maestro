/**
 * Descriptor de exportacion de la pagina Honorarios.
 *
 * Los pivotes salen de `datos_snapshot` de cada liquidacion, NO del hook
 * `useHonorarios`: ese hook es solo por mes y con "Período parcial" activo
 * produciria un archivo que no coincide con lo que se ve en pantalla.
 *
 * El par montos / cantidades existe justamente para el preset "Vista médicos":
 * al ocultar los valores desaparece el pivote de montos y queda el de
 * cantidades, que es el que le sirve al medico.
 */

import type { LiquidacionRow } from '../../api/liquidaciones.js';
import type { ContribucionRow, HonorariosCeldas, HonorariosProfesionalRow } from '../../api/honorarios.js';
import type { ExportColumn, ExportDoc, ExportFilterChip, ExportSection } from '../types.js';
import { defineTable } from '../types.js';

export interface CatDef {
  key: keyof Omit<HonorariosProfesionalRow, 'profesional_id' | 'nombre' | 'total' | 'sin_regla'>;
  label: string;
}

/** Fila plana de una categoria dentro de una liquidacion. */
interface DetalleFila {
  profesional: string;
  categoria: string;
  cantidad: number;
  monto: number;
}

export interface HonorariosDocInput {
  periodLabel: string;
  filters: ExportFilterChip[];
  cats: CatDef[];
  rows: LiquidacionRow[];
  contribucion: ContribucionRow[];
  /** profesional_display -> honorario acumulado, para el margen. */
  honorariosPorMedico: Map<string, { amount: number; simulado: boolean }>;
  kpis: { acumulado: number; aprobado: number; pagado: number };
}

const celda = (r: LiquidacionRow, k: CatDef['key']): HonorariosCeldas =>
  (r.datos_snapshot?.[k] as HonorariosCeldas | undefined) ?? { monto: 0, cnt: 0 };

export function buildHonorariosDoc(i: HonorariosDocInput): ExportDoc {
  const sections: ExportSection[] = [];
  const reales = i.rows.filter((r) => !r.es_simulado);

  // ── Resumen ────────────────────────────────────────────────────────────────
  sections.push({
    kind: 'kpis',
    id: 'resumen',
    title: 'Resumen de honorarios',
    note: 'Los montos excluyen a los profesionales de nomina, cuya liquidacion es simulada.',
    items: [
      { label: 'Acumulado', value: i.kpis.acumulado, format: 'currency', money: true },
      { label: 'Aprobado', value: i.kpis.aprobado, format: 'currency', money: true },
      { label: 'Pagado', value: i.kpis.pagado, format: 'currency', money: true },
      { label: 'Profesionales', value: i.rows.length, format: 'number' },
      { label: 'En nomina (simulados)', value: i.rows.length - reales.length, format: 'number' },
    ],
  });

  // ── Liquidaciones ──────────────────────────────────────────────────────────
  if (i.rows.length > 0) {
    sections.push(
      defineTable<LiquidacionRow>({
        id: 'liquidaciones',
        title: 'Liquidaciones',
        columns: [
          { key: 'profesional', header: 'Profesional', accessor: (r) => r.profesional_display, width: 30 },
          { key: 'especialidad', header: 'Especialidad', accessor: (r) => r.especialidad ?? '' },
          { key: 'nomina', header: 'Nómina', accessor: (r) => (r.es_simulado ? 'Si' : 'No') },
          { key: 'desde', header: 'Desde', accessor: (r) => r.fecha_desde, format: 'date' },
          { key: 'hasta', header: 'Hasta', accessor: (r) => r.fecha_hasta, format: 'date' },
          { key: 'total', header: 'Total honorario', accessor: (r) => r.monto_total, format: 'currency', money: true },
          { key: 'estado', header: 'Estado', accessor: (r) => r.estado },
          { key: 'aprobado_por', header: 'Aprobado por', accessor: (r) => r.aprobado_por_nombre ?? '', hidden: true },
          { key: 'aprobado_en', header: 'Aprobado en', accessor: (r) => r.aprobado_en ?? '', format: 'datetime', hidden: true },
          { key: 'pagado_por', header: 'Pagado por', accessor: (r) => r.pagado_por_nombre ?? '', hidden: true },
          { key: 'pagado_en', header: 'Pagado en', accessor: (r) => r.pagado_en ?? '', format: 'datetime', hidden: true },
          { key: 'notas', header: 'Notas', accessor: (r) => r.notas ?? '', width: 40, hidden: true },
        ],
        rows: i.rows,
        totals: {
          label: 'TOTAL (sin nomina)',
          values: { total: reales.reduce((s, r) => s + r.monto_total, 0) },
        },
      }),
    );

    // ── Pivote de montos ─────────────────────────────────────────────────────
    const colsMonto: ExportColumn<LiquidacionRow>[] = [
      { key: 'profesional', header: 'Profesional', accessor: (r) => r.profesional_display, width: 28 },
      ...i.cats.map((c): ExportColumn<LiquidacionRow> => ({
        key: `m_${c.key}`,
        header: c.label,
        accessor: (r) => celda(r, c.key).monto,
        format: 'currency',
        money: true,
      })),
      {
        key: 'm_sin_regla',
        header: 'Sin regla',
        accessor: (r) => r.datos_snapshot?.sin_regla?.monto ?? 0,
        format: 'currency',
        money: true,
      },
      { key: 'm_total', header: 'Total', accessor: (r) => r.monto_total, format: 'currency', money: true },
    ];
    sections.push(
      defineTable<LiquidacionRow>({
        id: 'pivot-montos',
        title: 'Honorarios por categoría (montos)',
        columns: colsMonto,
        rows: i.rows,
        totals: {
          label: 'TOTAL',
          values: Object.fromEntries([
            ...i.cats.map((c) => [`m_${c.key}`, i.rows.reduce((s, r) => s + celda(r, c.key).monto, 0)]),
            ['m_sin_regla', i.rows.reduce((s, r) => s + (r.datos_snapshot?.sin_regla?.monto ?? 0), 0)],
            ['m_total', i.rows.reduce((s, r) => s + r.monto_total, 0)],
          ]),
        },
      }),
    );

    // ── Pivote de cantidades (sin una sola columna monetaria) ────────────────
    const colsCnt: ExportColumn<LiquidacionRow>[] = [
      { key: 'profesional', header: 'Profesional', accessor: (r) => r.profesional_display, width: 28 },
      ...i.cats.map((c): ExportColumn<LiquidacionRow> => ({
        key: `c_${c.key}`,
        header: c.label,
        accessor: (r) => celda(r, c.key).cnt,
        format: 'number',
      })),
      {
        key: 'c_sin_regla',
        header: 'Sin regla',
        accessor: (r) => r.datos_snapshot?.sin_regla?.cnt ?? 0,
        format: 'number',
      },
      {
        key: 'c_total',
        header: 'Total procedimientos',
        accessor: (r) =>
          i.cats.reduce((s, c) => s + celda(r, c.key).cnt, 0) + (r.datos_snapshot?.sin_regla?.cnt ?? 0),
        format: 'number',
      },
    ];
    sections.push(
      defineTable<LiquidacionRow>({
        id: 'pivot-cantidades',
        title: 'Procedimientos por categoría (cantidades)',
        note: 'Solo cantidades, sin información económica.',
        columns: colsCnt,
        rows: i.rows,
        totals: {
          label: 'TOTAL',
          values: Object.fromEntries([
            ...i.cats.map((c) => [`c_${c.key}`, i.rows.reduce((s, r) => s + celda(r, c.key).cnt, 0)]),
            ['c_sin_regla', i.rows.reduce((s, r) => s + (r.datos_snapshot?.sin_regla?.cnt ?? 0), 0)],
            [
              'c_total',
              i.rows.reduce(
                (s, r) =>
                  s + i.cats.reduce((a, c) => a + celda(r, c.key).cnt, 0) + (r.datos_snapshot?.sin_regla?.cnt ?? 0),
                0,
              ),
            ],
          ]),
        },
      }),
    );

    // ── Detalle largo: una fila por celda con valor ──────────────────────────
    const detalle: DetalleFila[] = [];
    for (const r of i.rows) {
      for (const c of i.cats) {
        const cel = celda(r, c.key);
        if (cel.cnt === 0 && cel.monto === 0) continue;
        detalle.push({ profesional: r.profesional_display, categoria: c.label, cantidad: cel.cnt, monto: cel.monto });
      }
      const sr = r.datos_snapshot?.sin_regla;
      if (sr && (sr.cnt > 0 || sr.monto > 0)) {
        detalle.push({ profesional: r.profesional_display, categoria: 'Sin regla (facturado)', cantidad: sr.cnt, monto: sr.monto });
      }
    }
    if (detalle.length > 0) {
      sections.push(
        defineTable<DetalleFila>({
          id: 'detalle-categorias',
          title: 'Detalle por profesional y categoría',
          columns: [
            { key: 'profesional', header: 'Profesional', accessor: (r) => r.profesional, width: 30 },
            { key: 'categoría', header: 'Categoría', accessor: (r) => r.categoria, width: 24 },
            { key: 'cantidad', header: 'Cantidad', accessor: (r) => r.cantidad, format: 'number' },
            { key: 'monto', header: 'Monto', accessor: (r) => r.monto, format: 'currency', money: true },
          ],
          rows: detalle,
          totals: {
            label: 'TOTAL',
            values: {
              cantidad: detalle.reduce((s, r) => s + r.cantidad, 0),
              monto: detalle.reduce((s, r) => s + r.monto, 0),
            },
          },
        }),
      );
    }
  }

  // ── Contribucion por medico ────────────────────────────────────────────────
  if (i.contribucion.length > 0) {
    const hon = (r: ContribucionRow): number => i.honorariosPorMedico.get(r.profesional_nombre)?.amount ?? 0;
    const margen = (r: ContribucionRow): number => r.total_bruto - hon(r);

    sections.push(
      defineTable<ContribucionRow>({
        id: 'contribucion',
        title: 'Facturación generada por medico',
        columns: [
          { key: 'medico', header: 'Médico', accessor: (r) => r.profesional_nombre, width: 30 },
          { key: 'entidad', header: 'Facturado EPS/ARL', accessor: (r) => r.total_entidad, format: 'currency', money: true },
          { key: 'particular', header: 'Facturado particular', accessor: (r) => r.total_particular, format: 'currency', money: true },
          { key: 'total', header: 'Total facturado', accessor: (r) => r.total_bruto, format: 'currency', money: true },
          { key: 'hon', header: 'Honorarios a pagar', accessor: hon, format: 'currency', money: true },
          { key: 'margen', header: 'Margen clínica', accessor: margen, format: 'currency', money: true },
          {
            key: 'margen_pct',
            header: 'Margen %',
            accessor: (r) => (r.total_bruto > 0 ? (margen(r) / r.total_bruto) * 100 : null),
            format: 'percent',
            money: true,
          },
        ],
        rows: i.contribucion,
        totals: {
          label: 'TOTAL',
          values: {
            entidad: i.contribucion.reduce((s, r) => s + r.total_entidad, 0),
            particular: i.contribucion.reduce((s, r) => s + r.total_particular, 0),
            total: i.contribucion.reduce((s, r) => s + r.total_bruto, 0),
            hon: i.contribucion.reduce((s, r) => s + hon(r), 0),
            margen: i.contribucion.reduce((s, r) => s + margen(r), 0),
          },
        },
      }),
    );
  }

  return {
    fileBase: 'honorarios',
    title: 'Honorarios Médicos',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: i.filters,
    sections,
    // Los pivotes tienen 12 columnas: vertical no alcanza.
    orientation: 'landscape',
  };
}
