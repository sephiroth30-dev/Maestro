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
}

// ─── Color map by category ────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, string> = {
  EPS:        '#3b82f6', // blue
  CONVENIO:   '#a855f7', // purple
  ARL:        '#f59e0b', // amber
  OTRO:       '#94a3b8', // slate
  PARTICULAR: '#64748b', // gray (non-caja particulares)
  CAJA:       '#10b981', // emerald — cash patients
};

function tipoColor(tipo: string): string {
  return TIPO_COLORS[tipo] ?? TIPO_COLORS['OTRO']!;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

interface TipoSlice {
  tipo: string;
  valor: number;
  pct: number;
}

function aggregateByTipo(rows: EntidadRow[]): { slices: TipoSlice[]; epsTotal: number; cajaTotal: number } {
  const map = new Map<string, number>();
  let epsTotal = 0;
  let cajaTotal = 0;

  for (const r of rows) {
    // es_grupo_caja entities (PARTICULARES) form a separate "CAJA" slice
    const key = r.es_grupo ? 'CAJA' : r.tipo;
    map.set(key, (map.get(key) ?? 0) + r.valor_bruto);
    if (r.es_grupo) {
      cajaTotal += r.valor_bruto;
    } else {
      epsTotal += r.valor_bruto;
    }
  }

  const fullTotal = epsTotal + cajaTotal;
  const slices = Array.from(map.entries())
    .map(([tipo, valor]) => ({
      tipo,
      valor,
      pct: fullTotal > 0 ? Math.round((valor / fullTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  return { slices, epsTotal, cajaTotal };
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

export default function ChartMixPagador({ rows }: ChartMixPagadorProps): React.ReactElement {
  const { slices, epsTotal, cajaTotal } = aggregateByTipo(rows);

  const centerLabel = epsTotal >= 1_000_000
    ? `$${(epsTotal / 1_000_000).toFixed(1)}M`
    : `$${(epsTotal / 1_000).toFixed(0)}K`;

  const cajaLabel = cajaTotal > 0
    ? (cajaTotal >= 1_000_000
      ? `$${(cajaTotal / 1_000_000).toFixed(1)}M`
      : `$${(cajaTotal / 1_000).toFixed(0)}K`)
    : null;

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
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value: string) => (
            <span style={{ fontSize: 12, color: '#475569' }}>
              {value === 'CAJA' ? '💵 CAJA' : value}
            </span>
          )}
        />
        {/* Center labels: EPS total + optional Caja */}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central">
          <tspan x="50%" dy={cajaLabel ? '-1em' : '-0.5em'} fontSize={10} fill="#64748b">
            EPS/Convenios
          </tspan>
          <tspan x="50%" dy="1.3em" fontSize={13} fontWeight={600} fill="#1e293b">
            {centerLabel}
          </tspan>
          {cajaLabel && (
            <>
              <tspan x="50%" dy="1.3em" fontSize={9} fill="#10b981">
                Caja
              </tspan>
              <tspan x="50%" dy="1.1em" fontSize={11} fontWeight={500} fill="#10b981">
                {cajaLabel}
              </tspan>
            </>
          )}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
