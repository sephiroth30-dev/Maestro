"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const usuarios_repo_js_1 = require("../repositories/usuarios.repo.js");
const logger_js_1 = require("../config/logger.js");
const REFRESH_TOKEN_BYTES = 64;
const BCRYPT_ROUNDS = 12;
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
function generateRefreshToken() {
    return crypto_1.default.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
}
function parseExpiry(expiresIn) {
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
class AuthService {
    fastify;
    constructor(fastify) {
        this.fastify = fastify;
    }
    async login(email, password) {
        const usuario = await usuarios_repo_js_1.usuariosRepo.findByEmail(email);
        if (!usuario) {
            // Use constant-time comparison to prevent user enumeration
            await bcryptjs_1.default.hash('dummy-password-for-timing', BCRYPT_ROUNDS);
            throw createUnauthorizedError('Invalid credentials');
        }
        const passwordValid = await bcryptjs_1.default.compare(password, usuario.passwordHash);
        if (!passwordValid) {
            throw createUnauthorizedError('Invalid credentials');
        }
        const payload = {
            sub: usuario.id,
            email: usuario.email,
            rol: usuario.rol,
        };
        const accessToken = this.fastify.jwt.sign(payload);
        const rawRefreshToken = generateRefreshToken();
        const tokenHash = hashToken(rawRefreshToken);
        const expiresAt = parseExpiry(process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d');
        await usuarios_repo_js_1.usuariosRepo.createRefreshToken({
            tokenHash,
            usuarioId: usuario.id,
            expiresAt,
        });
        logger_js_1.logger.info('User logged in', { userId: usuario.id, rol: usuario.rol });
        const usuarioPublico = {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
        };
        return {
            accessToken,
            refreshToken: rawRefreshToken,
            usuario: usuarioPublico,
        };
    }
    async refresh(rawRefreshToken) {
        const tokenHash = hashToken(rawRefreshToken);
        const storedToken = await usuarios_repo_js_1.usuariosRepo.findRefreshToken(tokenHash);
        if (!storedToken) {
            throw createUnauthorizedError('Invalid refresh token');
        }
        if (storedToken.revokedAt !== null) {
            // Token reuse detected — revoke all tokens for this user
            await usuarios_repo_js_1.usuariosRepo.revokeAllUserRefreshTokens(storedToken.usuarioId);
            logger_js_1.logger.warn('Refresh token reuse detected', {
                usuarioId: storedToken.usuarioId,
            });
            throw createUnauthorizedError('Refresh token has been revoked');
        }
        if (storedToken.expiresAt < new Date()) {
            throw createUnauthorizedError('Refresh token has expired');
        }
        const usuario = await usuarios_repo_js_1.usuariosRepo.findById(storedToken.usuarioId);
        if (!usuario) {
            throw createUnauthorizedError('User not found');
        }
        // Rotate refresh token
        await usuarios_repo_js_1.usuariosRepo.revokeRefreshToken(tokenHash);
        const payload = {
            sub: usuario.id,
            email: usuario.email,
            rol: usuario.rol,
        };
        const accessToken = this.fastify.jwt.sign(payload);
        const newRawRefreshToken = generateRefreshToken();
        const newTokenHash = hashToken(newRawRefreshToken);
        const expiresAt = parseExpiry(process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d');
        await usuarios_repo_js_1.usuariosRepo.createRefreshToken({
            tokenHash: newTokenHash,
            usuarioId: usuario.id,
            expiresAt,
        });
        return { accessToken };
    }
    async logout(rawRefreshToken) {
        const tokenHash = hashToken(rawRefreshToken);
        await usuarios_repo_js_1.usuariosRepo.revokeRefreshToken(tokenHash);
        logger_js_1.logger.info('User logged out', { tokenHash: tokenHash.slice(0, 8) + '...' });
    }
    async getMe(userId) {
        const usuario = await usuarios_repo_js_1.usuariosRepo.findById(userId);
        if (!usuario) {
            throw createNotFoundError('User not found');
        }
        return {
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
        };
    }
}
exports.AuthService = AuthService;
function createUnauthorizedError(message) {
    const error = new Error(message);
    error.statusCode = 401;
    return error;
}
function createNotFoundError(message) {
    const error = new Error(message);
    error.statusCode = 404;
    return error;
}
//# sourceMappingURL=auth.service.js.map