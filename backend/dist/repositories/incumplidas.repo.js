"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contarVentana = contarVentana;
exports.reemplazarVentana = reemplazarVentana;
exports.leerEstado = leerEstado;
exports.guardarEstado = guardarEstado;
exports.resumenPorEntidad = resumenPorEntidad;
const prisma_js_1 = require("../config/prisma.js");
/**
 * Consultas del resumen de citas cumplidas e incumplidas.
 *
 * ⚠ Escritas sin poder ejecutarlas (el entorno de desarrollo no tiene MySQL): sencillas, sin funciones de
 * ventana y con parámetros `?`. Las fechas llegan y salen como texto (`dateStrings: true`; el pool está
 * en UTC). No se guardan datos de pacientes: solo conteos por día y EPS.
 */
const LOTE = 500;
/** Cuántas cumplidas e incumplidas hay guardadas entre dos fechas (incluidas): sirve para detectar una respuesta vacía o diezmada. */
async function contarVentana(conectorId, desde, hasta) {
    const [rows] = await prisma_js_1.pool.query('SELECT SUM(cumplidas) AS c, SUM(incumplidas) AS i FROM citas_resumen_dia WHERE conector_id = ? AND fecha_dia >= ? AND fecha_dia <= ?', [conectorId, desde, hasta]);
    return { cumplidas: Number(rows[0]?.c ?? 0), incumplidas: Number(rows[0]?.i ?? 0) };
}
/**
 * Reemplaza TODO el resumen de un rango de fechas, en una transacción. Si algo falla se revierte y lo
 * anterior sigue ahí.
 */
async function reemplazarVentana(conectorId, desde, hasta, filas) {
    const conn = await prisma_js_1.pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM citas_resumen_dia WHERE conector_id = ? AND fecha_dia >= ? AND fecha_dia <= ?', [conectorId, desde, hasta]);
        for (let i = 0; i < filas.length; i += LOTE) {
            // `+` en el ON DUPLICATE: el rango ya se borró arriba, así que un choque de llave solo puede ser de dos filas de esta
            // misma carga (p. ej. convenios que la colación considera iguales): se SUMAN, no se pisan.
            const valores = filas.slice(i, i + LOTE).map((f) => [conectorId, f.fechaDia, f.entidadId, f.convenioNombre, f.cumplidas, f.incumplidas]);
            await conn.query(`INSERT INTO citas_resumen_dia (conector_id, fecha_dia, entidad_id, convenio_nombre, cumplidas, incumplidas)
         VALUES ?
         ON DUPLICATE KEY UPDATE cumplidas = cumplidas + VALUES(cumplidas), incumplidas = incumplidas + VALUES(incumplidas)`, [valores]);
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
const dia = (v) => (v === null || v === undefined ? null : String(v).slice(0, 10));
async function leerEstado(conectorId) {
    const [rows] = await prisma_js_1.pool.query(conectorId
        ? 'SELECT * FROM incumplidas_sync WHERE conector_id = ? LIMIT 1'
        : 'SELECT * FROM incumplidas_sync ORDER BY ultimo_intento DESC LIMIT 1', conectorId ? [conectorId] : []);
    const r = rows[0];
    if (!r)
        return null;
    const str = (k) => (r[k] === null || r[k] === undefined ? null : String(r[k]));
    return {
        conectorId: String(r['conector_id']),
        desde: dia(r['desde']),
        hasta: dia(r['hasta']),
        ultimoDiario: dia(r['ultimo_diario']),
        ultimoIntento: str('ultimo_intento'),
        ultimaOk: str('ultima_ok'),
        estado: (str('estado') ?? 'nunca'),
        error: str('error'),
    };
}
const COLUMNAS = {
    desde: 'desde', hasta: 'hasta', ultimoDiario: 'ultimo_diario', ultimoIntento: 'ultimo_intento', ultimaOk: 'ultima_ok', estado: 'estado', error: 'error',
};
/** Guarda SOLO los campos que se pasan. Lista cerrada de columnas: nada de lo que llegue se interpola en el SQL. */
async function guardarEstado(conectorId, cambios) {
    const claves = Object.keys(cambios).filter((k) => k in COLUMNAS);
    if (claves.length === 0)
        return;
    const cols = claves.map((k) => COLUMNAS[k]);
    const valores = claves.map((k) => {
        const v = cambios[k];
        return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 19).replace('T', ' ') : v;
    });
    await prisma_js_1.pool.query(`INSERT INTO incumplidas_sync (conector_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${cols.map((c) => `${c} = VALUES(${c})`).join(', ')}`, [conectorId, ...valores]);
}
function donde(f) {
    let w = 'c.conector_id = ? AND c.fecha_dia >= ? AND c.fecha_dia <= ?';
    const p = [f.conectorId, f.desde, f.hasta];
    if (f.entidadId) {
        w += ' AND c.entidad_id = ?';
        p.push(f.entidadId);
    }
    if (f.diaSemana !== undefined) {
        w += ' AND DAYOFWEEK(c.fecha_dia) = ?';
        p.push(f.diaSemana);
    }
    return [w, p];
}
/** Cumplidas e incumplidas por EPS en el filtro, de la que más incumplidas tiene a la que menos. */
async function resumenPorEntidad(f) {
    const [where, params] = donde(f);
    const [rows] = await prisma_js_1.pool.query(`SELECT c.entidad_id AS entidad_id,
            COALESCE(e.nombre, NULLIF(MAX(c.convenio_nombre), ''), 'SIN ENTIDAD') AS entidad,
            COALESCE(e.tipo, 'OTRO') AS tipo,
            SUM(c.cumplidas) AS cum,
            SUM(c.incumplidas) AS inc
       FROM citas_resumen_dia c
       LEFT JOIN entidades e ON e.id = c.entidad_id
      WHERE ${where}
      GROUP BY c.entidad_id, e.nombre, e.tipo, IF(c.entidad_id = '', c.convenio_nombre, '')
      ORDER BY inc DESC, entidad ASC`, params);
    return rows.map((r) => ({
        entidadId: r.entidad_id === '' ? null : r.entidad_id, entidad: r.entidad, tipo: r.tipo,
        cumplidas: Number(r.cum), incumplidas: Number(r.inc),
    }));
}
//# sourceMappingURL=incumplidas.repo.js.map