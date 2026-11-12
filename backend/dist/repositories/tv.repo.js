"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.leerCitasDia = leerCitasDia;
exports.reemplazarCitasDia = reemplazarCitasDia;
exports.leerCodigosAgenda = leerCodigosAgenda;
exports.insertarMovimientos = insertarMovimientos;
exports.leerMovimientos = leerMovimientos;
exports.purgarMovimientos = purgarMovimientos;
exports.insertarFoto = insertarFoto;
exports.leerSerie = leerSerie;
exports.fechaPreviaConSerie = fechaPreviaConSerie;
exports.purgarSerie = purgarSerie;
const prisma_js_1 = require("../config/prisma.js");
/**
 * Consultas de la pantalla de TV.
 *
 * ⚠ Escritas sin poder ejecutarlas (el entorno de desarrollo no tiene MySQL), igual
 * que las de la agenda: sencillas, sin funciones de ventana, con parámetros `?`.
 * Las fechas salen como texto (`dateStrings: true`; el pool trabaja en UTC).
 * No se guardan datos de pacientes.
 */
const LOTE = 500;
/** Fila marcador: dice «hoy se leyó» aunque no haya ninguna cita (sábado sin agenda, festivo). */
const ESTADO_MARCADOR = 'X';
/** Las citas de hoy de la lectura anterior, o `null` si no hay. */
async function leerCitasDia(conectorId) {
    const [rows] = await prisma_js_1.pool.query('SELECT cod_asignacion, fecha_dia, hora, estado, sync_en FROM citas_dia WHERE conector_id = ?', [conectorId]);
    if (rows.length === 0)
        return null;
    return {
        fechaDia: String(rows[0].fecha_dia).slice(0, 10),
        syncEn: String(rows[0].sync_en),
        citas: rows.filter((r) => r.estado !== ESTADO_MARCADOR)
            .map((r) => ({ cod: Number(r.cod_asignacion), hora: Number(r.hora), estado: r.estado })),
    };
}
/**
 * Reemplaza las citas de hoy de un conector Y registra los movimientos, en UNA transacción: si
 * algo falla no queda la lectura nueva sin sus movimientos (se perderían) ni al revés (se
 * repetirían en la siguiente vuelta). Siempre guarda una fila marcador, para distinguir
 * «hoy no hay citas» de «hoy no se ha leído».
 */
async function reemplazarCitasDia(conectorId, fechaDia, citas, syncEn, movimientos = []) {
    const conn = await prisma_js_1.pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM citas_dia WHERE conector_id = ?', [conectorId]);
        const filas = [
            [0, conectorId, fechaDia, 0, ESTADO_MARCADOR, syncEn],
            ...citas.map((c) => [c.cod, conectorId, fechaDia, c.hora, c.estado, syncEn]),
        ];
        for (let i = 0; i < filas.length; i += LOTE) {
            await conn.query('INSERT INTO citas_dia (cod_asignacion, conector_id, fecha_dia, hora, estado, sync_en) VALUES ?', [filas.slice(i, i + LOTE)]);
        }
        if (movimientos.length > 0) {
            await conn.query('INSERT INTO tv_movimientos (creado, tipo, cantidad, valor) VALUES ?', [movimientos.map((m) => [syncEn, m.tipo, m.cantidad, m.valor])]);
        }
        await conn.commit();
    }
    catch (err) {
        await conn.rollback();
        throw err;
    }
    finally {
        conn.release();
    }
}
/** Códigos de las citas pendientes guardadas ahora (para detectar las nuevas). */
async function leerCodigosAgenda(conectorId) {
    const [rows] = await prisma_js_1.pool.query('SELECT cod_asignacion FROM citas_agendadas WHERE conector_id = ?', [conectorId]);
    return new Set(rows.map((r) => Number(r.cod_asignacion)));
}
async function insertarMovimientos(movs, creado) {
    if (movs.length === 0)
        return;
    await prisma_js_1.pool.query('INSERT INTO tv_movimientos (creado, tipo, cantidad, valor) VALUES ?', [movs.map((m) => [creado, m.tipo, m.cantidad, m.valor])]);
}
/** Los últimos movimientos desde `desde`, del más reciente al más antiguo. */
async function leerMovimientos(desde, limite) {
    const [rows] = await prisma_js_1.pool.query('SELECT creado, tipo, cantidad, valor FROM tv_movimientos WHERE creado >= ? ORDER BY creado DESC, id DESC LIMIT ?', [desde, limite]);
    return rows.map((r) => ({ creado: String(r.creado), tipo: r.tipo, cantidad: Number(r.cantidad), valor: r.valor === null ? null : Number(r.valor) }));
}
async function purgarMovimientos(antes) {
    await prisma_js_1.pool.query('DELETE FROM tv_movimientos WHERE creado < ?', [antes]);
}
async function insertarFoto(f) {
    await prisma_js_1.pool.query('INSERT INTO tv_serie (ts, fecha_dia, facturado, atendidas, pendientes, incumplidas) VALUES (?, ?, ?, ?, ?, ?)', [f.ts, f.fechaDia, f.facturado, f.atendidas, f.pendientes, f.incumplidas]);
}
async function leerSerie(fechaDia) {
    const [rows] = await prisma_js_1.pool.query('SELECT ts, facturado, atendidas, pendientes, incumplidas FROM tv_serie WHERE fecha_dia = ? ORDER BY ts ASC', [fechaDia]);
    return rows.map((r) => ({
        ts: String(r.ts), facturado: Number(r.facturado), atendidas: Number(r.atendidas),
        pendientes: Number(r.pendientes), incumplidas: Number(r.incumplidas),
    }));
}
/**
 * El día anterior a `hoy` más reciente que tenga fotos CON DATOS (algún facturado > 0): un festivo entre
 * semana, con todo en 0, no sirve de referencia para comparar. `null` si no hay.
 */
async function fechaPreviaConSerie(hoy) {
    const [rows] = await prisma_js_1.pool.query(`SELECT MAX(d.fecha_dia) AS f
       FROM (SELECT fecha_dia FROM tv_serie WHERE fecha_dia < ? GROUP BY fecha_dia HAVING MAX(facturado) > 0) d`, [hoy]);
    return rows[0]?.f ? String(rows[0].f).slice(0, 10) : null;
}
async function purgarSerie(antes) {
    await prisma_js_1.pool.query('DELETE FROM tv_serie WHERE ts < ?', [antes]);
}
//# sourceMappingURL=tv.repo.js.map