import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DiaSemanaRow } from '../../api/reportes.js';
import { formatCOP } from './KpiCard.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChartDiasSemanaProps {
  rows: DiaSemanaRow[];
}

// ─── Day label shortening ─────────────────────────────────────────────────────

const DIA_CORTO: Record<string, string> = {
  Lunes:     'Lun',
  Martes:    'Mar',
  'Miércoles': 'Mié',
  Jueves:    'Jue',
  Viernes:   'Vie',
  Sábado:    'Sáb',
  Domingo:   'Dom',
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: DiaSemanaRow;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      <p className="chart-tooltip-row" style={{ color: '#6366f1' }}>
        Promedio: {formatCOP(row.promedio)}
      </p>
      <p className="chart-tooltip-row" style={{ color: '#94a3b8' }}>
        Total histórico: {formatCOP(row.total)}
      </p>
      <p className="chart-tooltip-row" style={{ color: '#94a3b8' }}>
        Atenciones: {row.atenciones}
      </p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartDiasSemana({ rows }: ChartDiasSemanaProps): React.ReactElement {
  // Sort by day number, exclude Sunday (0) for display
  const data = rows
    .filter((r) => r.dia_num !== 0)
    .sort((a, b) => a.dia_num - b.dia_num)
    .map((r) => ({
      ...r,
      label: DIA_CORTO[r.dia] ?? r.dia,
    }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
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
        <Bar
          dataKey="promedio"
          name="Promedio"
          fill="#6366f1"
          maxBarSize={48}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
