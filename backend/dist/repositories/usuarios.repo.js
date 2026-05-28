"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuariosRepo = exports.UsuariosRepository = void 0;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapUsuario(row) {
    return {
        id: row.id,
        email: row.email,
        nombre: row.nombre,
        passwordHash: row.password_hash,
        rol: row.rol,
        activo: Boolean(row.activo),
        deletedAt: row.deleted_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapRefreshToken(row) {
    return {
        id: row.id,
        tokenHash: row.token_hash,
        usuarioId: row.usuario_id,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
    };
}
// ─── Repository ───────────────────────────────────────────────────────────────
class UsuariosRepository {
    async findByEmail(email) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM usuarios WHERE email = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1', [email]);
        const row = rows[0];
        return row ? mapUsuario(row) : null;
    }
    async findById(id) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM usuarios WHERE id = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1', [id]);
        const row = rows[0];
        return row ? mapUsuario(row) : null;
    }
    async updateLastSeen(_id) {
        // Reserved for future use: track last activity
    }
    async createRefreshToken(data) {
        const id = (0, node_crypto_1.randomUUID)();
        await prisma_js_1.pool.execute('INSERT INTO refresh_tokens (id, token_hash, usuario_id, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())', [id, data.tokenHash, data.usuarioId, data.expiresAt]);
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM refresh_tokens WHERE id = ? LIMIT 1', [id]);
        return mapRefreshToken(rows[0]);
    }
    async findRefreshToken(tokenHash) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);
        const row = rows[0];
        return row ? mapRefreshToken(row) : null;
    }
    async revokeRefreshToken(tokenHash) {
        await prisma_js_1.pool.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL', [tokenHash]);
    }
    async revokeAllUserRefreshTokens(usuarioId) {
        await prisma_js_1.pool.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE usuario_id = ? AND revoked_at IS NULL', [usuarioId]);
    }
    async deleteExpiredTokens() {
        const [result] = await prisma_js_1.pool.execute('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
        return result.affectedRows;
    }
    async getUserRol(id) {
        const [rows] = await prisma_js_1.pool.query('SELECT rol FROM usuarios WHERE id = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1', [id]);
        return rows[0]?.rol ?? null;
    }
    // ─── Admin CRUD ───────────────────────────────────────────────────────────
    async listAll() {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM usuarios WHERE deleted_at IS NULL ORDER BY nombre ASC');
        return rows.map(mapUsuario);
    }
    async findByEmailExcluding(email, excludeId) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM usuarios WHERE email = ? AND id != ? AND deleted_at IS NULL LIMIT 1', [email, excludeId]);
        return rows[0] ? mapUsuario(rows[0]) : null;
    }
    async create(data) {
        const id = (0, node_crypto_1.randomUUID)();
        await prisma_js_1.pool.execute('INSERT INTO usuarios (id, email, nombre, password_hash, rol, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())', [id, data.email, data.nombre, data.passwordHash, data.rol]);
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [id]);
        return mapUsuario(rows[0]);
    }
    async update(id, data) {
        const sets = [];
        const params = [];
        if (data.nombre !== undefined) {
            sets.push('nombre = ?');
            params.push(data.nombre);
        }
        if (data.email !== undefined) {
            sets.push('email = ?');
            params.push(data.email);
        }
        if (data.rol !== undefined) {
            sets.push('rol = ?');
            params.push(data.rol);
        }
        if (data.activo !== undefined) {
            sets.push('activo = ?');
            params.push(data.activo ? 1 : 0);
        }
        if (sets.length === 0)
            return;
        sets.push('updated_at = NOW()');
        params.push(id);
        await prisma_js_1.pool.execute(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`, params);
    }
    async updatePassword(id, passwordHash) {
        await prisma_js_1.pool.execute('UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL', [passwordHash, id]);
    }
    async softDelete(id) {
        await prisma_js_1.pool.execute('UPDATE usuarios SET deleted_at = NOW(), activo = 0 WHERE id = ? AND deleted_at IS NULL', [id]);
    }
}
exports.UsuariosRepository = UsuariosRepository;
exports.usuariosRepo = new UsuariosRepository();
//# sourceMappingURL=usuarios.repo.js.map