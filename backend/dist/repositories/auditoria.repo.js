"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditoriaRepo = exports.ACCION = void 0;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
// ─── Action constants ─────────────────────────────────────────────────────────
exports.ACCION = {
    LOGIN: 'LOGIN',
    LOGIN_FALLIDO: 'LOGIN_FALLIDO',
    LOGOUT: 'LOGOUT',
    CAMBIO_PASSWORD: 'CAMBIO_PASSWORD',
    RESET_PASSWORD: 'RESET_PASSWORD',
    USUARIO_CREADO: 'USUARIO_CREADO',
    USUARIO_ACTUALIZADO: 'USUARIO_ACTUALIZADO',
    USUARIO_ELIMINADO: 'USUARIO_ELIMINADO',
    AJUSTE_CREADO: 'AJUSTE_CREADO',
    AJUSTE_AUTORIZADO: 'AJUSTE_AUTORIZADO',
    AJUSTE_RECHAZADO: 'AJUSTE_RECHAZADO',
    AJUSTE_ELIMINADO: 'AJUSTE_ELIMINADO',
    LIQUIDACION_GENERADA: 'LIQUIDACION_GENERADA',
    LIQUIDACION_APROBADA: 'LIQUIDACION_APROBADA',
    LIQUIDACION_PAGADA: 'LIQUIDACION_PAGADA',
    LIQUIDACION_REVERTIDA: 'LIQUIDACION_REVERTIDA',
    CONECTOR_CREADO: 'CONECTOR_CREADO',
    CONECTOR_ACTUALIZADO: 'CONECTOR_ACTUALIZADO',
    CONECTOR_ELIMINADO: 'CONECTOR_ELIMINADO',
    SYNC_INICIADO: 'SYNC_INICIADO',
    DATOS_ELIMINADOS: 'DATOS_ELIMINADOS',
    CAPACIDAD_CONFIGURADA: 'CAPACIDAD_CONFIGURADA',
    CAPACIDAD_ELIMINADA: 'CAPACIDAD_ELIMINADA',
};
// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapRow(row) {
    const detalle = row.detalle == null
        ? null
        : typeof row.detalle === 'string'
            ? JSON.parse(row.detalle)
            : row.detalle;
    return {
        id: row.id,
        usuarioId: row.usuario_id,
        usuarioNombre: row.usuario_nombre,
        usuarioEmail: row.usuario_email,
        accion: row.accion,
        entidadTipo: row.entidad_tipo,
        entidadId: row.entidad_id,
        detalle,
        ip: row.ip,
        createdAt: row.created_at,
    };
}
// ─── Repository ───────────────────────────────────────────────────────────────
class AuditoriaRepository {
    async insert(data) {
        const id = (0, node_crypto_1.randomUUID)();
        await prisma_js_1.pool.execute(`INSERT INTO audit_log
         (id, usuario_id, accion, entidad_tipo, entidad_id, detalle, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`, [
            id,
            data.usuarioId ?? null,
            data.accion,
            data.entidadTipo ?? null,
            data.entidadId ?? null,
            data.detalle ? JSON.stringify(data.detalle) : null,
            data.ip ?? null,
        ]);
    }
    async findMany(params) {
        const page = Math.max(params.page ?? 1, 1);
        const limit = Math.min(params.limit ?? 50, 200);
        const offset = (page - 1) * limit;
        const conditions = [];
        const bindings = [];
        if (params.usuarioId) {
            conditions.push('al.usuario_id = ?');
            bindings.push(params.usuarioId);
        }
        if (params.accion) {
            conditions.push('al.accion = ?');
            bindings.push(params.accion);
        }
        if (params.desde) {
            conditions.push('al.created_at >= ?');
            bindings.push(params.desde + ' 00:00:00');
        }
        if (params.hasta) {
            conditions.push('al.created_at <= ?');
            bindings.push(params.hasta + ' 23:59:59');
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [countRows] = await prisma_js_1.pool.query(`SELECT COUNT(*) AS total FROM audit_log al ${where}`, bindings);
        const total = Number(countRows[0]?.total ?? 0);
        const [rows] = await prisma_js_1.pool.query(`SELECT al.*,
              u.nombre AS usuario_nombre,
              u.email  AS usuario_email
       FROM   audit_log al
       LEFT JOIN usuarios u ON u.id = al.usuario_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`, [...bindings, limit, offset]);
        return { rows: rows.map(mapRow), total };
    }
    async listAcciones() {
        const [rows] = await prisma_js_1.pool.query('SELECT DISTINCT accion FROM audit_log ORDER BY accion ASC');
        return rows.map((r) => r.accion);
    }
}
exports.auditoriaRepo = new AuditoriaRepository();
//# sourceMappingURL=auditoria.repo.js.map