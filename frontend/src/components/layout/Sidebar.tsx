import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart2,
  DollarSign,
  ClipboardList,
  FileUp,
  Users,
  Database,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import type { Rol } from '../../types/index.js';
import { ROL_LABELS } from '../../types/index.js';

// ─── Nav item config ──────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: Rol[];
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
      },
      {
        label: 'Reportes',
        to: '/reportes',
        icon: <BarChart2 size={18} />,
        roles: ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA'],
      },
      {
        label: 'Honorarios',
        to: '/honorarios',
        icon: <DollarSign size={18} />,
        roles: ['ADMIN', 'FACTURACION'],
        disabled: true,
      },
      {
        label: 'Auditoría',
        to: '/auditoria',
        icon: <ClipboardList size={18} />,
        roles: ['ADMIN', 'FACTURACION'],
        disabled: true,
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
        label: 'Usuarios',
        to: '/admin/usuarios',
        icon: <Users size={18} />,
        roles: ['ADMIN'],
        disabled: true,
      },
      {
        label: 'Fuentes de datos',
        to: '/admin/conectores',
        icon: <Database size={18} />,
        roles: ['ADMIN'],
      },
      {
        label: 'Configuración',
        to: '/admin/configuracion',
        icon: <Settings size={18} />,
        roles: ['ADMIN'],
        disabled: true,
      },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar(): React.ReactElement {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <></>;

  const userRol = user.rol as Rol;
  const initials = user.nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');

  const hasRole = (roles?: Rol[]): boolean => {
    if (!roles || roles.length === 0) return true;
    return roles.includes(userRol);
  };

  const isActive = (to: string): boolean => location.pathname === to;

  const sidebarContent = (
    <div className="sidebar-inner">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">N</div>
        <div className="sidebar-logo-text">
          <span className="sidebar-brand">Neurofic</span>
          <span className="sidebar-brand-sub">Admin Dashboard</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section, si) => {
          // Hide admin section for non-admins
          if (section.adminOnly && userRol !== 'ADMIN') return null;

          const visibleItems = section.items.filter((item) =>
            hasRole(item.roles)
          );
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
                    if (item.disabled) {
                      e.preventDefault();
                      return;
                    }
                    setMobileOpen(false);
                  }}
                  className={[
                    'sidebar-nav-item',
                    isActive(item.to) ? 'sidebar-nav-item--active' : '',
                    item.disabled ? 'sidebar-nav-item--disabled' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-disabled={item.disabled}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {item.disabled && (
                    <span className="sidebar-nav-soon">Pronto</span>
                  )}
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
          <div className="sidebar-user-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.nombre}</span>
            <span className="sidebar-user-rol">
              {ROL_LABELS[userRol] ?? userRol}
            </span>
          </div>
        </div>
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
      <aside
        className={`sidebar sidebar--mobile ${mobileOpen ? 'sidebar--open' : ''}`}
      >
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
    </>
  );
}
