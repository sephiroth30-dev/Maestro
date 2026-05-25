import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { EntidadRow } from '../../api/reportes.js';
import { formatCOP } from './KpiCard.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChartMixPagadorProps {
  rows: EntidadRow[];
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

interface Slice {
  tipo: string;
  label: string;
  valor: number;
  pct: number;
  group: 'cobro' | 'caja';
}

// Colors per category
const TIPO_COLOR: Record<string, string> = {
  EPS:        '#3b82f6', // blue
  CONVENIO:   '#a855f7', // purple
  ARL:        '#f59e0b', // amber
  OTRO:       '#94a3b8', // slate
  PARTICULAR: '#10b981', // emerald
  CAJA:       '#22c55e', // green
};

function getColor(tipo: string): string {
  return TIPO_COLOR[tipo] ?? TIPO_COLOR['OTRO']!;
}

function aggregateMix(rows: EntidadRow[]): {
  slices: Slice[];
  cobroTotal: number;
  cajaTotal: number;
  grandTotal: number;
} {
  const map = new Map<string, number>();
  let cobroTotal = 0;
  let cajaTotal = 0;

  for (const r of rows) {
    // es_grupo (es_grupo_caja) entities + PARTICULAR → cash flow
    const isCaja = r.es_grupo || r.tipo === 'PARTICULAR';
    const key = r.es_grupo ? 'CAJA' : r.tipo;
    map.set(key, (map.get(key) ?? 0) + r.valor_bruto);
    if (isCaja) {
      cajaTotal += r.valor_bruto;
    } else {
      cobroTotal += r.valor_bruto;
    }
  }

  const grandTotal = cobroTotal + cajaTotal;

  const LABELS: Record<string, string> = {
    EPS:        'EPS',
    CONVENIO:   'Convenio',
    ARL:        'ARL',
    PARTICULAR: 'Particular',
    CAJA:       'Caja',
    OTRO:       'Otro',
  };
  const GROUPS: Record<string, 'cobro' | 'caja'> = {
    EPS:        'cobro',
    CONVENIO:   'cobro',
    ARL:        'cobro',
    OTRO:       'cobro',
    PARTICULAR: 'caja',
    CAJA:       'caja',
  };

  const slices: Slice[] = Array.from(map.entries())
    .map(([tipo, valor]) => ({
      tipo,
      label: LABELS[tipo] ?? tipo,
      valor,
      pct: grandTotal > 0 ? Math.round((valor / grandTotal) * 1000) / 10 : 0,
      group: (GROUPS[tipo] ?? 'cobro') as 'cobro' | 'caja',
    }))
    .sort((a, b) => b.valor - a.valor);

  return { slices, cobroTotal, cajaTotal, grandTotal };
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: Slice;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const s = payload[0];
  if (!s) return null;
  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{s.payload.label}</p>
      <p className="chart-tooltip-row" style={{ color: getColor(s.payload.tipo) }}>
        {formatCOP(s.payload.valor)}
      </p>
      <p className="chart-tooltip-pct">{s.payload.pct}% del total</p>
    </div>
  );
}

// ─── Summary row ──────────────────────────────────────────────────────────────

interface SummaryGroupProps {
  label: string;
  sublabel: string;
  valor: number;
  pct: number;
  accent: string;
}

function SummaryGroup({ label, sublabel, valor, pct, accent }: SummaryGroupProps): React.ReactElement {
  const fmt = (n: number): string =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

  return (
    <div className="mix-summary-group" style={{ borderLeftColor: accent }}>
      <div className="mix-summary-label">{label}</div>
      <div className="mix-summary-sublabel">{sublabel}</div>
      <div className="mix-summary-valor" style={{ color: accent }}>{fmt(valor)}</div>
      <div className="mix-summary-pct">{pct.toFixed(1)}%</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartMixPagador({ rows }: ChartMixPagadorProps): React.ReactElement {
  const { slices, cobroTotal, cajaTotal, grandTotal } = aggregateMix(rows);

  const cobroPct = grandTotal > 0 ? Math.round((cobroTotal / grandTotal) * 1000) / 10 : 0;
  const cajaPct  = grandTotal > 0 ? Math.round((cajaTotal  / grandTotal) * 1000) / 10 : 0;

  return (
    <div className="mix-pagador">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="valor"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={2}
            label={false}
          >
            {slices.map((s, i) => (
              <Cell key={`cell-${i}`} fill={getColor(s.tipo)} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {/* Center text */}
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central">
            <tspan x="50%" dy="0" fontSize={9} fill="#64748b">Total</tspan>
            <tspan x="50%" dy="1.4em" fontSize={13} fontWeight={700} fill="#1e293b">
              {grandTotal >= 1_000_000
                ? `$${(grandTotal / 1_000_000).toFixed(1)}M`
                : `$${(grandTotal / 1_000).toFixed(0)}K`}
            </tspan>
          </text>
        </PieChart>
      </ResponsiveContainer>

      {/* Two-group summary */}
      <div className="mix-summary">
        <SummaryGroup
          label="Cobro a entidades"
          sublabel="EPS · Convenios · ARL"
          valor={cobroTotal}
          pct={cobroPct}
          accent="#3b82f6"
        />
        <SummaryGroup
          label="Flujo de caja"
          sublabel="Particulares · Caja"
          valor={cajaTotal}
          pct={cajaPct}
          accent="#10b981"
        />
      </div>

      {/* Category legend */}
      <div className="mix-legend">
        {slices.map((s) => (
          <div key={s.tipo} className="mix-legend-item">
            <span className="mix-legend-dot" style={{ background: getColor(s.tipo) }} />
            <span className="mix-legend-name">{s.label}</span>
            <span className="mix-legend-pct">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
