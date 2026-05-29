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
import Login from './pages/Login.js';
import Dashboard from './pages/Dashboard.js';
import Reportes from './pages/Reportes.js';
import { Conectores, Configuracion, Usuarios, CapacidadConfig } from './pages/Admin/index.js';
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

// ─── Admin Route (ADMIN role only) ───────────────────────────────────────────

function AdminRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.rol !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Reportes Route (all roles except ADMISIONES) ────────────────────────────

const REPORTES_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA'] as const;

function ReportesRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !(REPORTES_ROLES as readonly string[]).includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Capacidad Route (ADMIN + GERENCIA + DIRECCION + FACTURACION) ────────────

const CAPACIDAD_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION'] as const;

function CapacidadRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !(CAPACIDAD_ROLES as readonly string[]).includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Auditoria Route (ADMIN + FACTURACION) ────────────────────────────────────

const AUDITORIA_ROLES = ['ADMIN', 'FACTURACION'] as const;

function AuditoriaRoute({ children }: { children: ReactElement }): ReactElement {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !(AUDITORIA_ROLES as readonly string[]).includes(user.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// ─── Authenticated layout (with sidebar) ─────────────────────────────────────

function AppLayout({ children }: { children: ReactElement }): ReactElement {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">{children}</div>
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
              <ReportesRoute>
                <AppLayout>
                  <Honorarios />
                </AppLayout>
              </ReportesRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/conectores"
            element={
              <AdminRoute>
                <AppLayout>
                  <Conectores />
                </AppLayout>
              </AdminRoute>
            }
          />

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

          <Route
            path="/admin/usuarios"
            element={
              <AdminRoute>
                <AppLayout>
                  <Usuarios />
                </AppLayout>
              </AdminRoute>
            }
          />

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

          {/* Admin — Capacidad config */}
          <Route
            path="/admin/capacidad"
            element={
              <AdminRoute>
                <AppLayout>
                  <CapacidadConfig />
                </AppLayout>
              </AdminRoute>
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
