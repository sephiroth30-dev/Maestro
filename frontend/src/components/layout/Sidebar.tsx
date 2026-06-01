import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart2,
  DollarSign,
  ClipboardList,
  FileUp,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import type { Rol } from '../../types/index.js';
import { ROL_LABELS } from '../../types/index.js';
import ChangePasswordModal from '../ChangePasswordModal.js';
import NeuroficLogo from '../../assets/NeuroficLogo.js';

// ─── Nav item config ──────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: Rol[];
  modulo?: string;
  disabled?: boolean;
}

interface NavSection {
  title?: string;
  adminOnly?: boolean;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        label: 'Dashboard',
        to: '/dashboard',
        icon: <LayoutDashboard size={18} />,
        modulo: 'dashboard',
      },
      {
        label: 'Reportes',
        to: '/reportes',
        icon: <BarChart2 size={18} />,
        modulo: 'reportes',
        roles: ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA', 'ADMISIONES'],
      },
      {
        label: 'Honorarios',
        to: '/honorarios',
        icon: <DollarSign size={18} />,
        modulo: 'honorarios',
        roles: ['ADMIN', 'FACTURACION', 'GERENCIA', 'DIRECCION', 'RECURSOS_HUMANOS'],
      },
      {
        label: 'Capacidad',
        to: '/capacidad',
        icon: <BarChart2 size={18} />,
        modulo: 'capacidad',
        roles: ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'],
        disabled: false,
      },
      {
        label: 'Auditoría',
        to: '/auditoria',
        icon: <ClipboardList size={18} />,
        modulo: 'auditoria',
        roles: ['ADMIN', 'FACTURACION'],
        disabled: false,
      },
      {
        label: 'Importaciones',
        to: '/importaciones',
        icon: <FileUp size={18} />,
        roles: ['ADMIN', 'FACTURACION'],
        disabled: true,
      },
    ],
  },
  {
    title: 'Admin',
    adminOnly: true,
    items: [
      {
        label: 'Configuración',
        to: '/admin/configuracion',
        icon: <Settings size={18} />,
        modulo: 'configuracion',
        roles: ['ADMIN'],
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar(): React.ReactElement {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  if (!user) return <></>;

  const userRol = user.rol as Rol;
  const avatarInitials = user.nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');

  const hasAccess = (item: NavItem): boolean => {
    if (item.disabled) return true; // disabled items always shown (greyed out)
    const mods = user.modulos;
    if (mods && mods.length > 0 && item.modulo) {
      return mods.includes(item.modulo) || mods.includes('configuracion');
    }
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(userRol);
  };

  const isActive = (to: string): boolean => location.pathname === to;

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <NeuroficLogo size={32} />
        </div>
        <div className="sidebar-logo-text">
          <span className="sidebar-brand">Neurofic</span>
          <span className="sidebar-brand-sub">Admin Dashboard</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section, si) => {
          if (section.adminOnly && userRol !== 'ADMIN' && !user.modulos?.includes('configuracion')) return null;

          const visibleItems = section.items.filter((item) => hasAccess(item));
          if (visibleItems.length === 0) return null;

          return (
            <div key={si} className="sidebar-section">
              {section.title && (
                <div className="sidebar-section-title">{section.title}</div>
              )}
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.disabled ? '#' : item.to}
                  onClick={(e) => {
                    if (item.disabled) { e.preventDefault(); return; }
                    setMobileOpen(false);
                  }}
                  className={[
                    'sidebar-nav-item',
                    isActive(item.to) ? 'sidebar-nav-item--active' : '',
                    item.disabled ? 'sidebar-nav-item--disabled' : '',
                  ].filter(Boolean).join(' ')}
                  aria-disabled={item.disabled}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {item.disabled && <span className="sidebar-nav-soon">Pronto</span>}
                  {!item.disabled && isActive(item.to) && (
                    <ChevronRight size={14} className="sidebar-nav-chevron" />
                  )}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-avatar">{avatarInitials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.nombre}</span>
            <span className="sidebar-user-rol">
              {user.modulos && user.modulos.length > 0
                ? user.modulos.filter(m => m !== 'dashboard' && m !== 'aprobar').join(' · ')
                : (ROL_LABELS[userRol] ?? userRol)}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => setShowChangePwd(true)}
            title="Cambiar contraseña"
          >
            <KeyRound size={15} />
          </button>
          <button
            type="button"
            className="sidebar-logout"
            onClick={logout}
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
      {/* Version tag */}
      <div style={{ padding: '4px 16px 8px', fontSize: '10px', color: '#94a3b8', textAlign: 'center', letterSpacing: '0.04em' }}>
        v{__APP_VERSION__}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sidebar sidebar--desktop">{sidebarContent}</aside>

      {/* Mobile hamburger button */}
      <button
        type="button"
        className="sidebar-mobile-toggle"
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        />
      )}

      {/* Mobile drawer */}
      <aside className={`sidebar sidebar--mobile ${mobileOpen ? 'sidebar--open' : ''}`}>
        <button
          type="button"
          className="sidebar-mobile-close"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        >
          <X size={20} />
        </button>
        {sidebarContent}
      </aside>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  );
}
