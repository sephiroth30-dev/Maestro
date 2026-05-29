"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAjustesByLiquidacion = getAjustesByLiquidacion;
exports.getAjusteById = getAjusteById;
exports.crearAjuste = crearAjuste;
exports.autorizarAjuste = autorizarAjuste;
exports.rechazarAjuste = rechazarAjuste;
exports.eliminarAjuste = eliminarAjuste;
exports.getMontoAjustesAutorizados = getMontoAjustesAutorizados;
const prisma_js_1 = require("../config/prisma.js");
// ─── Mapeo ────────────────────────────────────────────────────────────────────
function mapAjuste(r) {
    return {
        id: r.id,
        liquidacion_id: r.liquidacion_id,
        categoria: r.categoria,
        descripcion: r.descripcion,
        cantidad: Number(r.cantidad),
        valor_unitario: Number(r.valor_unitario),
        valor_total: Number(r.valor_total),
        justificacion: r.justificacion,
        referencia_doc: r.referencia_doc ?? null,
        estado: r.estado,
        creado_por: r.creado_por,
        creado_por_nombre: r.creado_por_nombre ?? null,
        autorizado_por: r.autorizado_por ?? null,
        autorizado_por_nombre: r.autorizado_por_nombre ?? null,
        autorizado_en: r.autorizado_en ? new Date(r.autorizado_en).toISOString() : null,
        motivo_rechazo: r.motivo_rechazo ?? null,
        created_at: r.created_at,
    };
}
// ─── Queries ──────────────────────────────────────────────────────────────────
async function getAjustesByLiquidacion(liquidacionId) {
    const [rows] = await prisma_js_1.pool.query(`SELECT a.*,
            uc.nombre AS creado_por_nombre,
            ua.nombre AS autorizado_por_nombre
     FROM liquidacion_ajustes a
     LEFT JOIN usuarios uc ON uc.id = a.creado_por
     LEFT JOIN usuarios ua ON ua.id = a.autorizado_por
     WHERE a.liquidacion_id = ?
     ORDER BY a.created_at ASC`, [liquidacionId]);
    return rows.map(mapAjuste);
}
async function getAjusteById(id) {
    const [rows] = await prisma_js_1.pool.query(`SELECT a.*,
            uc.nombre AS creado_por_nombre,
            ua.nombre AS autorizado_por_nombre
     FROM liquidacion_ajustes a
     LEFT JOIN usuarios uc ON uc.id = a.creado_por
     LEFT JOIN usuarios ua ON ua.id = a.autorizado_por
     WHERE a.id = ?`, [id]);
    return rows.length ? mapAjuste(rows[0]) : null;
}
async function crearAjuste(data) {
    const valor_total = data.cantidad * data.valor_unitario;
    await prisma_js_1.pool.execute(`INSERT INTO liquidacion_ajustes
       (liquidacion_id, categoria, descripcion, cantidad, valor_unitario, valor_total,
        justificacion, referencia_doc, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        data.liquidacion_id, data.categoria, data.descripcion,
        data.cantidad, data.valor_unitario, valor_total,
        data.justificacion, data.referencia_doc ?? null, data.creado_por,
    ]);
    const [rows] = await prisma_js_1.pool.query(`SELECT a.*, uc.nombre AS creado_por_nombre, ua.nombre AS autorizado_por_nombre
     FROM liquidacion_ajustes a
     LEFT JOIN usuarios uc ON uc.id = a.creado_por
     LEFT JOIN usuarios ua ON ua.id = a.autorizado_por
     WHERE a.liquidacion_id = ? AND a.creado_por = ?
     ORDER BY a.created_at DESC LIMIT 1`, [data.liquidacion_id, data.creado_por]);
    return mapAjuste(rows[0]);
}
async function autorizarAjuste(id, autorizadoPor) {
    await prisma_js_1.pool.execute(`UPDATE liquidacion_ajustes
     SET estado = 'AUTORIZADO', autorizado_por = ?, autorizado_en = NOW(), updated_at = NOW()
     WHERE id = ? AND estado = 'PENDIENTE' AND creado_por != ?`, [autorizadoPor, id, autorizadoPor]);
}
async function rechazarAjuste(id, usuarioId, motivo) {
    await prisma_js_1.pool.execute(`UPDATE liquidacion_ajustes
     SET estado = 'RECHAZADO', autorizado_por = ?, autorizado_en = NOW(),
         motivo_rechazo = ?, updated_at = NOW()
     WHERE id = ? AND estado = 'PENDIENTE' AND creado_por != ?`, [usuarioId, motivo, id, usuarioId]);
}
async function eliminarAjuste(id, creadoPor) {
    await prisma_js_1.pool.execute(`DELETE FROM liquidacion_ajustes WHERE id = ? AND creado_por = ? AND estado = 'PENDIENTE'`, [id, creadoPor]);
}
// Suma de ajustes autorizados para incluir en el total efectivo
async function getMontoAjustesAutorizados(liquidacionId) {
    const [rows] = await prisma_js_1.pool.query(`SELECT COALESCE(SUM(valor_total), 0) AS total
     FROM liquidacion_ajustes
     WHERE liquidacion_id = ? AND estado = 'AUTORIZADO'`, [liquidacionId]);
    return Number(rows[0].total);
}
//# sourceMappingURL=ajustes.repo.js.map