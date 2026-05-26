import React from 'react';
import type { EntidadRow } from '../../api/reportes.js';

// ─── Props ────────────────────────────────────────────────────────────────────

interface TopEntidadesProps {
  rows: EntidadRow[];
  limit?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIPO_COLOR: Record<string, string> = {
  EPS:        '#1d4ed8',
  CONVENIO:   '#6d28d9',
  ARL:        '#92400e',
  PARTICULAR: '#065f46',
  CAJA:       '#166534',
  OTRO:       '#475569',
};

const TIPO_BG: Record<string, string> = {
  EPS:        '#dbeafe',
  CONVENIO:   '#ede9fe',
  ARL:        '#fef3c7',
  PARTICULAR: '#d1fae5',
  CAJA:       '#dcfce7',
  OTRO:       '#f1f5f9',
};

const BAR_COLOR: Record<string, string> = {
  EPS:        '#3b82f6',
  CONVENIO:   '#a855f7',
  ARL:        '#f59e0b',
  PARTICULAR: '#10b981',
  CAJA:       '#22c55e',
  OTRO:       '#94a3b8',
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopEntidades({ rows, limit = 6 }: TopEntidadesProps): React.ReactElement {
  const top = [...rows]
    .sort((a, b) => b.valor_bruto - a.valor_bruto)
    .slice(0, limit);

  if (top.length === 0) {
    return (
      <p className="top-entidades-empty">Sin datos para el período</p>
    );
  }

  return (
    <div className="top-entidades">
      {top.map((r, i) => (
        <div key={i} className="top-entidades-row">
          <span className="top-entidades-rank">{i + 1}</span>

          <div className="top-entidades-info">
            <span className="top-entidades-nombre">{r.entidad}</span>
            <span
              className="top-entidades-tipo"
              style={{
                color:      TIPO_COLOR[r.tipo] ?? TIPO_COLOR['OTRO']!,
                background: TIPO_BG[r.tipo]    ?? TIPO_BG['OTRO']!,
              }}
            >
              {r.tipo}
            </span>
          </div>

          <div className="top-entidades-right">
            <div className="top-entidades-valor">{fmt(r.valor_bruto)}</div>
            <div className="top-entidades-bar">
              <div
                className="top-entidades-bar-fill"
                style={{
                  width:      `${Math.min(r.participacion_pct, 100)}%`,
                  background: BAR_COLOR[r.tipo] ?? BAR_COLOR['OTRO']!,
                }}
              />
            </div>
            <span className="top-entidades-pct">{r.participacion_pct.toFixed(1)}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
