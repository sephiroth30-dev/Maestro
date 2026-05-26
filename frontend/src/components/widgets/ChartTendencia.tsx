import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import type { TendenciaRow } from '../../api/reportes.js';
import { formatCOP } from './KpiCard.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChartTendenciaProps {
  rows: TendenciaRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function barColor(row: TendenciaRow, isCurrent: boolean): string {
  if (isCurrent) return '#3b82f6';
  if (row.presupuesto <= 0) return '#94a3b8';
  const pct = (row.total / row.presupuesto) * 100;
  if (pct >= 100) return '#22c55e';
  if (pct >= 80)  return '#f59e0b';
  return '#94a3b8';
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;

  const facturado    = payload.find((p) => p.name === 'Facturado');
  const presupuesto  = payload.find((p) => p.name === 'Presupuesto');
  const pct =
    facturado && presupuesto && presupuesto.value > 0
      ? ((facturado.value / presupuesto.value) * 100).toFixed(1)
      : null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {facturado && (
        <p className="chart-tooltip-row" style={{ color: facturado.color }}>
          Facturado: {formatCOP(facturado.value)}
        </p>
      )}
      {presupuesto && presupuesto.value > 0 && (
        <p className="chart-tooltip-row" style={{ color: '#94a3b8' }}>
          Presupuesto: {formatCOP(presupuesto.value)}
        </p>
      )}
      {pct && (
        <p className="chart-tooltip-pct">Cumplimiento: {pct}%</p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartTendencia({ rows }: ChartTendenciaProps): React.ReactElement {
  const now = new Date();

  const data = rows.map((r) => ({
    ...r,
    isCurrent: r.anio === now.getFullYear() && r.mesIdx === now.getMonth() + 1,
    Facturado:   r.total,
    Presupuesto: r.presupuesto,
  }));

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `$${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                  ? `$${(v / 1_000).toFixed(0)}K`
                  : `$${v}`
            }
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={56}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="Facturado" maxBarSize={44} radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={barColor(entry, entry.isCurrent)} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="Presupuesto"
            stroke="#cbd5e1"
            strokeDasharray="5 3"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Color legend */}
      <div className="tendencia-legend">
        <span className="tendencia-legend-item"><span style={{ background: '#3b82f6' }} />Mes actual</span>
        <span className="tendencia-legend-item"><span style={{ background: '#22c55e' }} />Meta alcanzada</span>
        <span className="tendencia-legend-item"><span style={{ background: '#f59e0b' }} />Cerca de meta</span>
        <span className="tendencia-legend-item"><span style={{ background: '#94a3b8' }} />Bajo meta</span>
        <span className="tendencia-legend-item">
          <span style={{ background: 'transparent', border: '2px dashed #cbd5e1', height: 2, width: 16 }} />
          Presupuesto
        </span>
      </div>
    </>
  );
}
