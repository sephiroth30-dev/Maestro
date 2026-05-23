import type { Rol } from '@prisma/client';
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
export interface AuthenticatedUser {
    id: string;
    email: string;
    rol: Rol;
}
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
export interface HealthResponse {
    status: 'ok';
    timestamp: string;
    version: string;
}
export { Rol } from '@prisma/client';
//# sourceMappingURL=index.d.ts.map