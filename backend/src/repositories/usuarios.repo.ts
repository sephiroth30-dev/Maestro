import type { Usuario, Rol, RefreshToken } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export interface CreateRefreshTokenData {
  tokenHash: string;
  usuarioId: string;
  expiresAt: Date;
}

export class UsuariosRepository {
  async findByEmail(email: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({
      where: { email, activo: true, deletedAt: null },
    });
  }

  async findById(id: string): Promise<Usuario | null> {
    return prisma.usuario.findUnique({
      where: { id, activo: true, deletedAt: null },
    });
  }

  async updateLastSeen(_id: string): Promise<void> {
    // Reserved for future use: track last activity
  }

  async createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data: {
        tokenHash: data.tokenHash,
        usuarioId: data.usuarioId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(usuarioId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { usuarioId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }

  async getUserRol(id: string): Promise<Rol | null> {
    const user = await prisma.usuario.findUnique({
      where: { id, activo: true, deletedAt: null },
      select: { rol: true },
    });
    return user?.rol ?? null;
  }
}

export const usuariosRepo = new UsuariosRepository();
