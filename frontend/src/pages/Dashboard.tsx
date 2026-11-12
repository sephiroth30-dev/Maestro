import React, { useMemo, useRef } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, MonitorPlay, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useKpis, useEntidades, useTendencia, useAgenda } from '../api/reportes.js';
import type { KpisResult, AgendaResult } from '../api/reportes.js';
import { PROYECCION_AGENDA } from '../config/features.js';
import { formatNumber } from '../components/widgets/KpiCard.js';
import ChartMixPagador from '../components/widgets/ChartMixPagador.js';
import ChartTendencia from '../components/widgets/ChartTendencia.js';
import ChartCumplimientoMensual from '../components/widgets/ChartCumplimientoMensual.js';
import TopEntidades from '../components/widgets/TopEntidades.js';
import { ExportButton } from '../export/index.js';
import { HelpButton } from '../help/HelpButton.js';
import { buildDashboardDoc } from '../export/docs/dashboardDoc.js';

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

function HeroCard({ data, mesIdx, anio, agenda }: { data: KpisResult; mesIdx: number; anio: number; agenda?: AgendaResult }): React.ReactElement {
  const pct     = data.cumplimiento_pct;
  const accent  = accentColor(pct);
  const status  = statusInfo(pct);
  const fillPct = Math.min(pct, 100);

  // Hay DOS cifras y conviene verlas juntas:
  //  · por ritmo: supone que los días que faltan se parecerán a los pasados;
  //  · atendido + agendado: suma lo que realmente está agendado.
  // Si difieren mucho, esa diferencia ya es información.
  //
  // «Atendido + agendado» es un PISO, no una proyección: solo cuenta lo que ya
  // está en la agenda. Si la agenda no llega a fin de mes, o hay citas sin precio
  // de referencia, queda por debajo de lo que realmente se facturará; por eso
  // (a) se avisa, y (b) en esos casos NO manda sobre la barra, que sigue usando
  // la proyección por ritmo. Un administrativo que lee «vamos a 45 %» el día 5
  // solo porque la agenda llega hasta el 12 tomaría una decisión equivocada.
  const hayAgenda = agenda !== undefined && agenda.total.citas > 0;
  const proyAgenda = hayAgenda ? data.facturacion_bruta + agenda.total.valor : 0;
  const projPctAgenda = hayAgenda && data.presupuesto > 0 ? (proyAgenda / data.presupuesto) * 100 : null;
  const finDeMes = `${anio}-${String(mesIdx).padStart(2, '0')}-${String(new Date(anio, mesIdx, 0).getDate()).padStart(2, '0')}`;
  const agendaCompleta = hayAgenda && agenda.horizonte !== null && agenda.horizonte >= finDeMes && agenda.total.citas_sin_valor === 0;
  const projPct = agendaCompleta && projPctAgenda !== null ? projPctAgenda : data.proyeccion_cumplimiento_pct;
  const avisoAgenda = !hayAgenda || agendaCompleta ? null
    : agenda.total.citas_sin_valor > 0
      ? `${agenda.total.citas_sin_valor.toLocaleString('es-CO')} citas sin precio de referencia`
      : agenda.horizonte
        ? `agenda cargada solo hasta el ${agenda.horizonte.slice(8, 10)}/${agenda.horizonte.slice(5, 7)}`
        : null;

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
          {hayAgenda ? (
            // Con agenda. La línea de la agenda va SIEMPRE (también el último día
            // hábil, cuando ya no quedan «días restantes» pero sí citas de hoy).
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#4338ca' }}
                title={`Atendido más ${agenda.total.citas.toLocaleString('es-CO')} citas pendientes valoradas con lo facturado antes a cada EPS. Es lo que ya está agendado, no una proyección completa.`}
              >
                <TrendingUp size={12} />
                Atendido + agendado: {fmtShort(proyAgenda)}{projPctAgenda !== null && ` (${projPctAgenda.toFixed(1)}%)`}
              </span>
              {avisoAgenda && (
                <span style={{ fontSize: '0.7rem', color: '#b45309' }}>⚠ {avisoAgenda}</span>
              )}
              {data.dias_restantes > 0 && (
                <span style={{ opacity: 0.75 }} title="Supone que los días que faltan se parecerán a los ya transcurridos">
                  Por ritmo: {fmtShort(data.proyeccion_cierre)} ({data.proyeccion_cumplimiento_pct.toFixed(1)}%)
                </span>
              )}
            </span>
          ) : (
            // Sin agenda: exactamente lo de siempre.
            data.dias_restantes > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingUp size={12} style={{ color: projPct >= 100 ? '#22c55e' : '#94a3b8' }} />
                Proyección cierre: {fmtShort(data.proyeccion_cierre)} ({projPct.toFixed(1)}%)
              </span>
            )
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
  const navigate = useNavigate();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const canViewReportes = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA', 'ADMISIONES'].includes(user.rol);
  // ADMISIONES queda fuera: el resumen de la TV incluye presupuesto y proyección.
  const canViewTv = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA'].includes(user.rol);

  const now = new Date();
  const mesActual  = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  const hora   = now.getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';

  // Annual date range: Jan 1 → last day of current month
  const lastDay = new Date(anioActual, mesActual, 0).getDate();
  const startDate = `${anioActual}-01-01`;
  const endDate   = `${anioActual}-${String(mesActual).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const kpisQ        = useKpis(mesActual, anioActual);
  // Apagada hasta que exista el endpoint: ver `config/features.ts`.
  const agendaQ      = useAgenda(mesActual, anioActual, undefined, undefined, undefined, undefined, PROYECCION_AGENDA);
  const entidadesAnioQ = useEntidades(mesActual, anioActual, startDate, endDate);
  const tendenciaQ   = useTendencia(12);

  // ── Exportación ────────────────────────────────────────────────────────────
  const refTendencia = useRef<HTMLDivElement>(null);
  const refMix       = useRef<HTMLDivElement>(null);

  const tendenciaAnio = useMemo(
    () => (tendenciaQ.data ?? []).filter((r) => r.anio === anioActual).sort((a, b) => a.mesIdx - b.mesIdx),
    [tendenciaQ.data, anioActual],
  );

  const buildExportDoc = useMemo(() => () => buildDashboardDoc({
    anio: anioActual,
    mesActual,
    mesNombre: MESES_ES[mesActual] ?? '',
    kpis: kpisQ.data,
    tendencia: tendenciaAnio,
    entidades: entidadesAnioQ.data?.rows ?? [],
    getChartTendencia: () => refTendencia.current,
    getChartMix: () => refMix.current,
  }), [anioActual, mesActual, kpisQ.data, tendenciaAnio, entidadesAnioQ.data]);

  return (
    <div className="page">
      {/* Welcome header */}
      <div className="db-welcome">
        <div>
          <h1 className="page-title">{saludo}, {user.nombre}</h1>
          <p className="page-subtitle">Panel de control · Neurofic Clínica · {MESES_ES[mesActual]} {anioActual}</p>
        </div>
        {canViewReportes && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HelpButton articulo="dashboard" />
            {canViewTv && (
              <button
                type="button"
                className="db-reportes-link"
                data-testid="btn-modo-tv"
                title="Pantalla completa para el monitor de la oficina"
                onClick={() => {
                  // El permiso de pantalla completa exige un gesto del usuario: se pide aquí, en el clic.
                  void document.documentElement.requestFullscreen?.().catch(() => undefined);
                  navigate('/tv');
                }}
              >
                <MonitorPlay size={14} /> Modo TV
              </button>
            )}
            <ExportButton buildDoc={buildExportDoc} disabled={kpisQ.isLoading} />
            <Link to="/reportes" className="db-reportes-link">
              Reportes completos <ArrowRight size={14} />
            </Link>
          </div>
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
            <HeroCard data={kpisQ.data} mesIdx={mesActual} anio={anioActual} agenda={agendaQ.data} />
          ) : null}

          {/* ── Charts row 1: Tendencia + Mix Pagador ── */}
          <div className="charts-row charts-row--2-1">
            <div className="chart-card" ref={refTendencia}>
              <h2 className="chart-title">Tendencia de Facturación — Año {anioActual}</h2>
              {tendenciaQ.isLoading ? <ChartSkeleton height={270} /> :
               tendenciaQ.isError   ? <ErrorState onRetry={() => void tendenciaQ.refetch()} /> :
               tendenciaQ.data      ? <ChartTendencia rows={tendenciaQ.data} /> : null}
            </div>
            <div className="chart-card" ref={refMix}>
              <h2 className="chart-title">Mix de Pagadores — Año {anioActual}</h2>
              {entidadesAnioQ.isLoading ? <ChartSkeleton height={270} /> :
               entidadesAnioQ.isError   ? <ErrorState onRetry={() => void entidadesAnioQ.refetch()} /> :
               entidadesAnioQ.data?.rows.length
                 ? <ChartMixPagador rows={entidadesAnioQ.data.rows} />
                 : <p style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: '0.85rem' }}>Sin datos</p>}
            </div>
          </div>

          {/* ── Charts row 2: Cumplimiento Mensual + Top Entidades ── */}
          <div className="charts-row charts-row--2-1">
            <div className="chart-card">
              <h2 className="chart-title">Cumplimiento Mensual — Año {anioActual}</h2>
              {tendenciaQ.isLoading ? <ChartSkeleton /> :
               tendenciaQ.isError   ? <ErrorState onRetry={() => void tendenciaQ.refetch()} /> :
               tendenciaQ.data      ? <ChartCumplimientoMensual rows={tendenciaQ.data} /> : null}
            </div>
            <div className="chart-card">
              <h2 className="chart-title">Top Entidades — Año {anioActual}</h2>
              {entidadesAnioQ.isLoading ? <ChartSkeleton height={220} /> :
               entidadesAnioQ.isError   ? <ErrorState onRetry={() => void entidadesAnioQ.refetch()} /> :
               entidadesAnioQ.data      ? <TopEntidades rows={entidadesAnioQ.data.rows} /> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
