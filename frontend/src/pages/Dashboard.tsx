import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Activity, DollarSign, Target, Users, BarChart2, PieChart } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useKpis, useEntidades } from '../api/reportes.js';
import KpiCard from '../components/widgets/KpiCard.js';
import ChartMixPagador from '../components/widgets/ChartMixPagador.js';

export default function Dashboard(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const canViewReportes = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'].includes(user.rol);

  const now = new Date();
  const mesActual = now.getMonth() + 1;
  const anioActual = now.getFullYear();

  const kpisQ = useKpis(mesActual, anioActual);
  const entidadesQ = useEntidades(mesActual, anioActual);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bienvenido, {user.nombre}</h1>
          <p className="page-subtitle">Panel de control — Neurofic Clínica</p>
        </div>
      </div>

      {canViewReportes && (
        <>
          {/* ── KPI cards ── */}
          <div className="dashboard-kpi-section">
            <div className="dashboard-kpi-header">
              <h2 className="section-title">KPIs del Mes Actual</h2>
              <Link to="/reportes" className="dashboard-kpi-link">
                Ver reportes completos →
              </Link>
            </div>

            {kpisQ.isLoading ? (
              <div className="kpi-grid kpi-grid--4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="kpi-card kpi-card--blue animate-pulse">
                    <div className="kpi-skeleton-title" />
                    <div className="kpi-skeleton-value" />
                    <div className="kpi-skeleton-bar" />
                  </div>
                ))}
              </div>
            ) : kpisQ.isError ? (
              <div className="dashboard-kpi-error">
                <Activity size={20} />
                <span>No se pudo cargar la información de KPIs.</span>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => void kpisQ.refetch()}
                >
                  Reintentar
                </button>
              </div>
            ) : kpisQ.data ? (
              <div className="kpi-grid kpi-grid--4">
                <KpiCard
                  titulo="Facturación Bruta"
                  valor={kpisQ.data.facturacion_bruta}
                  formato="currency"
                  meta={kpisQ.data.presupuesto}
                  metaLabel="Meta"
                  icon={<DollarSign size={16} />}
                  color="blue"
                />
                <KpiCard
                  titulo="Cumplimiento"
                  valor={kpisQ.data.cumplimiento_pct}
                  formato="percent"
                  meta={100}
                  icon={<Target size={16} />}
                  color={kpisQ.data.cumplimiento_pct >= 100 ? 'green' : kpisQ.data.cumplimiento_pct >= 80 ? 'amber' : 'rose'}
                />
                <KpiCard
                  titulo="Atenciones"
                  valor={kpisQ.data.atenciones}
                  formato="number"
                  icon={<Users size={16} />}
                  color="purple"
                />
                <KpiCard
                  titulo="Ticket Promedio"
                  valor={kpisQ.data.ticket_promedio}
                  formato="currency"
                  icon={<BarChart2 size={16} />}
                  color="amber"
                />
              </div>
            ) : null}
          </div>

          {/* ── Mix chart ── */}
          <div className="dashboard-mix-section">
            <div className="dashboard-kpi-header">
              <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PieChart size={18} />
                Mix de Facturación por Tipo
              </h2>
              <Link to="/reportes" className="dashboard-kpi-link">
                Detalle por entidad →
              </Link>
            </div>

            {entidadesQ.isLoading ? (
              <div className="dashboard-mix-skeleton animate-pulse" />
            ) : entidadesQ.isError || !entidadesQ.data?.rows.length ? (
              <div className="dashboard-mix-empty">
                <PieChart size={32} style={{ color: '#cbd5e1' }} />
                <p>Sin datos para el mes actual</p>
              </div>
            ) : (
              <div className="dashboard-mix-card">
                <ChartMixPagador rows={entidadesQ.data.rows} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
