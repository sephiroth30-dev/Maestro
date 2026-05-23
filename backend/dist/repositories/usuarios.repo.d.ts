import type { Usuario, Rol, RefreshToken } from '@prisma/client';
export interface CreateRefreshTokenData {
    tokenHash: string;
    usuarioId: string;
    expiresAt: Date;
}
export declare class UsuariosRepository {
    findByEmail(email: string): Promise<Usuario | null>;
    findById(id: string): Promise<Usuario | null>;
    updateLastSeen(_id: string): Promise<void>;
    createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshToken>;
    findRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
    revokeRefreshToken(tokenHash: string): Promise<void>;
    revokeAllUserRefreshTokens(usuarioId: string): Promise<void>;
    deleteExpiredTokens(): Promise<number>;
    getUserRol(id: string): Promise<Rol | null>;
}
export declare const usuariosRepo: UsuariosRepository;
//# sourceMappingURL=usuarios.repo.d.ts.map