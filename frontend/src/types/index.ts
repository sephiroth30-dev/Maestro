// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Rol =
  | 'ADMIN'
  | 'GERENCIA'
  | 'DIRECCION'
  | 'FACTURACION'
  | 'COORDINADORA'
  | 'ADMISIONES';

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
};
