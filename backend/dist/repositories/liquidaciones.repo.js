"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLiquidacionesByPeriodo = getLiquidacionesByPeriodo;
exports.getLiquidacionById = getLiquidacionById;
exports.upsertLiquidacion = upsertLiquidacion;
exports.actualizarEstado = actualizarEstado;
exports.actualizarEstadoLote = actualizarEstadoLote;
const prisma_js_1 = require("../config/prisma.js");
// ─── Queries ──────────────────────────────────────────────────────────────────
const SELECT_LIQUIDACIONES = `
  SELECT
    l.id,
    l.profesional_id,
    p.nombre          AS profesional_nombre,
    COALESCE(p.nombre_completo, p.nombre) AS profesional_display,
    p.especialidad,
    DATE_FORMAT(l.fecha_desde, '%Y-%m-%d') AS fecha_desde,
    DATE_FORMAT(l.fecha_hasta, '%Y-%m-%d') AS fecha_hasta,
    l.estado,
    CAST(l.monto_total AS DECIMAL(15,2)) AS monto_total,
    l.datos_snapshot,
    l.aprobado_por,
    ua.nombre         AS aprobado_por_nombre,
    l.aprobado_en,
    l.pagado_por,
    up.nombre         AS pagado_por_nombre,
    l.pagado_en,
    l.notas,
    l.created_at,
    l.updated_at
  FROM liquidaciones l
  INNER JOIN profesionales p ON p.id = l.profesional_id
  LEFT  JOIN usuarios ua     ON ua.id = l.aprobado_por
  LEFT  JOIN usuarios up     ON up.id = l.pagado_por
`;
function mapRow(r) {
    return {
        id: r.id,
        profesional_id: r.profesional_id,
        profesional_nombre: r.profesional_nombre,
        profesional_display: r.profesional_display,
        especialidad: r.especialidad ?? null,
        fecha_desde: r.fecha_desde,
        fecha_hasta: r.fecha_hasta,
        estado: r.estado,
        monto_total: Number(r.monto_total),
        datos_snapshot: typeof r.datos_snapshot === 'string'
            ? JSON.parse(r.datos_snapshot)
            : r.datos_snapshot,
        aprobado_por: r.aprobado_por ?? null,
        aprobado_por_nombre: r.aprobado_por_nombre ?? null,
        aprobado_en: r.aprobado_en ?? null,
        pagado_por: r.pagado_por ?? null,
        pagado_por_nombre: r.pagado_por_nombre ?? null,
        pagado_en: r.pagado_en ?? null,
        notas: r.notas ?? null,
        created_at: r.created_at,
        updated_at: r.updated_at,
    };
}
async function getLiquidacionesByPeriodo(fechaDesde, fechaHasta) {
    const [rows] = await prisma_js_1.pool.query(`${SELECT_LIQUIDACIONES}
     WHERE l.fecha_desde = ? AND l.fecha_hasta = ?
     ORDER BY l.monto_total DESC`, [fechaDesde, fechaHasta]);
    return rows.map(mapRow);
}
async function getLiquidacionById(id) {
    const [rows] = await prisma_js_1.pool.query(`${SELECT_LIQUIDACIONES} WHERE l.id = ?`, [id]);
    return rows.length ? mapRow(rows[0]) : null;
}
async function upsertLiquidacion(data) {
    const snapshot = JSON.stringify(data.datos_snapshot);
    // Only upsert if not already APROBADO or PAGADO
    const [existing] = await prisma_js_1.pool.query(`SELECT id, estado FROM liquidaciones WHERE profesional_id = ? AND fecha_desde = ? AND fecha_hasta = ?`, [data.profesional_id, data.fecha_desde, data.fecha_hasta]);
    if (existing.length && existing[0].estado !== 'CALCULADO') {
        return existing[0].id;
    }
    if (existing.length) {
        await prisma_js_1.pool.execute(`UPDATE liquidaciones SET monto_total = ?, datos_snapshot = ?, updated_at = NOW()
       WHERE id = ?`, [data.monto_total, snapshot, existing[0].id]);
        return existing[0].id;
    }
    const [result] = await prisma_js_1.pool.execute(`INSERT INTO liquidaciones (profesional_id, fecha_desde, fecha_hasta, monto_total, datos_snapshot)
     VALUES (?, ?, ?, ?, ?)`, [data.profesional_id, data.fecha_desde, data.fecha_hasta, data.monto_total, snapshot]);
    // Fetch the generated UUID
    const [rows] = await prisma_js_1.pool.query(`SELECT id FROM liquidaciones WHERE profesional_id = ? AND fecha_desde = ? AND fecha_hasta = ?`, [data.profesional_id, data.fecha_desde, data.fecha_hasta]);
    void result;
    return rows[0].id;
}
async function actualizarEstado(id, estado, usuarioId, notas) {
    if (estado === 'APROBADO') {
        await prisma_js_1.pool.execute(`UPDATE liquidaciones SET estado = 'APROBADO', aprobado_por = ?, aprobado_en = NOW(), updated_at = NOW()
       WHERE id = ? AND estado = 'CALCULADO'`, [usuarioId, id]);
    }
    else {
        await prisma_js_1.pool.execute(`UPDATE liquidaciones SET estado = 'PAGADO', pagado_por = ?, pagado_en = NOW(),
       notas = COALESCE(?, notas), updated_at = NOW()
       WHERE id = ? AND estado = 'APROBADO'`, [usuarioId, notas ?? null, id]);
    }
}
async function actualizarEstadoLote(ids, estado, usuarioId) {
    if (!ids.length)
        return;
    const placeholders = ids.map(() => '?').join(',');
    if (estado === 'APROBADO') {
        await prisma_js_1.pool.execute(`UPDATE liquidaciones SET estado = 'APROBADO', aprobado_por = ?, aprobado_en = NOW(), updated_at = NOW()
       WHERE id IN (${placeholders}) AND estado = 'CALCULADO'`, [usuarioId, ...ids]);
    }
    else {
        await prisma_js_1.pool.execute(`UPDATE liquidaciones SET estado = 'PAGADO', pagado_por = ?, pagado_en = NOW(), updated_at = NOW()
       WHERE id IN (${placeholders}) AND estado = 'APROBADO'`, [usuarioId, ...ids]);
    }
}
//# sourceMappingURL=liquidaciones.repo.js.map