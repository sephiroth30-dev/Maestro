import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { User, Shield, Activity, Database } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ROL_LABELS } from '../types/index.js';

export default function Dashboard(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const rolLabel = ROL_LABELS[user.rol] ?? user.rol;
  const isAdmin = user.rol === 'ADMIN';

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

      {/* Stage placeholder */}
      <div className="dashboard-placeholder">
        <div className="dashboard-placeholder-inner">
          <Activity size={48} className="dashboard-placeholder-icon" />
          <h2 className="dashboard-placeholder-title">
            KPIs en construcción
          </h2>
          <p className="dashboard-placeholder-text">
            Los módulos de KPIs, gráficas y reportes se agregarán en las
            siguientes etapas del proyecto.
          </p>
          <div className="dashboard-placeholder-badge">
            Stage 2 — Connector Layer
          </div>
        </div>
      </div>
    </div>
  );
}
