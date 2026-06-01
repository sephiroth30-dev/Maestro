import type { FastifyInstance } from 'fastify';
import type { LoginResponse, RefreshResponse, UsuarioPublico } from '../types/index.js';
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