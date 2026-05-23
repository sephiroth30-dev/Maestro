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
const client_1 = require("@prisma/client");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildDateWhere(mesIdx, anio, startDate, endDate) {
    if (startDate && endDate) {
        return client_1.Prisma.sql `fecha_dia >= ${startDate} AND fecha_dia <= ${endDate}`;
    }
    return client_1.Prisma.sql `mes_idx = ${mesIdx} AND anio = ${anio}`;
}
// ─── Repository ───────────────────────────────────────────────────────────────
async function getAgregadoMes(mesIdx, anio, entidadId, startDate, endDate) {
    const where = startDate && endDate
        ? { fechaDia: { gte: startDate, lte: endDate } }
        : { mesIdx, anio };
    if (entidadId)
        where['entidadId'] = entidadId;
    const result = await prisma_js_1.prisma.atencion.aggregate({
        where,
        _sum: { valorBruto: true },
        _count: { id: true },
    });
    return {
        total: Number(result._sum.valorBruto ?? 0),
        atenciones: result._count.id,
    };
}
async function getFacturacionDia(fecha) {
    const startOfDay = new Date(fecha);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(fecha);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const result = await prisma_js_1.prisma.atencion.aggregate({
        where: {
            fechaDia: {
                gte: startOfDay,
                lte: endOfDay,
            },
        },
        _sum: { valorBruto: true },
    });
    return Number(result._sum.valorBruto ?? 0);
}
async function getDiasTranscurridos(mesIdx, anio, startDate, endDate) {
    const where = buildDateWhere(mesIdx, anio, startDate, endDate);
    const rows = await prisma_js_1.prisma.$queryRaw `
    SELECT COUNT(DISTINCT fecha_dia) AS cnt FROM atenciones WHERE ${where}
  `;
    return Number(rows[0]?.cnt ?? 0);
}
async function getFechasDelMes(mesIdx, anio) {
    const rows = await prisma_js_1.prisma.atencion.findMany({
        where: { mesIdx, anio },
        select: { fechaDia: true },
        distinct: ['fechaDia'],
        orderBy: { fechaDia: 'asc' },
    });
    return rows.map((r) => r.fechaDia);
}
async function getEntidadesAgg(mesIdx, anio, startDate, endDate) {
    // MySQL-compatible: no double-quoted identifiers
    const where = buildDateWhere(mesIdx, anio, startDate, endDate);
    return prisma_js_1.prisma.$queryRaw `
    SELECT
      a.entidad_id,
      e.nombre,
      e.tipo,
      e.es_grupo_caja,
      COUNT(a.id) AS cantidad,
      SUM(a.valor_bruto) AS valor_bruto
    FROM atenciones a
    LEFT JOIN entidades e ON e.id = a.entidad_id
    WHERE ${where}
    GROUP BY a.entidad_id, e.nombre, e.tipo, e.es_grupo_caja
    ORDER BY valor_bruto DESC
  `;
}
async function getDiariosDelMes(mesIdx, anio, startDate, endDate) {
    // MySQL-compatible: no double-quoted identifiers
    const where = buildDateWhere(mesIdx, anio, startDate, endDate);
    return prisma_js_1.prisma.$queryRaw `
    SELECT
      fecha_dia,
      SUM(valor_bruto) AS total,
      COUNT(id) AS atenciones
    FROM atenciones
    WHERE ${where}
    GROUP BY fecha_dia
    ORDER BY fecha_dia ASC
  `;
}
async function getDiasSemanaAgg(mesIdx, anio, startDate, endDate) {
    // MySQL: DAYOFWEEK() returns 1=Sun..7=Sat; subtract 1 → 0=Sun..6=Sat
    // No EXTRACT(DOW ...)::int (PostgreSQL-only)
    const where = buildDateWhere(mesIdx, anio, startDate, endDate);
    return prisma_js_1.prisma.$queryRaw `
    SELECT
      (DAYOFWEEK(fecha_dia) - 1) AS dia_num,
      AVG(valor_bruto)           AS promedio,
      SUM(valor_bruto)           AS total,
      COUNT(id)                  AS atenciones
    FROM atenciones
    WHERE ${where}
    GROUP BY dia_num
    ORDER BY dia_num ASC
  `;
}
async function getTendenciaMeses(meses) {
    // MySQL-compatible
    return prisma_js_1.prisma.$queryRaw `
    SELECT
      anio,
      mes_idx,
      SUM(valor_bruto) AS total
    FROM atenciones
    GROUP BY anio, mes_idx
    ORDER BY anio ASC, mes_idx ASC
    LIMIT ${meses}
  `;
}
async function getPresupuesto(anio, mes) {
    const row = await prisma_js_1.prisma.presupuestoMensual.findUnique({
        where: { anio_mes: { anio, mes } },
        select: { monto: true },
    });
    return Number(row?.monto ?? 0);
}
async function listPresupuestos() {
    const rows = await prisma_js_1.prisma.presupuestoMensual.findMany({
        select: { id: true, anio: true, mes: true, monto: true, notas: true, createdAt: true },
        orderBy: [{ anio: 'asc' }, { mes: 'asc' }],
    });
    return rows.map((r) => ({ ...r, monto: Number(r.monto) }));
}
async function upsertPresupuesto(anio, mes, monto, notas) {
    const existing = await prisma_js_1.prisma.presupuestoMensual.findUnique({
        where: { anio_mes: { anio, mes } },
        select: { id: true },
    });
    if (existing) {
        const updated = await prisma_js_1.prisma.presupuestoMensual.update({
            where: { id: existing.id },
            data: { monto, notas: notas ?? null },
            select: { id: true, anio: true, mes: true, monto: true, notas: true },
        });
        return { ...updated, monto: Number(updated.monto) };
    }
    const created = await prisma_js_1.prisma.presupuestoMensual.create({
        data: { anio, mes, monto, notas: notas ?? null },
        select: { id: true, anio: true, mes: true, monto: true, notas: true },
    });
    return { ...created, monto: Number(created.monto) };
}
//# sourceMappingURL=reportes.repo.js.map