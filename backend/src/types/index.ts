import type { Rol } from '@prisma/client';

// ─── Auth Types ───────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  rol: Rol;
  iat?: number;
  exp?: number;
}

export interface UsuarioPublico {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  modulos: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: UsuarioPublico;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}

// ─── Extended Fastify Types ───────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  email: string;
  rol: Rol;
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export interface AppError extends Error {
  statusCode: number;
  code?: string;
}

export interface ErrorResponse {
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

// ─── Re-export Prisma enums ───────────────────────────────────────────────────

export { Rol } from '@prisma/client';
