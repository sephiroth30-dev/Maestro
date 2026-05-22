import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { EntidadRow } from '../../api/reportes.js';
import { formatCOP } from './KpiCard.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChartMixPagadorProps {
  rows: EntidadRow[];
  total: number;
}

// ─── Color map by tipo ────────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, string> = {
  EPS:        '#3b82f6', // blue
  PARTICULAR: '#10b981', // emerald
  CONVENIO:   '#a855f7', // purple
  ARL:        '#f59e0b', // amber
  OTRO:       '#94a3b8', // gray
};

function tipoColor(tipo: string): string {
  return TIPO_COLORS[tipo] ?? TIPO_COLORS['OTRO']!;
}

// ─── Aggregated by tipo ───────────────────────────────────────────────────────

interface TipoSlice {
  tipo: string;
  valor: number;
  pct: number;
}

function aggregateByTipo(rows: EntidadRow[], total: number): TipoSlice[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.tipo, (map.get(r.tipo) ?? 0) + r.valor_bruto);
  }
  return Array.from(map.entries())
    .map(([tipo, valor]) => ({
      tipo,
      valor,
      pct: total > 0 ? Math.round((valor / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: TipoSlice;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const slice = payload[0];
  if (!slice) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{slice.payload.tipo}</p>
      <p className="chart-tooltip-row" style={{ color: tipoColor(slice.payload.tipo) }}>
        {formatCOP(slice.payload.valor)}
      </p>
      <p className="chart-tooltip-pct">{slice.payload.pct}% del total</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartMixPagador({ rows, total }: ChartMixPagadorProps): React.ReactElement {
  const slices = aggregateByTipo(rows, total);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={slices}
          dataKey="valor"
          nameKey="tipo"
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          label={false}
        >
          {slices.map((slice, index) => (
            <Cell key={`cell-${index}`} fill={tipoColor(slice.tipo)} />
          ))}
          {/* Center label rendered via labelLine-less approach */}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => (
            <span style={{ fontSize: 12, color: '#475569' }}>{value}</span>
          )}
        />
        {/* Render center label as absolute overlay via custom shape */}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
          <tspan x="50%" dy="-0.5em" fontSize={11} fill="#64748b">
            Total
          </tspan>
          <tspan x="50%" dy="1.4em" fontSize={13} fontWeight={600} fill="#1e293b">
            {total >= 1_000_000
              ? `$${(total / 1_000_000).toFixed(1)}M`
              : `$${(total / 1_000).toFixed(0)}K`}
          </tspan>
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
