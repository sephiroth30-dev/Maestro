// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Rol =
  | 'ADMIN'
  | 'GERENCIA'
  | 'DIRECCION'
  | 'FACTURACION'
  | 'COORDINADORA'
  | 'ADMISIONES'
  | 'RECURSOS_HUMANOS';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: User;
}

export interface RefreshResponse {
  accessToken: string;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}

// ─── Role Display Labels ──────────────────────────────────────────────────────

export const ROL_LABELS: Record<Rol, string> = {
  ADMIN: 'Administrador',
  GERENCIA: 'Gerencia',
  DIRECCION: 'Dirección',
  FACTURACION: 'Facturación',
  COORDINADORA: 'Coordinadora',
  ADMISIONES: 'Admisiones',
  RECURSOS_HUMANOS: 'Recursos Humanos',
};

// ─── Auditoría ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
  accion: string;
  entidadTipo: string | null;
  entidadId: string | null;
  detalle: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditoriaResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

// ─── Capacidad Instalada ──────────────────────────────────────────────────────

export interface CapacidadConfig {
  id: string;
  grupo: string;
  nombre: string;
  anio: number;
  mesIdx: number;
  capacidad: number;
  recursos: string | null;
}

export interface UtilizacionGrupo {
  grupo: string;
  nombre: string;
  capacidad: number | null;
  sesiones: number;
  pctOcupacion: number | null;
  disponible: number | null;
}
