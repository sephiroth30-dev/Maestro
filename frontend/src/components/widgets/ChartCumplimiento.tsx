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
  /**
   * Semanas del mes con el que se compara. Se enfrentan por NÚMERO de semana
   * (la 1 con la 1), no por fecha: dos meses distintos no comparten días, y lo
   * que interesa es cómo rindió cada tramo del mes.
   */
  comparado?: { label: string; semanas: SemanaRow[] } | null;
  /** Nombre del periodo mostrado, para distinguirlo del comparado en la leyenda. */
  label?: string;
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
  dataKey?: string;
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

  const venta = payload.find((p) => p.dataKey === 'Facturado');
  const estimado = payload.find((p) => p.dataKey === 'Estimado');
  const comp = payload.find((p) => p.dataKey === 'Comparado');

  const pct =
    venta && estimado && estimado.value > 0
      ? ((venta.value / estimado.value) * 100).toFixed(1)
      : null;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{label}</p>
      {venta && (
        <p className="chart-tooltip-row" style={{ color: venta.color }}>
          {venta.name}: {formatCOP(venta.value)}
        </p>
      )}
      {comp && (
        <p className="chart-tooltip-row" style={{ color: comp.color }}>
          {comp.name}: {formatCOP(comp.value)}
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

export default function ChartCumplimiento({ semanas, onWeekClick, comparado, label }: ChartCumplimientoProps): React.ReactElement {
  // Un mes puede tener 4 semanas y el otro 5: se grafica hasta la mayor, y la
  // que falta en uno queda en blanco en vez de inventar un cero.
  const porNumero = new Map((comparado?.semanas ?? []).map((s) => [s.numero, s]));
  const numeros = new Set<number>([...semanas.map((s) => s.numero), ...porNumero.keys()]);
  const actuales = new Map(semanas.map((s) => [s.numero, s]));

  const data = [...numeros].sort((a, b) => a - b).map((n) => {
    const s = actuales.get(n);
    return {
      nombre: `Sem ${n}`,
      Facturado: s?.venta,
      Estimado: s?.estimado,
      Comparado: porNumero.get(n)?.venta,
      pct: s?.cumplimiento_pct ?? 0,
      estado: s?.estado ?? 'FUTURA',
      _raw: s,
    };
  });

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
        {comparado && (
          // Va ANTES de la serie principal para que quede a la izquierda: el
          // periodo anterior se lee primero y el actual cierra el par.
          <Bar dataKey="Comparado" name={comparado.label} fill="#a5b4fc" maxBarSize={40} radius={[3, 3, 0, 0]} />
        )}
        <Bar
          dataKey="Facturado"
          name={label ?? 'Facturado'}
          maxBarSize={comparado ? 40 : 56}
          style={{ cursor: onWeekClick ? 'pointer' : 'default' }}
          onClick={(entry: { _raw?: SemanaRow }) => { if (entry._raw) onWeekClick?.(entry._raw); }}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={barColor(entry.pct, entry.estado)} />
          ))}
        </Bar>
        <Line
          type="monotone"
          name="Estimado"
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
