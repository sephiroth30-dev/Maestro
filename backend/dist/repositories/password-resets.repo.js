"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetsRepo = exports.PasswordResetsRepository = exports.RESET_VIGENCIA_MINUTOS = void 0;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
/** Minutos de vigencia de un enlace de restablecimiento. */
exports.RESET_VIGENCIA_MINUTOS = 30;
// Todas las fechas se calculan EN SQL con NOW() (misma hora del servidor de BD para crear,
// caducar y consumir): comparar fechas en JS contra texto de la BD no es fiable
// (el pool devuelve las fechas como texto, ver `usuarios.repo.ts`).
class PasswordResetsRepository {
    async crear(data) {
        await prisma_js_1.pool.execute(`INSERT INTO password_resets (id, usuario_id, token_hash, created_at, expires_at, ip)
       VALUES (?, ?, ?, NOW(3), NOW(3) + INTERVAL ${exports.RESET_VIGENCIA_MINUTOS} MINUTE, ?)`, [(0, node_crypto_1.randomUUID)(), data.usuarioId, data.tokenHash, data.ip ?? null]);
    }
    /** Marca como usados todos los enlaces pendientes del usuario (el nuevo reemplaza a los anteriores). */
    async invalidarPendientes(usuarioId) {
        await prisma_js_1.pool.execute('UPDATE password_resets SET used_at = NOW(3) WHERE usuario_id = ? AND used_at IS NULL', [usuarioId]);
    }
    /** Cuántas solicitudes tiene el usuario en el último minuto y en la última hora (usadas o no). */
    async contarRecientes(usuarioId) {
        const [rows] = await prisma_js_1.pool.execute(`SELECT SUM(created_at >= NOW(3) - INTERVAL 60 SECOND) AS ultimo_minuto,
              SUM(created_at >= NOW(3) - INTERVAL 1 HOUR)    AS ultima_hora
         FROM password_resets
        WHERE usuario_id = ?`, [usuarioId]);
        return {
            ultimoMinuto: Number(rows[0]?.ultimo_minuto ?? 0),
            ultimaHora: Number(rows[0]?.ultima_hora ?? 0),
        };
    }
    /**
     * Consume el token de forma ATÓMICA: el `UPDATE` solo toca la fila si sigue sin usar y vigente,
     * así que con dos clics a la vez gana uno solo. Devuelve las filas afectadas: el llamador debe
     * exigir exactamente 1 antes de cambiar nada.
     */
    async consumir(tokenHash) {
        const [res] = await prisma_js_1.pool.execute('UPDATE password_resets SET used_at = NOW(3) WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW(3)', [tokenHash]);
        return res.affectedRows;
    }
    async usuarioDeToken(tokenHash) {
        const [rows] = await prisma_js_1.pool.execute('SELECT usuario_id FROM password_resets WHERE token_hash = ? LIMIT 1', [tokenHash]);
        return rows[0]?.usuario_id ?? null;
    }
}
exports.PasswordResetsRepository = PasswordResetsRepository;
exports.passwordResetsRepo = new PasswordResetsRepository();
//# sourceMappingURL=password-resets.repo.js.map