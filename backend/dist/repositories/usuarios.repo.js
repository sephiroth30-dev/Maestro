"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuariosRepo = exports.UsuariosRepository = void 0;
const prisma_js_1 = require("../config/prisma.js");
class UsuariosRepository {
    async findByEmail(email) {
        return prisma_js_1.prisma.usuario.findUnique({
            where: { email, activo: true, deletedAt: null },
        });
    }
    async findById(id) {
        return prisma_js_1.prisma.usuario.findUnique({
            where: { id, activo: true, deletedAt: null },
        });
    }
    async updateLastSeen(_id) {
        // Reserved for future use: track last activity
    }
    async createRefreshToken(data) {
        return prisma_js_1.prisma.refreshToken.create({
            data: {
                tokenHash: data.tokenHash,
                usuarioId: data.usuarioId,
                expiresAt: data.expiresAt,
            },
        });
    }
    async findRefreshToken(tokenHash) {
        return prisma_js_1.prisma.refreshToken.findUnique({
            where: { tokenHash },
        });
    }
    async revokeRefreshToken(tokenHash) {
        await prisma_js_1.prisma.refreshToken.updateMany({
            where: { tokenHash, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async revokeAllUserRefreshTokens(usuarioId) {
        await prisma_js_1.prisma.refreshToken.updateMany({
            where: { usuarioId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
    }
    async deleteExpiredTokens() {
        const result = await prisma_js_1.prisma.refreshToken.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
            },
        });
        return result.count;
    }
    async getUserRol(id) {
        const user = await prisma_js_1.prisma.usuario.findUnique({
            where: { id, activo: true, deletedAt: null },
            select: { rol: true },
        });
        return user?.rol ?? null;
    }
}
exports.UsuariosRepository = UsuariosRepository;
exports.usuariosRepo = new UsuariosRepository();
//# sourceMappingURL=usuarios.repo.js.map