import React, { useState } from 'react';
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
  selectedTipo?: string | null;
  onTipoClick?: (tipo: string) => void;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

interface Slice {
  tipo: string;
  label: string;
  valor: number;
  pct: number;
  group: 'cobro' | 'caja';
}

const TIPO_COLOR: Record<string, string> = {
  EPS:              '#3b82f6',
  CONVENIO:         '#a855f7',
  CONVENIO__CAJA:   '#14b8a6',
  ARL:              '#f59e0b',
  ARL__CAJA:        '#f97316',
  OTRO:             '#94a3b8',
  OTRO__CAJA:       '#67e8f9',
  PARTICULAR:       '#10b981',
};

const TIPO_LABELS: Record<string, string> = {
  EPS:              'EPS',
  CONVENIO:         'Convenio',
  CONVENIO__CAJA:   'Convenio (directo)',
  ARL:              'ARL',
  ARL__CAJA:        'ARL (caja)',
  PARTICULAR:       'Particular',
  OTRO:             'Otro',
  OTRO__CAJA:       'Otro (caja)',
};

const TIPO_GROUPS: Record<string, 'cobro' | 'caja'> = {
  EPS:              'cobro',
  CONVENIO:         'cobro',
  CONVENIO__CAJA:   'caja',
  ARL:              'cobro',
  ARL__CAJA:        'caja',
  OTRO:             'cobro',
  OTRO__CAJA:       'caja',
  PARTICULAR:       'caja',
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
    const isCaja = r.es_grupo || r.tipo === 'PARTICULAR';
    const key = (r.es_grupo && r.tipo !== 'PARTICULAR') ? `${r.tipo}__CAJA` : r.tipo;
    map.set(key, (map.get(key) ?? 0) + r.valor_bruto);
    if (isCaja) cajaTotal += r.valor_bruto;
    else         cobroTotal += r.valor_bruto;
  }

  const grandTotal = cobroTotal + cajaTotal;

  const slices: Slice[] = Array.from(map.entries())
    .map(([tipo, valor]) => ({
      tipo,
      label: TIPO_LABELS[tipo] ?? tipo,
      valor,
      pct: grandTotal > 0 ? Math.round((valor / grandTotal) * 1000) / 10 : 0,
      group: (TIPO_GROUPS[tipo] ?? 'cobro') as 'cobro' | 'caja',
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
  groupTotal?: number;
  selectedGroup?: 'caja' | 'cobro' | null;
}

function CustomTooltip({ active, payload, groupTotal, selectedGroup }: CustomTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  const s = payload[0];
  if (!s) return null;

  const base = groupTotal && groupTotal > 0 && selectedGroup
    ? Math.round((s.payload.valor / groupTotal) * 1000) / 10
    : s.payload.pct;

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-label">{s.payload.label}</p>
      <p className="chart-tooltip-row" style={{ color: getColor(s.payload.tipo) }}>
        {formatCOP(s.payload.valor)}
      </p>
      <p className="chart-tooltip-pct">
        {base}%{selectedGroup ? ' del grupo' : ' del total'}
      </p>
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

interface SummaryGroupProps {
  label: string;
  sublabel: string;
  valor: number;
  pct: number;
  accent: string;
  group: 'caja' | 'cobro';
  isActive: boolean;
  isInactive: boolean;
  onClick: () => void;
}

function SummaryGroup({ label, sublabel, valor, pct, accent, isActive, isInactive, onClick }: SummaryGroupProps): React.ReactElement {
  const fmt = (n: number): string =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

  return (
    <div
      className={`mix-summary-group mix-summary-group--clickable${isActive ? ' mix-summary-group--active' : ''}${isInactive ? ' mix-summary-group--inactive' : ''}`}
      style={{ borderLeftColor: accent }}
      onClick={onClick}
      title={isActive ? 'Haz clic para ver todo' : 'Haz clic para ver distribución'}
    >
      <div className="mix-summary-label">{label}</div>
      <div className="mix-summary-sublabel">{sublabel}</div>
      <div className="mix-summary-valor" style={{ color: accent }}>{fmt(valor)}</div>
      <div className="mix-summary-pct">{pct.toFixed(1)}%{isActive && <span className="mix-summary-active-badge"> · filtrando</span>}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartMixPagador({ rows, selectedTipo, onTipoClick }: ChartMixPagadorProps): React.ReactElement {
  const { slices, cobroTotal, cajaTotal, grandTotal } = aggregateMix(rows);
  const [selectedGroup, setSelectedGroup] = useState<'caja' | 'cobro' | null>(null);

  const cobroPct = grandTotal > 0 ? Math.round((cobroTotal / grandTotal) * 1000) / 10 : 0;
  const cajaPct  = grandTotal > 0 ? Math.round((cajaTotal  / grandTotal) * 1000) / 10 : 0;

  function handleGroupClick(group: 'caja' | 'cobro'): void {
    setSelectedGroup((prev) => (prev === group ? null : group));
    // clear tipo filter when switching to group view
    if (selectedTipo && onTipoClick) onTipoClick(selectedTipo);
  }

  const groupTotal = selectedGroup === 'caja' ? cajaTotal : selectedGroup === 'cobro' ? cobroTotal : 0;

  // When group is active: only show slices from that group in legend
  const legendSlices = selectedGroup ? slices.filter((s) => s.group === selectedGroup) : slices;

  // Pie slices: when group selected, near-hide the other group
  function sliceOpacity(tipo: string): number {
    const s = slices.find((sl) => sl.tipo === tipo);
    if (selectedGroup && s?.group !== selectedGroup) return 0.07;
    if (selectedTipo && selectedTipo !== tipo) return 0.3;
    return 1;
  }

  // Pie center text: show group label + sub-total when group is selected
  const centerLabel  = selectedGroup === 'caja' ? 'Flujo de caja' : selectedGroup === 'cobro' ? 'Cobro' : 'Total';
  const centerValue  = selectedGroup ? groupTotal : grandTotal;

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
            style={{ cursor: onTipoClick ? 'pointer' : 'default' }}
            onClick={(entry: Slice) => onTipoClick?.(entry.tipo)}
          >
            {slices.map((s, i) => (
              <Cell key={`cell-${i}`} fill={getColor(s.tipo)} opacity={sliceOpacity(s.tipo)} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip groupTotal={groupTotal} selectedGroup={selectedGroup} />} />
          <text x="50%" y="44%" textAnchor="middle" dominantBaseline="central">
            <tspan x="50%" dy="0" fontSize={8} fill="#64748b">{centerLabel}</tspan>
            <tspan x="50%" dy="1.5em" fontSize={12} fontWeight={700} fill="#1e293b">
              {centerValue >= 1_000_000
                ? `$${(centerValue / 1_000_000).toFixed(1)}M`
                : `$${(centerValue / 1_000).toFixed(0)}K`}
            </tspan>
            {selectedGroup && (
              <tspan x="50%" dy="1.4em" fontSize={8} fill="#64748b">
                {selectedGroup === 'caja' ? cajaPct : cobroPct}% del total
              </tspan>
            )}
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
          group="cobro"
          isActive={selectedGroup === 'cobro'}
          isInactive={selectedGroup === 'caja'}
          onClick={() => handleGroupClick('cobro')}
        />
        <SummaryGroup
          label="Flujo de caja"
          sublabel="Particulares · Caja"
          valor={cajaTotal}
          pct={cajaPct}
          accent="#10b981"
          group="caja"
          isActive={selectedGroup === 'caja'}
          isInactive={selectedGroup === 'cobro'}
          onClick={() => handleGroupClick('caja')}
        />
      </div>

      {/* Category legend — shows only active group when filtered */}
      <div className="mix-legend">
        {legendSlices.map((s) => {
          // when group is selected, pct relative to that group
          const displayPct = selectedGroup
            ? (groupTotal > 0 ? Math.round((s.valor / groupTotal) * 1000) / 10 : 0)
            : s.pct;
          return (
            <div
              key={s.tipo}
              className={`mix-legend-item${onTipoClick ? ' mix-legend-item--clickable' : ''}${selectedTipo === s.tipo ? ' mix-legend-item--active' : ''}`}
              style={{ opacity: selectedTipo && selectedTipo !== s.tipo ? 0.4 : 1 }}
              onClick={() => onTipoClick?.(s.tipo)}
            >
              <span className="mix-legend-dot" style={{ background: getColor(s.tipo) }} />
              <span className="mix-legend-name">{s.label}</span>
              <span className="mix-legend-pct">{displayPct}%</span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: '0.62rem', color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
        {selectedGroup
          ? 'Haz clic en el grupo para volver · clic en tipo para filtrar'
          : 'Haz clic en un grupo o tipo para filtrar'}
      </p>
    </div>
  );
}
