import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { User, Shield, Activity, Database, DollarSign, Target, Users, BarChart2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ROL_LABELS } from '../types/index.js';
import { useKpis } from '../api/reportes.js';
import KpiCard from '../components/widgets/KpiCard.js';

export default function Dashboard(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const rolLabel = ROL_LABELS[user.rol] ?? user.rol;
  const isAdmin = user.rol === 'ADMIN';
  const canViewReportes = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'].includes(user.rol);

  // Current month KPIs
  const now = new Date();
  const kpisQ = useKpis(now.getMonth() + 1, now.getFullYear());

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bienvenido, {user.nombre}</h1>
          <p className="page-subtitle">
            Panel de administración — Neurofic Clínica
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="dashboard-card-icon dashboard-card-icon--blue">
            <User size={24} />
          </div>
          <div className="dashboard-card-content">
            <h3 className="dashboard-card-label">Usuario</h3>
            <p className="dashboard-card-value">{user.nombre}</p>
            <p className="dashboard-card-meta">{user.email}</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon dashboard-card-icon--green">
            <Shield size={24} />
          </div>
          <div className="dashboard-card-content">
            <h3 className="dashboard-card-label">Rol</h3>
            <p className="dashboard-card-value">{rolLabel}</p>
            <p className="dashboard-card-meta">Acceso asignado</p>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon dashboard-card-icon--purple">
            <Activity size={24} />
          </div>
          <div className="dashboard-card-content">
            <h3 className="dashboard-card-label">Estado</h3>
            <p className="dashboard-card-value">Activo</p>
            <p className="dashboard-card-meta">Sesión iniciada</p>
          </div>
        </div>
      </div>

      {/* Admin quick access */}
      {isAdmin && (
        <div className="admin-quick-access">
          <h2 className="section-title">Administración</h2>
          <div className="admin-quick-grid">
            <Link to="/admin/conectores" className="admin-quick-card">
              <div className="admin-quick-icon">
                <Database size={28} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="admin-quick-label">Fuentes de datos</h3>
                <p className="admin-quick-desc">
                  Gestiona conectores de Google Sheets, APIs y más
                </p>
              </div>
              <Activity size={16} className="admin-quick-arrow text-slate-400" />
            </Link>
          </div>
        </div>
      )}

      {/* KPI Preview — current month */}
      {canViewReportes && (
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
      )}
    </div>
  );
}
