import type { Rol } from '@prisma/client';
export interface UsuarioMapped {
    id: string;
    email: string;
    nombre: string;
    passwordHash: string;
    rol: Rol;
    modulos: string[];
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
    /** `expires_at` ya pasó (comparado en SQL contra UTC: así se guarda). */
    vencido: boolean;
    /** Se revocó hace menos de la gracia: una renovación simultánea, no un robo. */
    revocadoReciente: boolean;
}
export interface CreateRefreshTokenData {
    tokenHash: string;
    usuarioId: string;
    expiresAt: Date;
}
export interface CreateUsuarioData {
    nombre: string;
    email: string;
    passwordHash: string;
    rol: Rol;
    modulos?: string[];
}
export interface UpdateUsuarioData {
    nombre?: string;
    email?: string;
    rol?: Rol;
    modulos?: string[];
    activo?: boolean;
}
export declare class UsuariosRepository {
    findByEmail(email: string): Promise<UsuarioMapped | null>;
    findById(id: string): Promise<UsuarioMapped | null>;
    updateLastSeen(_id: string): Promise<void>;
    createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenMapped>;
    /**
     * `vencido` y `revocado_reciente` se calculan EN SQL a propósito. El pool devuelve las
     * fechas como TEXTO (`dateStrings: true`): `new Date('2026-11-12 10:00:00')` se
     * interpreta en la zona de Node y `texto < Date` da siempre `false`, de modo que la
     * caducidad nunca se aplicaba. `expires_at` se escribe en UTC (zona del pool) y se
     * compara con `UTC_TIMESTAMP()`; `revoked_at` lo escribe `NOW()` y se compara con `NOW()`.
     */
    findRefreshToken(tokenHash: string, graciaSegundos?: number): Promise<RefreshTokenMapped | null>;
    /**
     * Revoca un token. Devuelve `true` solo si ESTA llamada lo revocó: con dos
     * renovaciones simultáneas, el `UPDATE ... WHERE revoked_at IS NULL` lo gana una sola,
     * y la otra no debe seguir emitiendo un token nuevo.
     */
    revokeRefreshToken(tokenHash: string): Promise<boolean>;
    revokeAllUserRefreshTokens(usuarioId: string): Promise<void>;
    deleteExpiredTokens(): Promise<number>;
    getUserRol(id: string): Promise<Rol | null>;
    listAll(): Promise<UsuarioMapped[]>;
    findByEmailExcluding(email: string, excludeId: string): Promise<UsuarioMapped | null>;
    create(data: CreateUsuarioData): Promise<UsuarioMapped>;
    update(id: string, data: UpdateUsuarioData): Promise<void>;
    updatePassword(id: string, passwordHash: string): Promise<void>;
    softDelete(id: string): Promise<void>;
}
export declare const usuariosRepo: UsuariosRepository;
//# sourceMappingURL=usuarios.repo.d.ts.map