import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TendenciaRow } from '../../api/reportes.js';
import { formatCOP } from './KpiCard.js';

interface Props {
  rows: TendenciaRow[];
}

function barColor(pct: number): string {
  if (pct >= 100) return '#22c55e';
  if (pct >= 80)  return '#f59e0b';
  return '#ef4444';
}

interface TooltipPayload { name: string; value: number; color: string }
interface CustomTooltipProps { active?: boolean; payload?: TooltipPayload[]; label?: string }

function CustomTooltip({ active, payload, label }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const facturado  = payload.find((p) => p.name === 'Facturado');
  const presupuesto = payload.find((p) => p.name === 'Presupuesto');
  const pct = facturado && presupuesto && presupuesto.value > 0
    ? ((facturado.value / presupuesto.value) * 100).toFixed(1) : null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {facturado  && <p className="chart-tooltip-row" style={{ color: facturado.color }}>Facturado: {formatCOP(facturado.value)}</p>}
      {presupuesto && <p className="chart-tooltip-row" style={{ color: presupuesto.color }}>Presupuesto: {formatCOP(presupuesto.value)}</p>}
      {pct && <p className="chart-tooltip-row chart-tooltip-pct">Cumplimiento: {pct}%</p>}
    </div>
  );
}

export default function ChartCumplimientoMensual({ rows }: Props): React.ReactElement {
  const data = rows.map((r) => {
    const pct = r.presupuesto > 0 ? (r.total / r.presupuesto) * 100 : 0;
    return {
      nombre: r.mes.substring(0, 3),
      Facturado: r.total,
      Presupuesto: r.presupuesto,
      pct,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v: number) =>
            v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M`
            : v >= 1_000   ? `$${(v / 1_000).toFixed(0)}K`
            : `$${v}`
          }
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
        <Bar dataKey="Facturado" maxBarSize={56}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={barColor(entry.pct)} />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="Presupuesto"
          stroke="#94a3b8"
          strokeDasharray="6 3"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
