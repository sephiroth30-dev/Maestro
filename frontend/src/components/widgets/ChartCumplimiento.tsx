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
import type { SemanaRow } from '../../api/reportes.js';
import { formatCOP } from './KpiCard.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChartCumplimientoProps {
  semanas: SemanaRow[];
  onWeekClick?: (semana: SemanaRow) => void;
}

// ─── Color logic ──────────────────────────────────────────────────────────────

function barColor(pct: number, estado: SemanaRow['estado']): string {
  if (estado === 'FUTURA') return '#cbd5e1'; // gray for future
  if (pct >= 100) return '#22c55e';           // green
  if (pct >= 80) return '#f59e0b';            // yellow
  return '#ef4444';                           // red
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

  const venta = payload.find((p) => p.name === 'Facturado');
  const estimado = payload.find((p) => p.name === 'Estimado');

  const pct =
    venta && estimado && estimado.value > 0
      ? ((venta.value / estimado.value) * 100).toFixed(1)
      : null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {venta && (
        <p className="chart-tooltip-row" style={{ color: venta.color }}>
          Facturado: {formatCOP(venta.value)}
        </p>
      )}
      {estimado && (
        <p className="chart-tooltip-row" style={{ color: estimado.color }}>
          Estimado: {formatCOP(estimado.value)}
        </p>
      )}
      {pct && (
        <p className="chart-tooltip-row chart-tooltip-pct">
          Cumplimiento: {pct}%
        </p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartCumplimiento({ semanas, onWeekClick }: ChartCumplimientoProps): React.ReactElement {
  const data = semanas.map((s) => ({
    nombre: `Sem ${s.numero}`,
    Facturado: s.venta,
    Estimado: s.estimado,
    pct: s.cumplimiento_pct,
    estado: s.estado,
    _raw: s,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="nombre" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis
          tickFormatter={(v: number) =>
            v >= 1_000_000
              ? `$${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
                ? `$${(v / 1_000).toFixed(0)}K`
                : `$${v}`
          }
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#64748b' }}
        />
        <Bar
          dataKey="Facturado"
          maxBarSize={56}
          style={{ cursor: onWeekClick ? 'pointer' : 'default' }}
          onClick={(entry: { _raw: SemanaRow }) => onWeekClick?.(entry._raw)}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={barColor(entry.pct, entry.estado)} />
          ))}
        </Bar>
        <Line
          type="monotone"
          dataKey="Estimado"
          stroke="#94a3b8"
          strokeDasharray="6 3"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
