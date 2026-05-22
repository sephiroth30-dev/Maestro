import React from 'react';
import { Navigate } from 'react-router-dom';
import { LogOut, User, Shield, Activity } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { ROL_LABELS } from '../types/index.js';

export default function Dashboard(): React.ReactElement {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const rolLabel = ROL_LABELS[user.rol] ?? user.rol;

  return (
    <div className="dashboard-page">
      {/* Top navigation bar */}
      <header className="dashboard-header">
        <div className="dashboard-header-brand">
          <div className="dashboard-logo">N</div>
          <span className="dashboard-brand-name">Neurofic Admin</span>
        </div>

        <div className="dashboard-header-actions">
          <div className="dashboard-user-info">
            <div className="dashboard-user-avatar" aria-hidden="true">
              {user.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="dashboard-user-details">
              <span className="dashboard-user-name">{user.nombre}</span>
              <span className="dashboard-user-rol">{rolLabel}</span>
            </div>
          </div>

          <button
            type="button"
            className="dashboard-logout-btn"
            onClick={logout}
            title="Cerrar sesión"
          >
            <LogOut size={18} aria-hidden="true" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <h1 className="dashboard-welcome-title">
            Bienvenido, {user.nombre}
          </h1>
          <p className="dashboard-welcome-subtitle">
            Panel de administración — Neurofic Clínica
          </p>
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

        {/* Stage placeholder */}
        <div className="dashboard-placeholder">
          <div className="dashboard-placeholder-inner">
            <Activity size={48} className="dashboard-placeholder-icon" />
            <h2 className="dashboard-placeholder-title">
              Dashboard en construcción
            </h2>
            <p className="dashboard-placeholder-text">
              Los módulos de KPIs, gráficas y conectores se agregarán en las
              siguientes etapas del proyecto.
            </p>
            <div className="dashboard-placeholder-badge">
              Stage 1 — Foundation
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
