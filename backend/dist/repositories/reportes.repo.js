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
exports.listEntidades = listEntidades;
exports.updateEntidadGrupoCaja = updateEntidadGrupoCaja;
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
    // Always LEFT JOIN entidades so we can exclude "grupo caja" (cash-only) entities
    // from billing KPIs. When a specific entity is requested, the exclusion is skipped.
    let sql = `SELECT SUM(a.valor_bruto) AS total, COUNT(a.id) AS cnt
    FROM atenciones a
    LEFT JOIN entidades e ON e.id = a.entidad_id
    WHERE ${whereClause}`;
    const allParams = [...params];
    if (entidadId) {
        sql += ' AND a.entidad_id = ?';
        allParams.push(entidadId);
    }
    else {
        // Exclude entities flagged as flujo-de-caja only (PARTICULARES, etc.)
        sql += ' AND COALESCE(e.es_grupo_caja, 0) = 0';
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
    const [rows] = await prisma_js_1.pool.query(`SELECT COUNT(DISTINCT DATE(fecha_dia)) AS cnt FROM atenciones WHERE ${whereClause}`, params);
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
      DATE(fecha_dia) AS fecha_dia,
      SUM(valor_bruto) AS total,
      COUNT(id) AS atenciones
    FROM atenciones
    WHERE ${whereClause}
    GROUP BY DATE(fecha_dia)
    ORDER BY DATE(fecha_dia) ASC`, params);
    return rows.map((r) => ({
        fecha_dia: new Date(r.fecha_dia + 'T00:00:00.000Z'),
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
      AND DAYOFWEEK(fecha_dia) BETWEEN 2 AND 6
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
    // Subquery: pick the N most-recent months, then re-sort ascending for display.
    const [rows] = await prisma_js_1.pool.query(`SELECT anio, mes_idx, total FROM (
       SELECT anio, mes_idx, SUM(valor_bruto) AS total
       FROM atenciones
       GROUP BY anio, mes_idx
       ORDER BY anio DESC, mes_idx DESC
       LIMIT ?
     ) sub
     ORDER BY anio ASC, mes_idx ASC`, [meses]);
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
async function listEntidades() {
    const [rows] = await prisma_js_1.pool.query('SELECT id, nombre, tipo, es_grupo_caja, activa FROM entidades ORDER BY tipo ASC, nombre ASC');
    return rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        es_grupo_caja: Boolean(r.es_grupo_caja),
        activa: Boolean(r.activa),
    }));
}
async function updateEntidadGrupoCaja(id, esGrupoCaja) {
    await prisma_js_1.pool.execute('UPDATE entidades SET es_grupo_caja = ? WHERE id = ?', [esGrupoCaja ? 1 : 0, id]);
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