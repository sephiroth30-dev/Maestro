import type { Rol } from '@prisma/client';
export interface UsuarioMapped {
    id: string;
    email: string;
    nombre: string;
    passwordHash: string;
    rol: Rol;
    activo: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface RefreshTokenMapped {
    id: string;
    tokenHash: string;
    usuarioId: string;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
}
export interface CreateRefreshTokenData {
    tokenHash: string;
    usuarioId: string;
    expiresAt: Date;
}
export declare class UsuariosRepository {
    findByEmail(email: string): Promise<UsuarioMapped | null>;
    findById(id: string): Promise<UsuarioMapped | null>;
    updateLastSeen(_id: string): Promise<void>;
    createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenMapped>;
    findRefreshToken(tokenHash: string): Promise<RefreshTokenMapped | null>;
    revokeRefreshToken(tokenHash: string): Promise<void>;
    revokeAllUserRefreshTokens(usuarioId: string): Promise<void>;
    deleteExpiredTokens(): Promise<number>;
    getUserRol(id: string): Promise<Rol | null>;
}
export declare const usuariosRepo: UsuariosRepository;
//# sourceMappingURL=usuarios.repo.d.ts.map