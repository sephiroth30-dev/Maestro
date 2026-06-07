import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import type { TendenciaRow } from '../../api/reportes.js';

interface Props {
  rows: TendenciaRow[];
}

function barColor(pct: number): string {
  if (pct >= 100) return '#22c55e';
  if (pct >= 80)  return '#f59e0b';
  return '#ef4444';
}

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

interface DataPoint { nombre: string; pct: number; total: number; presupuesto: number }
interface TooltipPayload { value: number; dataKey: string; payload: DataPoint }
interface CustomTooltipProps { active?: boolean; payload?: TooltipPayload[]; label?: string }

function CustomTooltip({ active, payload, label }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  if (!item) return null;

  const raw = item.payload;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-row" style={{ color: barColor(raw.pct), fontWeight: 700 }}>
        {raw.pct.toFixed(1)}% cumplimiento
      </p>
      <p className="chart-tooltip-row" style={{ color: '#64748b' }}>Facturado: {fmtMoney(raw.total)}</p>
      {raw.presupuesto > 0 && (
        <p className="chart-tooltip-row" style={{ color: '#94a3b8' }}>Meta: {fmtMoney(raw.presupuesto)}</p>
      )}
    </div>
  );
}

export default function ChartCumplimientoMensual({ rows }: Props): React.ReactElement {
  const data = rows.map((r) => {
    const pct = r.presupuesto > 0 ? (r.total / r.presupuesto) * 100 : 0;
    return {
      nombre:      r.mes.substring(0, 3),
      pct:         Math.round(pct * 10) / 10,
      total:       r.total,
      presupuesto: r.presupuesto,
    };
  });

  const maxPct = Math.max(...data.map((d) => d.pct), 100);
  const yMax = Math.ceil(maxPct / 10) * 10 + 10;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, yMax]}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={46}
        />
        <ReferenceLine
          y={100}
          stroke="#6366f1"
          strokeDasharray="6 3"
          strokeWidth={2}
          label={{ value: 'Meta 100%', position: 'insideTopRight', fontSize: 10, fill: '#6366f1', dy: -4 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="pct" maxBarSize={56} name="Cumplimiento">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={barColor(entry.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
