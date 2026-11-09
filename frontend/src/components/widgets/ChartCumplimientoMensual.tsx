import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import type { TendenciaRow } from '../../api/reportes.js';

const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

interface Props {
  rows: TendenciaRow[];
  /** Cómo se llama el año mostrado, para la leyenda y el tooltip. */
  label?: string;
  /** Otro año para dibujar junto a cada mes. */
  comparado?: { label: string; rows: TendenciaRow[] } | null;
}

const fmtShort = (n: number): string =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

/**
 * Cumplimiento por MES de un año, de enero a diciembre.
 *
 * El eje siempre tiene los doce meses, aunque el servidor devuelva solo los que
 * tienen datos o presupuesto: así dos años se pueden poner uno al lado del otro
 * mes a mes, y el año en curso muestra los meses que aún no llegan como vacíos
 * en vez de comprimir el gráfico.
 *
 * Con `comparado` se dibuja el mismo mes del otro año junto a cada barra. En ese
 * caso desaparece la barra de presupuesto: tres barras por mes serían ilegibles,
 * y el color de la barra del año ya dice si se cumplió la meta.
 */
export default function ChartCumplimientoMensual({ rows, label, comparado }: Props): React.ReactElement {
  const porMes = new Map(rows.map((r) => [r.mesIdx, r]));
  const compPorMes = new Map((comparado?.rows ?? []).map((r) => [r.mesIdx, r]));

  const data = MESES_CORTO.map((nombre, i) => {
    const r = porMes.get(i + 1);
    const venta = r?.total ?? 0;
    const presupuesto = r?.presupuesto ?? 0;
    return {
      mes: nombre,
      venta,
      estimado: presupuesto,
      comparado: compPorMes.get(i + 1)?.total ?? 0,
      pct: presupuesto > 0 ? Math.round((venta / presupuesto) * 1000) / 10 : 0,
    };
  });

  const nombreSerie = (clave: string): string =>
    clave === 'venta' ? (label ?? 'Facturado') : clave === 'comparado' ? (comparado?.label ?? 'Comparado') : 'Presupuesto';

  return (
    <ResponsiveContainer width="100%" height={comparado ? 260 : 220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barCategoryGap="25%" barGap={2}>
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickFormatter={fmtShort}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(val: number, name: string) => [fmtShort(val), nombreSerie(name)]}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <ReferenceLine y={0} stroke="#e2e8f0" />
        {comparado ? (
          // El año anterior a la izquierda: se lee primero y el actual cierra el par.
          <Bar dataKey="comparado" fill="#c7d2fe" radius={[2, 2, 0, 0]} name="comparado" />
        ) : (
          <Bar dataKey="estimado" fill="#e2e8f0" radius={[2, 2, 0, 0]} name="estimado" />
        )}
        <Bar dataKey="venta" fill="#3b82f6" radius={[2, 2, 0, 0]} name="venta">
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.pct >= 100 ? '#16a34a' : d.pct >= 80 ? '#f59e0b' : '#3b82f6'}
            />
          ))}
        </Bar>
        {comparado && (
          <Legend
            formatter={(v: string) => nombreSerie(v)}
            wrapperStyle={{ fontSize: 12, color: '#64748b' }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
