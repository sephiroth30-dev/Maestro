"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAgregadoMes = getAgregadoMes;
exports.getFacturacionDia = getFacturacionDia;
exports.getDiasTranscurridos = getDiasTranscurridos;
exports.getFechasDelMes = getFechasDelMes;
exports.getEntidadesAgg = getEntidadesAgg;
exports.getDiariosDelMes = getDiariosDelMes;
exports.getDiasSemanaAgg = getDiasSemanaAgg;
exports.getTendenciaMeses = getTendenciaMeses;
exports.getPresupuesto = getPresupuesto;
exports.listPresupuestos = listPresupuestos;
exports.upsertPresupuesto = upsertPresupuesto;
const prisma_js_1 = require("../config/prisma.js");
const node_crypto_1 = require("node:crypto");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Returns a [whereClause, params] tuple for filtering atenciones by date range
 * or by mes_idx/anio.
 */
function buildDateWhere(mesIdx, anio, startDate, endDate) {
    if (startDate && endDate) {
        return ['fecha_dia >= ? AND fecha_dia <= ?', [startDate, endDate]];
    }
    return ['mes_idx = ? AND anio = ?', [mesIdx ?? 0, anio ?? 0]];
}
// ─── Repository ───────────────────────────────────────────────────────────────
async function getAgregadoMes(mesIdx, anio, entidadId, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    let sql = `SELECT SUM(valor_bruto) AS total, COUNT(id) AS cnt FROM atenciones WHERE ${whereClause}`;
    const allParams = [...params];
    if (entidadId) {
        sql += ' AND entidad_id = ?';
        allParams.push(entidadId);
    }
    const [rows] = await prisma_js_1.pool.query(sql, allParams);
    return {
        total: Number(rows[0]?.total ?? 0),
        atenciones: Number(rows[0]?.cnt ?? 0),
    };
}
async function getFacturacionDia(fecha) {
    const startOfDay = new Date(fecha);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(fecha);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const [rows] = await prisma_js_1.pool.query('SELECT SUM(valor_bruto) AS total FROM atenciones WHERE fecha_dia >= ? AND fecha_dia <= ?', [startOfDay, endOfDay]);
    return Number(rows[0]?.total ?? 0);
}
async function getDiasTranscurridos(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT COUNT(DISTINCT fecha_dia) AS cnt FROM atenciones WHERE ${whereClause}`, params);
    return Number(rows[0]?.cnt ?? 0);
}
async function getFechasDelMes(mesIdx, anio) {
    const [rows] = await prisma_js_1.pool.query('SELECT DISTINCT fecha_dia FROM atenciones WHERE mes_idx = ? AND anio = ? ORDER BY fecha_dia ASC', [mesIdx, anio]);
    return rows.map((r) => r.fecha_dia);
}
async function getEntidadesAgg(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT
      a.entidad_id,
      e.nombre,
      e.tipo,
      e.es_grupo_caja,
      COUNT(a.id) AS cantidad,
      SUM(a.valor_bruto) AS valor_bruto
    FROM atenciones a
    LEFT JOIN entidades e ON e.id = a.entidad_id
    WHERE ${whereClause}
    GROUP BY a.entidad_id, e.nombre, e.tipo, e.es_grupo_caja
    ORDER BY valor_bruto DESC`, params);
    return rows.map((r) => ({
        entidad_id: r.entidad_id,
        nombre: r.nombre,
        tipo: r.tipo,
        es_grupo_caja: r.es_grupo_caja,
        cantidad: Number(r.cantidad),
        valor_bruto: Number(r.valor_bruto),
    }));
}
async function getDiariosDelMes(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT
      fecha_dia,
      SUM(valor_bruto) AS total,
      COUNT(id) AS atenciones
    FROM atenciones
    WHERE ${whereClause}
    GROUP BY fecha_dia
    ORDER BY fecha_dia ASC`, params);
    return rows.map((r) => ({
        fecha_dia: r.fecha_dia,
        total: Number(r.total),
        atenciones: Number(r.atenciones),
    }));
}
async function getDiasSemanaAgg(mesIdx, anio, startDate, endDate) {
    const [whereClause, params] = buildDateWhere(mesIdx, anio, startDate, endDate);
    const [rows] = await prisma_js_1.pool.query(`SELECT
      (DAYOFWEEK(fecha_dia) - 1) AS dia_num,
      AVG(valor_bruto)           AS promedio,
      SUM(valor_bruto)           AS total,
      COUNT(id)                  AS atenciones
    FROM atenciones
    WHERE ${whereClause}
    GROUP BY dia_num
    ORDER BY dia_num ASC`, params);
    return rows.map((r) => ({
        dia_num: Number(r.dia_num),
        promedio: Number(r.promedio),
        total: Number(r.total),
        atenciones: Number(r.atenciones),
    }));
}
async function getTendenciaMeses(meses) {
    const [rows] = await prisma_js_1.pool.query(`SELECT
      anio,
      mes_idx,
      SUM(valor_bruto) AS total
    FROM atenciones
    GROUP BY anio, mes_idx
    ORDER BY anio ASC, mes_idx ASC
    LIMIT ?`, [meses]);
    return rows.map((r) => ({
        anio: Number(r.anio),
        mes_idx: Number(r.mes_idx),
        total: Number(r.total),
    }));
}
async function getPresupuesto(anio, mes) {
    const [rows] = await prisma_js_1.pool.query('SELECT monto FROM presupuestos_mensuales WHERE anio = ? AND mes = ? LIMIT 1', [anio, mes]);
    return Number(rows[0]?.monto ?? 0);
}
async function listPresupuestos() {
    const [rows] = await prisma_js_1.pool.query('SELECT id, anio, mes, monto, notas, created_at FROM presupuestos_mensuales ORDER BY anio ASC, mes ASC');
    return rows.map((r) => ({
        id: r.id,
        anio: Number(r.anio),
        mes: Number(r.mes),
        monto: Number(r.monto),
        notas: r.notas,
        createdAt: r.created_at,
    }));
}
async function upsertPresupuesto(anio, mes, monto, notas) {
    // Check if row already exists to get its id
    const [existing] = await prisma_js_1.pool.query('SELECT id FROM presupuestos_mensuales WHERE anio = ? AND mes = ? LIMIT 1', [anio, mes]);
    const notasVal = notas ?? null;
    if (existing[0]) {
        const existingId = existing[0].id;
        await prisma_js_1.pool.execute('UPDATE presupuestos_mensuales SET monto = ?, notas = ? WHERE id = ?', [monto, notasVal, existingId]);
        return { id: existingId, anio, mes, monto, notas: notasVal };
    }
    const newId = (0, node_crypto_1.randomUUID)();
    await prisma_js_1.pool.execute('INSERT INTO presupuestos_mensuales (id, anio, mes, monto, notas) VALUES (?, ?, ?, ?, ?)', [newId, anio, mes, monto, notasVal]);
    return { id: newId, anio, mes, monto, notas: notasVal };
}
//# sourceMappingURL=reportes.repo.js.map