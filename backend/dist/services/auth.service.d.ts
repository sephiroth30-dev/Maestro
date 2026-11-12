import type { FastifyInstance } from 'fastify';
import type { LoginResponse, RefreshResponse, UsuarioPublico } from '../types/index.js';
/**
 * Margen para dos renovaciones simultáneas con el mismo token (dos pestañas
 * duplicadas, o una petición reintentada): la segunda llega con un token que la primera
 * acaba de revocar. Dentro de este margen se rechaza SOLO esa petición; fuera de él,
 * un token revocado que reaparece sí se trata como robo y revoca todas las sesiones.
 */
export declare const GRACIA_REUSO_MS = 10000;
export declare class AuthService {
    private readonly fastify;
    constructor(fastify: FastifyInstance);
    login(email: string, password: string): Promise<LoginResponse>;
    refresh(rawRefreshToken: string): Promise<RefreshResponse>;
    logout(rawRefreshToken: string): Promise<{
        usuarioId: string | null;
    }>;
    getMe(userId: string): Promise<UsuarioPublico>;
}
//# sourceMappingURL=auth.service.d.ts.map