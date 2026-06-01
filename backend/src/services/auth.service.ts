import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import type {
  LoginResponse,
  RefreshResponse,
  UsuarioPublico,
  JwtPayload,
} from '../types/index.js';
import { usuariosRepo } from '../repositories/usuarios.repo.js';
import { logger } from '../config/logger.js';

const REFRESH_TOKEN_BYTES = 64;
const BCRYPT_ROUNDS = 12;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}

function parseExpiry(expiresIn: string): Date {
  const now = new Date();
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);

  switch (unit) {
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'd':
      now.setDate(now.getDate() + value);
      break;
    default:
      // Assume seconds
      now.setSeconds(now.getSeconds() + parseInt(expiresIn, 10));
  }

  return now;
}

export class AuthService {
  constructor(private readonly fastify: FastifyInstance) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const usuario = await usuariosRepo.findByEmail(email);

    if (!usuario) {
      // Use constant-time comparison to prevent user enumeration
      await bcrypt.hash('dummy-password-for-timing', BCRYPT_ROUNDS);
      throw createUnauthorizedError('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordValid) {
      throw createUnauthorizedError('Invalid credentials');
    }

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };

    const accessToken = this.fastify.jwt.sign(payload);

    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = parseExpiry(
      process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d'
    );

    await usuariosRepo.createRefreshToken({
      tokenHash,
      usuarioId: usuario.id,
      expiresAt,
    });

    logger.info('User logged in', { userId: usuario.id, rol: usuario.rol });

    const usuarioPublico: UsuarioPublico = {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      modulos: usuario.modulos,
    };

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      usuario: usuarioPublico,
    };
  }

  async refresh(rawRefreshToken: string): Promise<RefreshResponse> {
    const tokenHash = hashToken(rawRefreshToken);
    const storedToken = await usuariosRepo.findRefreshToken(tokenHash);

    if (!storedToken) {
      throw createUnauthorizedError('Invalid refresh token');
    }

    if (storedToken.revokedAt !== null) {
      // Token reuse detected — revoke all tokens for this user
      await usuariosRepo.revokeAllUserRefreshTokens(storedToken.usuarioId);
      logger.warn('Refresh token reuse detected', {
        usuarioId: storedToken.usuarioId,
      });
      throw createUnauthorizedError('Refresh token has been revoked');
    }

    if (storedToken.expiresAt < new Date()) {
      throw createUnauthorizedError('Refresh token has expired');
    }

    const usuario = await usuariosRepo.findById(storedToken.usuarioId);
    if (!usuario) {
      throw createUnauthorizedError('User not found');
    }

    // Rotate refresh token
    await usuariosRepo.revokeRefreshToken(tokenHash);

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };

    const accessToken = this.fastify.jwt.sign(payload);

    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const expiresAt = parseExpiry(
      process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d'
    );

    await usuariosRepo.createRefreshToken({
      tokenHash: newTokenHash,
      usuarioId: usuario.id,
      expiresAt,
    });

    return { accessToken };
  }

  async logout(rawRefreshToken: string): Promise<{ usuarioId: string | null }> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await usuariosRepo.findRefreshToken(tokenHash);
    await usuariosRepo.revokeRefreshToken(tokenHash);
    logger.info('User logged out', { tokenHash: tokenHash.slice(0, 8) + '...' });
    return { usuarioId: stored?.usuarioId ?? null };
  }

  async getMe(userId: string): Promise<UsuarioPublico> {
    const usuario = await usuariosRepo.findById(userId);
    if (!usuario) {
      throw createNotFoundError('User not found');
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      modulos: usuario.modulos,
    };
  }
}

function createUnauthorizedError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 401;
  return error;
}

function createNotFoundError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = 404;
  return error;
}
