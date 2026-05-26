import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Activity, ArrowRight, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useKpis, useEntidades, useCumplimientoSemanal, useTendencia } from '../api/reportes.js';
import type { KpisResult } from '../api/reportes.js';
import { formatNumber } from '../components/widgets/KpiCard.js';
import ChartCumplimiento from '../components/widgets/ChartCumplimiento.js';
import ChartMixPagador from '../components/widgets/ChartMixPagador.js';
import ChartTendencia from '../components/widgets/ChartTendencia.js';
import TopEntidades from '../components/widgets/TopEntidades.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES_ES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function accentColor(pct: number): string {
  if (pct >= 100) return '#22c55e';
  if (pct >= 80)  return '#f59e0b';
  return '#ef4444';
}

function statusInfo(pct: number): { label: string; cls: string } {
  if (pct >= 100) return { label: 'En Meta',      cls: 'db-hero-status--green' };
  if (pct >= 80)  return { label: 'En Progreso',  cls: 'db-hero-status--amber' };
  return             { label: 'Bajo Meta',      cls: 'db-hero-status--red' };
}

// ─── Skeletons & errors ───────────────────────────────────────────────────────

function HeroSkeleton(): React.ReactElement {
  return (
    <div className="db-hero animate-pulse" style={{ borderTopColor: '#e2e8f0' }}>
      <div className="db-hero-head">
        <div style={{ height: 14, width: 120, background: '#e2e8f0', borderRadius: 6 }} />
        <div style={{ height: 22, width: 100, background: '#e2e8f0', borderRadius: 99 }} />
      </div>
      <div className="db-hero-body">
        <div>
          <div style={{ height: 48, width: 180, background: '#e2e8f0', borderRadius: 8, marginBottom: 8 }} />
          <div style={{ height: 12, width: 120, background: '#f1f5f9', borderRadius: 6 }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ height: 40, width: 100, background: '#e2e8f0', borderRadius: 8, marginBottom: 8, marginLeft: 'auto' }} />
          <div style={{ height: 12, width: 80, background: '#f1f5f9', borderRadius: 6, marginLeft: 'auto' }} />
        </div>
      </div>
      <div style={{ height: 12, background: '#f1f5f9', borderRadius: 6, margin: '16px 0 8px' }} />
      <div style={{ height: 10, width: 200, background: '#f1f5f9', borderRadius: 6 }} />
      <div className="db-hero-stats" style={{ marginTop: 20 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div style={{ height: 24, width: 70, background: '#e2e8f0', borderRadius: 6, marginBottom: 6 }} />
            <div style={{ height: 10, width: 80, background: '#f1f5f9', borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 280 }: { height?: number }): React.ReactElement {
  return <div className="animate-pulse" style={{ height, background: '#f1f5f9', borderRadius: 8 }} />;
}

function ErrorState({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0', color: '#ef4444', fontSize: '0.85rem' }}>
      <Activity size={16} />
      <span>Error al cargar datos.</span>
      <button type="button" className="btn btn--secondary" style={{ fontSize: '0.8rem', padding: '4px 12px' }} onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function HeroCard({ data, mesIdx, anio }: { data: KpisResult; mesIdx: number; anio: number }): React.ReactElement {
  const pct     = data.cumplimiento_pct;
  const accent  = accentColor(pct);
  const status  = statusInfo(pct);
  const fillPct = Math.min(pct, 100);

  const projPct = data.proyeccion_cumplimiento_pct;

  return (
    <div className="db-hero" style={{ borderTopColor: accent }}>
      {/* Header row */}
      <div className="db-hero-head">
        <span className="db-hero-period">
          {MESES_ES[mesIdx]} {anio} · Mes actual
        </span>
        <span className={`db-hero-status ${status.cls}`}>
          <span className="db-hero-status-dot" />
          {status.label}
        </span>
      </div>

      {/* Main values */}
      <div className="db-hero-body">
        <div>
          <div className="db-hero-billing-value">{fmtShort(data.facturacion_bruta)}</div>
          <div className="db-hero-billing-label">Facturación del mes</div>
        </div>
        <div className="db-hero-right">
          <div className="db-hero-pct" style={{ color: accent }}>{pct.toFixed(1)}%</div>
          <div className="db-hero-pct-label">Cumplimiento</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="db-hero-progress-wrap">
        <div className="db-hero-progress-track">
          <div
            className="db-hero-progress-fill"
            style={{ width: `${fillPct}%`, background: accent }}
          />
          {/* Projection marker — shown only if projecting above current */}
          {projPct > pct && projPct <= 110 && (
            <div
              className="db-hero-progress-proj"
              style={{ width: `${Math.min(projPct, 100)}%` }}
            />
          )}
        </div>
        <div className="db-hero-progress-meta">
          <span>de {fmtShort(data.presupuesto)} meta</span>
          {data.dias_restantes > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <TrendingUp size={12} style={{ color: projPct >= 100 ? '#22c55e' : '#94a3b8' }} />
              Proyección cierre: {fmtShort(data.proyeccion_cierre)} ({projPct.toFixed(1)}%)
            </span>
          )}
        </div>
      </div>

      {/* Mini stats */}
      <div className="db-hero-stats">
        <div className="db-hero-stat">
          <div className="db-hero-stat-value">{formatNumber(data.atenciones)}</div>
          <div className="db-hero-stat-label">Atenciones</div>
        </div>
        <div className="db-hero-stat">
          <div className="db-hero-stat-value">{fmtShort(data.ticket_promedio)}</div>
          <div className="db-hero-stat-label">Ticket Promedio</div>
        </div>
        <div className="db-hero-stat">
          <div className="db-hero-stat-value">{fmtShort(data.promedio_diario)}</div>
          <div className="db-hero-stat-label">Promedio Diario</div>
        </div>
        <div className="db-hero-stat">
          <div className="db-hero-stat-value">{data.dias_restantes}</div>
          <div className="db-hero-stat-label">Días Hábiles Rest.</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const canViewReportes = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'].includes(user.rol);

  const now = new Date();
  const mesActual  = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  const hora   = now.getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  const kpisQ        = useKpis(mesActual, anioActual);
  const entidadesQ   = useEntidades(mesActual, anioActual);
  const cumplimientoQ = useCumplimientoSemanal(mesActual, anioActual);
  const tendenciaQ   = useTendencia(6);

  return (
    <div className="page">
      {/* Welcome header */}
      <div className="db-welcome">
        <div>
          <h1 className="page-title">{saludo}, {user.nombre}</h1>
          <p className="page-subtitle">Panel de control · Neurofic Clínica · {MESES_ES[mesActual]} {anioActual}</p>
        </div>
        {canViewReportes && (
          <Link to="/reportes" className="db-reportes-link">
            Reportes completos <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {canViewReportes && (
        <>
          {/* ── Hero card ── */}
          {kpisQ.isLoading ? (
            <HeroSkeleton />
          ) : kpisQ.isError ? (
            <div className="db-hero" style={{ borderTopColor: '#e2e8f0' }}>
              <ErrorState onRetry={() => void kpisQ.refetch()} />
            </div>
          ) : kpisQ.data ? (
            <HeroCard data={kpisQ.data} mesIdx={mesActual} anio={anioActual} />
          ) : null}

          {/* ── Charts row 1: Tendencia + Mix Pagador ── */}
          <div className="charts-row charts-row--2-1">
            <div className="chart-card">
              <h2 className="chart-title">Tendencia de Facturación — Últimos 6 Meses</h2>
              {tendenciaQ.isLoading ? <ChartSkeleton height={270} /> :
               tendenciaQ.isError   ? <ErrorState onRetry={() => void tendenciaQ.refetch()} /> :
               tendenciaQ.data      ? <ChartTendencia rows={tendenciaQ.data} /> : null}
            </div>
            <div className="chart-card">
              <h2 className="chart-title">Mix de Pagadores</h2>
              {entidadesQ.isLoading ? <ChartSkeleton height={270} /> :
               entidadesQ.isError   ? <ErrorState onRetry={() => void entidadesQ.refetch()} /> :
               entidadesQ.data?.rows.length
                 ? <ChartMixPagador rows={entidadesQ.data.rows} />
                 : <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: '0.85rem' }}>Sin datos</p>}
            </div>
          </div>

          {/* ── Charts row 2: Cumplimiento Semanal + Top Entidades ── */}
          <div className="charts-row charts-row--2-1">
            <div className="chart-card">
              <h2 className="chart-title">Cumplimiento Semanal — {MESES_ES[mesActual]}</h2>
              {cumplimientoQ.isLoading ? <ChartSkeleton /> :
               cumplimientoQ.isError   ? <ErrorState onRetry={() => void cumplimientoQ.refetch()} /> :
               cumplimientoQ.data      ? <ChartCumplimiento semanas={cumplimientoQ.data.semanas} /> : null}
            </div>
            <div className="chart-card">
              <h2 className="chart-title">Top Entidades del Mes</h2>
              {entidadesQ.isLoading ? <ChartSkeleton height={220} /> :
               entidadesQ.isError   ? <ErrorState onRetry={() => void entidadesQ.refetch()} /> :
               entidadesQ.data      ? <TopEntidades rows={entidadesQ.data.rows} /> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
