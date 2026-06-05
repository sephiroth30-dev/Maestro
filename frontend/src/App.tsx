import { type ReactElement } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore.js';
import { useAuth } from './hooks/useAuth.js';
import { useInactivityLogout } from './hooks/useInactivityLogout.js';
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Reportes from './pages/Reportes.js';
import { Configuracion } from './pages/Admin/index.js';
import Honorarios from './pages/Honorarios.js';
import Auditoria from './pages/Auditoria.js';
import Capacidad from './pages/Capacidad.js';
import Sidebar from './components/layout/Sidebar.js';

// ─── React Query client ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// ─── Protected Route ──────────────────────────────────────────────────────────

function ProtectedRoute({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// ─── Module-aware route guard helper ─────────────────────────────────────────

function hasModuleAccess(user: { rol: string; modulos?: string[] } | null, modulo: string, fallbackRoles: readonly string[]): boolean {
  if (!user) return false;
  if (user.modulos && user.modulos.length > 0) {
    return user.modulos.includes(modulo) || user.modulos.includes('configuracion');
  }
  return fallbackRoles.includes(user.rol);
}

// ─── Admin Route (ADMIN role only) ───────────────────────────────────────────

function AdminRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasModuleAccess(user, 'configuracion', ['ADMIN'])) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Reportes Route ───────────────────────────────────────────────────────────

const REPORTES_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA', 'ADMISIONES'] as const;

function ReportesRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasModuleAccess(user, 'reportes', REPORTES_ROLES)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Honorarios Route (includes RECURSOS_HUMANOS) ────────────────────────────

const HONORARIOS_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'RECURSOS_HUMANOS'] as const;

function HonorariosRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasModuleAccess(user, 'honorarios', HONORARIOS_ROLES)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Capacidad Route ──────────────────────────────────────────────────────────

const CAPACIDAD_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'] as const;

function CapacidadRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasModuleAccess(user, 'capacidad', CAPACIDAD_ROLES)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Auditoria Route ──────────────────────────────────────────────────────────

const AUDITORIA_ROLES = ['ADMIN', 'FACTURACION'] as const;

function AuditoriaRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasModuleAccess(user, 'auditoria', AUDITORIA_ROLES)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Inactivity warning modal ─────────────────────────────────────────────────

function InactivityWarningModal({
  secondsLeft,
  onContinue,
}: {
  secondsLeft: number;
  onContinue: () => void;
}): ReactElement {
  const urgent = secondsLeft <= 10;
  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal modal--sm" role="alertdialog" aria-modal="true" aria-label="Sesión por expirar">
        <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 2rem 1.5rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: urgent ? '#fef2f2' : '#fffbeb',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            fontSize: 28,
          }}>
            ⏱
          </div>
          <h2 className="modal-title" style={{ marginBottom: '0.5rem' }}>
            ¿Sigues ahí?
          </h2>
          <p className="modal-subtitle">
            Tu sesión cerrará por inactividad en
          </p>
          <div style={{
            fontSize: 48,
            fontWeight: 800,
            color: urgent ? '#dc2626' : '#f59e0b',
            lineHeight: 1.1,
            margin: '0.75rem 0',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {secondsLeft}s
          </div>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 1.5rem' }}>
            Mueve el mouse o haz clic en el botón para continuar
          </p>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={onContinue}
            autoFocus
          >
            Seguir en sesión
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Authenticated layout (with sidebar + inactivity guard) ──────────────────

function AppLayout({ children }: { children: ReactElement }): ReactElement {
  const { showWarning, secondsLeft, resetTimer } = useInactivityLogout();
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">{children}</div>
      {showWarning && (
        <InactivityWarningModal secondsLeft={secondsLeft} onContinue={resetTimer} />
      )}
    </div>
  );
}

// ─── Public Route (redirect if already authenticated) ────────────────────────

function PublicRoute({ children }: { children: ReactElement }): ReactElement {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Public routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Reportes route */}
          <Route
            path="/reportes"
            element={
              <ReportesRoute>
                <AppLayout>
                  <Reportes />
                </AppLayout>
              </ReportesRoute>
            }
          />

          {/* Honorarios route */}
          <Route
            path="/honorarios"
            element={
              <HonorariosRoute>
                <AppLayout>
                  <Honorarios />
                </AppLayout>
              </HonorariosRoute>
            }
          />

          {/* Admin — Configuración (contains Usuarios, Capacidad, Honorarios, Fuentes) */}
          <Route
            path="/admin/configuracion"
            element={
              <AdminRoute>
                <AppLayout>
                  <Configuracion />
                </AppLayout>
              </AdminRoute>
            }
          />

          {/* Legacy admin routes → redirect to Configuración */}
          <Route path="/admin/conectores"          element={<Navigate to="/admin/configuracion" replace />} />
          <Route path="/admin/usuarios"            element={<Navigate to="/admin/configuracion" replace />} />
          <Route path="/admin/capacidad"           element={<Navigate to="/admin/configuracion" replace />} />
          <Route path="/admin/reglas-honorarios"   element={<Navigate to="/admin/configuracion" replace />} />

          {/* Capacidad route */}
          <Route
            path="/capacidad"
            element={
              <CapacidadRoute>
                <AppLayout>
                  <Capacidad />
                </AppLayout>
              </CapacidadRoute>
            }
          />

          {/* Auditoria route */}
          <Route
            path="/auditoria"
            element={
              <AuditoriaRoute>
                <AppLayout>
                  <Auditoria />
                </AppLayout>
              </AuditoriaRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
