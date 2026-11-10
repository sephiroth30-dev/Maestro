import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { fechaCorta } from './agenda.js';

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
  /**
   * Periodo contra el que se compara, mostrado dentro de la propia ficha: su
   * etiqueta, su cifra y el crecimiento. Sustituye al «Faltó: X» cuando lo que
   * interesa es cuánto se creció y no cuánto faltó para la meta.
   *
   * `crecimientoPct === null` significa base cero: no se pinta porcentaje,
   * porque «crecimiento infinito» no informa y 100 % sería falso.
   */
  /**
   * Proyección por agenda: lo atendido (la cifra grande) más lo agendado, que son
   * las citas pendientes del periodo valoradas con lo facturado antes a esa EPS.
   *
   * `sinValor` son las citas sin precio de referencia: se AVISAN en vez de
   * contarse como cero, porque un cero en silencio haría parecer más baja la
   * proyección sin que nadie lo notara.
   */
  /**
   * Cumplimiento si se atiende todo lo agendado (proyectado ÷ meta), en %.
   * Va en la tarjeta de Cumplimiento, junto al cumplimiento real.
   */
  proyeccionPct?: number;
  /**
   * Aviso cuando la agenda no está disponible (falló, no se ha sincronizado o
   * está vieja). Se pinta AUNQUE no haya bloque de agenda: «sin agenda» no
   * puede verse igual que «no hay citas», porque el proyectado saldría bajo y
   * nadie lo notaría.
   */
  avisoAgenda?: string;
  agenda?: {
    valor: number;
    citas: number;
    sinValor: number;
    /**
     * Solo viene cuando la agenda NO cubre todo el periodo: fecha de la última
     * cita cargada (YYYY-MM-DD). Si la cubre, es `null` y no se dice nada: en la
     * vista de un día, «agenda cargada hasta el 30 nov» sería ruido.
     */
    horizonte: string | null;
    /** «Atendido a la fecha», «Atendido hoy»… */
    atendidoLabel: string;
    /** Referencia para el crecimiento del proyectado, p. ej. el mes anterior cerrado. */
    referencia?: { label: string; valor: number };
  };
  comparacion?: {
    /** Cómo se llama el periodo MOSTRADO (p. ej. «Octubre 2026»), junto a la cifra grande. */
    labelActual?: string;
    label: string;
    valor: number;
    crecimientoPct: number | null;
  };
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
  proyeccionPct,
  avisoAgenda,
  agenda,
  comparacion,
}: KpiCardProps): React.ReactElement {
  const formattedValue =
    formato === 'currency'
      ? formatCOP(valor)
      : formato === 'percent'
        ? formatPercent(valor)
        : formatNumber(valor);

  const cumplimientoPct = meta && meta > 0 ? Math.min((valor / meta) * 100, 100) : null;

  const deltaPositive = delta !== undefined && delta >= 0;
  // Un 0,0 % con flecha verde hacia arriba se lee como crecimiento cuando no lo
  // hubo: el empate va en gris y sin flecha.
  const deltaIgual = delta !== undefined && Math.abs(delta) < 0.05;

  const formatear = (v: number): string =>
    formato === 'currency' ? formatCOP(v) : formato === 'percent' ? formatPercent(v) : formatNumber(v);

  // Proyectado = atendido + agendado. Solo se enseña si hay algo agendado: sin
  // citas pendientes el bloque no aporta y la ficha queda como siempre.
  const proyectado = agenda ? valor + agenda.valor : 0;
  const hayAgenda = agenda !== undefined && (agenda.citas > 0 || agenda.valor > 0);
  const vsRef = agenda?.referencia && agenda.referencia.valor > 0
    ? ((proyectado - agenda.referencia.valor) / agenda.referencia.valor) * 100
    : null;
  const vsRefIgual = vsRef !== null && Math.abs(vsRef) < 0.05;

  const crecimiento = comparacion?.crecimientoPct ?? null;
  const crecimientoIgual = crecimiento !== null && Math.abs(crecimiento) < 0.05;

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
      {comparacion?.labelActual && <div className="kpi-card-periodo">{comparacion.labelActual}</div>}
      {avisoAgenda && (
        <div className="kpi-card-agenda-aviso">⚠ {avisoAgenda}</div>
      )}
      {hayAgenda && agenda && !comparacion?.labelActual && (
        <div className="kpi-card-periodo">{agenda.atendidoLabel}</div>
      )}

      {hayAgenda && agenda && (
        <div className="kpi-card-agenda">
          <div className="kpi-card-agenda-fila">
            <span className="kpi-card-agenda-mas">+ Agendado</span>
            <span className="kpi-card-agenda-valor">{formatCOP(agenda.valor)}</span>
          </div>
          <div className="kpi-card-agenda-sub">
            {formatNumber(agenda.citas)} {agenda.citas === 1 ? 'cita pendiente' : 'citas pendientes'}
          </div>

          <div className="kpi-card-proyectado">
            <span className="kpi-card-proyectado-label">Proyectado</span>
            <span className="kpi-card-proyectado-valor">{formatCOP(proyectado)}</span>
          </div>

          {vsRef !== null && agenda.referencia && (
            <div className={`kpi-card-delta ${vsRefIgual ? 'kpi-card-delta--flat' : vsRef > 0 ? 'kpi-card-delta--up' : 'kpi-card-delta--down'}`}>
              {!vsRefIgual && (vsRef > 0
                ? <TrendingUp size={14} className="kpi-card-delta-icon" />
                : <TrendingDown size={14} className="kpi-card-delta-icon" />)}
              <span>
                {vsRef > 0 && !vsRefIgual ? '+' : ''}{formatPercent(vsRef)} vs {agenda.referencia.label}
              </span>
            </div>
          )}

          {agenda.sinValor > 0 && (
            <div className="kpi-card-agenda-aviso" title="Citas de una EPS o servicio sin historial de facturación para estimar su valor. No se cuentan en el proyectado.">
              ⚠ {formatNumber(agenda.sinValor)} {agenda.sinValor === 1 ? 'cita' : 'citas'} sin precio de referencia
            </div>
          )}
          {agenda.horizonte && (
            <div className="kpi-card-agenda-aviso" title="Las citas más lejanas aún no están agendadas, así que el proyectado de este periodo puede quedar corto.">
              ⚠ La agenda solo está cargada hasta el {fechaCorta(agenda.horizonte)}
            </div>
          )}
        </div>
      )}

      {delta !== undefined && (
        <div className={`kpi-card-delta ${deltaIgual ? 'kpi-card-delta--flat' : deltaPositive ? 'kpi-card-delta--up' : 'kpi-card-delta--down'}`}>
          {!deltaIgual && (deltaPositive ? (
            <TrendingUp size={14} className="kpi-card-delta-icon" />
          ) : (
            <TrendingDown size={14} className="kpi-card-delta-icon" />
          ))}
          <span>
            {deltaPositive && !deltaIgual ? '+' : ''}
            {formatPercent(delta)} {deltaLabel ?? ''}
          </span>
        </div>
      )}

      {comparacion && (
        <div className="kpi-card-comp">
          <div className="kpi-card-comp-fila">
            <span className="kpi-card-comp-label">{comparacion.label}</span>
            <span className="kpi-card-comp-valor">{formatear(comparacion.valor)}</span>
          </div>
          {crecimiento !== null && (
            <div className={`kpi-card-delta ${crecimientoIgual ? 'kpi-card-delta--flat' : crecimiento > 0 ? 'kpi-card-delta--up' : 'kpi-card-delta--down'}`}>
              {!crecimientoIgual && (crecimiento > 0
                ? <TrendingUp size={14} className="kpi-card-delta-icon" />
                : <TrendingDown size={14} className="kpi-card-delta-icon" />)}
              <span>
                {crecimiento > 0 && !crecimientoIgual ? '+' : ''}
                {formatPercent(crecimiento)} de crecimiento
              </span>
            </div>
          )}
        </div>
      )}

      {proyeccionPct !== undefined && (
        <div className="kpi-card-proy-pct" title="Cumplimiento de la meta si se atiende todo lo que hoy está agendado">
          <span className="kpi-card-proy-pct-label">Con lo agendado</span>
          <strong className="kpi-card-proy-pct-valor">{formatPercent(proyeccionPct)}</strong>
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
