import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ─── Currency formatter (Colombian pesos) ────────────────────────────────────

export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value)}%`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface KpiCardProps {
  titulo: string;
  valor: number;
  formato: 'currency' | 'number' | 'percent';
  delta?: number;
  deltaLabel?: string;
  meta?: number;
  metaLabel?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'rose';
  showShortfall?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KpiCard({
  titulo,
  valor,
  formato,
  delta,
  deltaLabel,
  meta,
  metaLabel,
  icon,
  color = 'blue',
  showShortfall = false,
}: KpiCardProps): React.ReactElement {
  const formattedValue =
    formato === 'currency'
      ? formatCOP(valor)
      : formato === 'percent'
        ? formatPercent(valor)
        : formatNumber(valor);

  const cumplimientoPct = meta && meta > 0 ? Math.min((valor / meta) * 100, 100) : null;

  const deltaPositive = delta !== undefined && delta >= 0;

  const colorMap: Record<string, string> = {
    blue:   'kpi-card--blue',
    green:  'kpi-card--green',
    purple: 'kpi-card--purple',
    amber:  'kpi-card--amber',
    rose:   'kpi-card--rose',
  };

  return (
    <div className={`kpi-card ${colorMap[color] ?? 'kpi-card--blue'}`}>
      <div className="kpi-card-header">
        {icon && <div className="kpi-card-icon">{icon}</div>}
        <span className="kpi-card-title">{titulo}</span>
      </div>

      <div className="kpi-card-value">{formattedValue}</div>

      {delta !== undefined && (
        <div className={`kpi-card-delta ${deltaPositive ? 'kpi-card-delta--up' : 'kpi-card-delta--down'}`}>
          {deltaPositive ? (
            <TrendingUp size={14} className="kpi-card-delta-icon" />
          ) : (
            <TrendingDown size={14} className="kpi-card-delta-icon" />
          )}
          <span>
            {deltaPositive ? '+' : ''}
            {formatPercent(delta)} {deltaLabel ?? ''}
          </span>
        </div>
      )}

      {cumplimientoPct !== null && (
        <div className="kpi-card-progress">
          <div className="kpi-card-progress-bar">
            <div
              className={`kpi-card-progress-fill ${
                cumplimientoPct >= 100
                  ? 'kpi-card-progress-fill--green'
                  : cumplimientoPct >= 80
                    ? 'kpi-card-progress-fill--yellow'
                    : 'kpi-card-progress-fill--red'
              }`}
              style={{ width: `${cumplimientoPct}%` }}
            />
          </div>
          <div className="kpi-card-progress-labels">
            {showShortfall && meta ? (
              valor >= meta ? (
                <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '0.75rem' }}>✓ Meta cumplida</span>
              ) : (
                <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.75rem' }}>
                  Faltó: {formato === 'currency' ? formatCOP(meta - valor) : formatNumber(meta - valor)}
                </span>
              )
            ) : (
              <span>{formatPercent(cumplimientoPct)}</span>
            )}
            {metaLabel && meta && (
              <span className="kpi-card-progress-meta">
                {metaLabel}: {formato === 'currency' ? formatCOP(meta) : formatNumber(meta)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
