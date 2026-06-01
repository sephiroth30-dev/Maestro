"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAllReglas = findAllReglas;
exports.countReglas = countReglas;
exports.upsertRegla = upsertRegla;
exports.deleteRegla = deleteRegla;
exports.findAllReglasEspeciales = findAllReglasEspeciales;
exports.countReglasEspeciales = countReglasEspeciales;
exports.insertReglaEspecial = insertReglaEspecial;
exports.updateReglaEspecial = updateReglaEspecial;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
async function findAllReglas() {
    const [rows] = await prisma_js_1.pool.query(`SELECT id, profesional_nombre, categoria, tipo,
            CAST(valor_entidad AS DECIMAL(15,4)) AS valor_entidad,
            CAST(valor_particular AS DECIMAL(15,4)) AS valor_particular,
            activo, notas
     FROM reglas_honorarios WHERE activo = 1
     ORDER BY profesional_nombre, categoria`);
    return rows.map((r) => ({
        ...r,
        valor_entidad: Number(r.valor_entidad),
        valor_particular: Number(r.valor_particular),
        activo: Boolean(r.activo),
    }));
}
async function countReglas() {
    const [rows] = await prisma_js_1.pool.query('SELECT COUNT(*) AS cnt FROM reglas_honorarios');
    return Number(rows[0]?.cnt ?? 0);
}
async function upsertRegla(profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas) {
    await prisma_js_1.pool.execute(`INSERT INTO reglas_honorarios
       (id, profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       tipo = VALUES(tipo),
       valor_entidad = VALUES(valor_entidad),
       valor_particular = VALUES(valor_particular),
       notas = VALUES(notas),
       updated_at = CURRENT_TIMESTAMP(3)`, [(0, node_crypto_1.randomUUID)(), profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas ?? null]);
}
async function deleteRegla(id) {
    await prisma_js_1.pool.execute('UPDATE reglas_honorarios SET activo = 0 WHERE id = ?', [id]);
}
// ── Reglas especiales ─────────────────────────────────────────────────────────
async function findAllReglasEspeciales() {
    const [rows] = await prisma_js_1.pool.query(`SELECT id, tipo_regla, profesional_nombre, condicion,
            CAST(valor AS DECIMAL(15,4)) AS valor, descripcion, activo
     FROM reglas_especiales_honorarios WHERE activo = 1
     ORDER BY tipo_regla, profesional_nombre`);
    return rows.map((r) => ({
        ...r,
        valor: Number(r.valor),
        activo: Boolean(r.activo),
    }));
}
async function countReglasEspeciales() {
    const [rows] = await prisma_js_1.pool.query('SELECT COUNT(*) AS cnt FROM reglas_especiales_honorarios');
    return Number(rows[0]?.cnt ?? 0);
}
async function insertReglaEspecial(tipo_regla, profesional_nombre, condicion, valor, descripcion) {
    await prisma_js_1.pool.execute(`INSERT IGNORE INTO reglas_especiales_honorarios
       (id, tipo_regla, profesional_nombre, condicion, valor, descripcion)
     VALUES (?, ?, ?, ?, ?, ?)`, [(0, node_crypto_1.randomUUID)(), tipo_regla, profesional_nombre, condicion, valor, descripcion]);
}
async function updateReglaEspecial(id, valor, descripcion) {
    await prisma_js_1.pool.execute('UPDATE reglas_especiales_honorarios SET valor = ?, descripcion = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [valor, descripcion, id]);
}
//# sourceMappingURL=reglas-honorarios.repo.js.map