"use strict";
/**
 * Analítica de pacientes.
 *
 * La base sólo guarda dos campos de paciente (`paciente_nombre`,
 * `paciente_documento`), ambos opcionales y de texto libre. No hay fecha de
 * nacimiento, sexo ni ciudad, así que esto NO es demografía poblacional: es
 * analítica de utilización — cuántas personas distintas se atienden, cuántas
 * son nuevas y con qué frecuencia vuelven.
 *
 * Toda cifra se calcula sólo sobre las filas que sí tienen identificación; la
 * cobertura se devuelve aparte para que la interfaz pueda advertirlo.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCobertura = getCobertura;
exports.getResumen = getResumen;
exports.getNuevosRecurrentes = getNuevosRecurrentes;
exports.getFrecuencia = getFrecuencia;
exports.getPorPagador = getPorPagador;
exports.getMultiPagador = getMultiPagador;
exports.getPorServicio = getPorServicio;
exports.getRetencion = getRetencion;
exports.getDetalleAtenciones = getDetalleAtenciones;
const prisma_js_1 = require("../config/prisma.js");
const reportes_repo_js_1 = require("./reportes.repo.js");
const logger_js_1 = require("../config/logger.js");
/**
 * Llave canónica de paciente.
 *
 * Prefiere el documento (estable) y cae al nombre. Normaliza para absorber las
 * variantes reales de digitación: '1.234.567' vs '1234567', '  MARIA  PEREZ '
 * vs 'Maria Perez'.
 *
 * Deliberadamente NO usa el patrón `COALESCE(documento, nombre, a.id)` de
 * honorarios.repo: ese tercer respaldo es correcto para contar SESIONES (cada
 * fila anónima es una sesión propia) pero infla el conteo de PACIENTES en uno
 * por cada registro sin identificar.
 */
const KEY_REGEX = `NULLIF(COALESCE(
  NULLIF(REGEXP_REPLACE(UPPER(TRIM(a.paciente_documento)), '[^0-9A-Z]', ''), ''),
  NULLIF(REGEXP_REPLACE(UPPER(TRIM(a.paciente_nombre)), '[[:space:]]+', ' '), '')
), '')`;
/** Variante sin REGEXP_REPLACE, para motores que no lo soportan. */
const KEY_PLAIN = `NULLIF(COALESCE(
  NULLIF(UPPER(TRIM(a.paciente_documento)), ''),
  NULLIF(UPPER(TRIM(a.paciente_nombre)), '')
), '')`;
/** Errores que sí significan "el motor no soporta REGEXP_REPLACE". */
const ERRORES_SIN_SOPORTE = new Set([
    'ER_SP_DOES_NOT_EXIST', 'ER_PARSE_ERROR', 'ER_WRONG_PARAMCOUNT_TO_NATIVE_FCT',
]);
/** Se cachea la PROMESA, no el valor: las ocho consultas en paralelo comparten
 *  una sola sonda en vez de lanzar ocho idénticas. */
let sonda = null;
/**
 * Resuelve qué expresión de llave soporta el motor.
 *
 * REGEXP_REPLACE existe en MySQL 8 y MariaDB 10.0.5+, pero el plan de Hostinger
 * no está garantizado. Solo se degrada ante un error que de verdad indique
 * ausencia de la función: un `catch` genérico dejaría que una desconexión
 * pasajera fijara KEY_PLAIN para toda la vida del proceso, y como esa variante
 * no normaliza la puntuación, '1.234.567' y '1234567' pasarían a ser dos
 * pacientes distintos, inflando únicos y nuevos sin ninguna señal.
 */
async function getKeyExpr() {
    if (sonda)
        return sonda;
    sonda = (async () => {
        try {
            await prisma_js_1.pool.query(`SELECT REGEXP_REPLACE('a-1', '[^0-9A-Z]', '') AS t`);
            return KEY_REGEX;
        }
        catch (err) {
            const code = err.code ?? '';
            if (!ERRORES_SIN_SOPORTE.has(code)) {
                sonda = null; // fallo transitorio: se reintenta en la próxima petición
                throw err;
            }
            logger_js_1.logger.warn('REGEXP_REPLACE no disponible: la llave de paciente no normalizará la puntuación', { code });
            return KEY_PLAIN;
        }
    })();
    return sonda;
}
function where(p) {
    const [clause, params] = (0, reportes_repo_js_1.buildDateWhere)(p.mesIdx, p.anio, p.startDate, p.endDate, p.diaSemana);
    const out = [...params];
    let c = clause;
    if (p.entidadId) {
        c += ' AND a.entidad_id = ?';
        out.push(p.entidadId);
    }
    return [c, out];
}
async function getCobertura(p) {
    const K = await getKeyExpr();
    const [w, params] = where(p);
    const [rows] = await prisma_js_1.pool.query(`SELECT
       COUNT(*)                                                        AS filas,
       SUM(CASE WHEN ${K} IS NOT NULL THEN 1 ELSE 0 END)               AS filas_con_paciente,
       SUM(CASE WHEN NULLIF(TRIM(a.paciente_documento), '') IS NOT NULL
                THEN 1 ELSE 0 END)                                     AS filas_con_documento,
       COALESCE(SUM(a.valor_bruto), 0)                                 AS valor_total,
       COALESCE(SUM(CASE WHEN ${K} IS NULL THEN a.valor_bruto ELSE 0 END), 0) AS valor_sin_paciente
     FROM atenciones a
     WHERE ${w}`, params);
    const [porConector] = await prisma_js_1.pool.query(`SELECT
       a.conector_id,
       c.nombre AS conector_nombre,
       COUNT(*) AS filas,
       SUM(CASE WHEN ${K} IS NOT NULL THEN 1 ELSE 0 END) AS filas_con_paciente
     FROM atenciones a
     LEFT JOIN conectores c ON c.id = a.conector_id
     WHERE ${w}
     GROUP BY a.conector_id, c.nombre
     ORDER BY filas DESC`, params);
    const g = rows[0] ?? {};
    return {
        global: {
            filas: Number(g.filas ?? 0),
            filas_con_paciente: Number(g.filas_con_paciente ?? 0),
            filas_con_documento: Number(g.filas_con_documento ?? 0),
            valor_total: Number(g.valor_total ?? 0),
            valor_sin_paciente: Number(g.valor_sin_paciente ?? 0),
        },
        porConector: porConector.map((r) => ({
            conector_id: r.conector_id ?? null,
            conector_nombre: r.conector_nombre ?? null,
            filas: Number(r.filas ?? 0),
            filas_con_paciente: Number(r.filas_con_paciente ?? 0),
        })),
    };
}
async function getResumen(p) {
    const K = await getKeyExpr();
    const [w, params] = where(p);
    const [rows] = await prisma_js_1.pool.query(`SELECT
       COUNT(DISTINCT ${K}) AS pacientes_unicos,
       SUM(CASE WHEN ${K} IS NOT NULL THEN 1 ELSE 0 END) AS atenciones_con_paciente,
       COUNT(DISTINCT CASE WHEN ${K} IS NOT NULL
             THEN CONCAT(${K}, '|', DATE(a.fecha_dia)) END) AS visitas_unicas
     FROM atenciones a
     WHERE ${w}`, params);
    const r = rows[0] ?? {};
    return {
        pacientes_unicos: Number(r.pacientes_unicos ?? 0),
        atenciones_con_paciente: Number(r.atenciones_con_paciente ?? 0),
        visitas_unicas: Number(r.visitas_unicas ?? 0),
    };
}
// ─── Nuevos vs. recurrentes ───────────────────────────────────────────────────
/**
 * "Nuevo" = sin ningún registro anterior EN LOS DATOS DISPONIBLES.
 *
 * Se compara contra `fecha_dia`, nunca contra `created_at` ni `id`: la
 * sincronización borra e reinserta todas las filas del conector en cada corrida
 * (`DELETE FROM atenciones WHERE conector_id = ?`), así que esos dos campos se
 * reinician y no sirven como línea de tiempo.
 */
async function getNuevosRecurrentes(p) {
    const K = await getKeyExpr();
    const [w, params] = where(p);
    const [rows] = await prisma_js_1.pool.query(`SELECT
       SUM(CASE WHEN periodo.primera = historico.primera THEN 1 ELSE 0 END) AS nuevos,
       SUM(CASE WHEN periodo.primera > historico.primera THEN 1 ELSE 0 END) AS recurrentes
     FROM (
       SELECT ${K} AS k, MIN(DATE(a.fecha_dia)) AS primera
       FROM atenciones a
       WHERE ${w} AND ${K} IS NOT NULL
       GROUP BY k
     ) periodo
     JOIN (
       SELECT ${K} AS k, MIN(DATE(a.fecha_dia)) AS primera
       FROM atenciones a
       WHERE ${K} IS NOT NULL
       GROUP BY k
     ) historico ON historico.k = periodo.k`, params);
    const [hist] = await prisma_js_1.pool.query(`SELECT MIN(DATE(fecha_dia)) AS desde FROM atenciones`);
    const r = rows[0] ?? {};
    const desde = hist[0]?.desde;
    return {
        nuevos: Number(r.nuevos ?? 0),
        recurrentes: Number(r.recurrentes ?? 0),
        historia_desde: desde ? new Date(desde).toISOString().slice(0, 10) : null,
    };
}
/** Los tramos cuentan VISITAS (fechas distintas), no filas: un EMG y un VCN el
 *  mismo día son dos atenciones pero una sola visita. */
async function getFrecuencia(p) {
    const K = await getKeyExpr();
    const [w, params] = where(p);
    const [rows] = await prisma_js_1.pool.query(`SELECT
       SUM(CASE WHEN v.visitas = 1             THEN 1 ELSE 0 END) AS b1,
       SUM(CASE WHEN v.visitas BETWEEN 2 AND 3 THEN 1 ELSE 0 END) AS b2,
       SUM(CASE WHEN v.visitas BETWEEN 4 AND 6 THEN 1 ELSE 0 END) AS b3,
       SUM(CASE WHEN v.visitas >= 7            THEN 1 ELSE 0 END) AS b4
     FROM (
       SELECT ${K} AS k, COUNT(DISTINCT DATE(a.fecha_dia)) AS visitas
       FROM atenciones a
       WHERE ${w} AND ${K} IS NOT NULL
       GROUP BY k
     ) v`, params);
    const r = rows[0] ?? {};
    return [
        { bucket: '1', pacientes: Number(r.b1 ?? 0) },
        { bucket: '2-3', pacientes: Number(r.b2 ?? 0) },
        { bucket: '4-6', pacientes: Number(r.b3 ?? 0) },
        { bucket: '7+', pacientes: Number(r.b4 ?? 0) },
    ];
}
/**
 * OJO: estos conteos NO suman `pacientes_unicos`. Un paciente con una atención
 * por EPS y otra particular se cuenta en ambos tramos. Por eso la interfaz lo
 * dibuja como barras y nunca como una torta.
 */
async function getPorPagador(p) {
    const K = await getKeyExpr();
    const [w, params] = where(p);
    const [rows] = await prisma_js_1.pool.query(`SELECT
       COALESCE(e.tipo, 'SIN_ENTIDAD') AS tipo,
       COUNT(DISTINCT ${K}) AS pacientes,
       COUNT(*)             AS atenciones,
       COALESCE(SUM(a.valor_bruto), 0) AS valor
     FROM atenciones a
     LEFT JOIN entidades e ON e.id = a.entidad_id
     WHERE ${w} AND ${K} IS NOT NULL
     GROUP BY COALESCE(e.tipo, 'SIN_ENTIDAD')
     ORDER BY pacientes DESC`, params);
    return rows.map((r) => ({
        clave: r.tipo,
        nombre: r.tipo === 'SIN_ENTIDAD' ? 'Sin entidad' : r.tipo,
        pacientes: Number(r.pacientes ?? 0),
        atenciones: Number(r.atenciones ?? 0),
        valor: Number(r.valor ?? 0),
    }));
}
/** Pacientes que aparecen en más de un tipo de pagador dentro del período. */
async function getMultiPagador(p) {
    const K = await getKeyExpr();
    const [w, params] = where(p);
    const [rows] = await prisma_js_1.pool.query(`SELECT COUNT(*) AS n FROM (
       SELECT ${K} AS k
       FROM atenciones a
       LEFT JOIN entidades e ON e.id = a.entidad_id
       WHERE ${w} AND ${K} IS NOT NULL
       GROUP BY k
       HAVING COUNT(DISTINCT COALESCE(e.tipo, 'SIN_ENTIDAD')) > 1
     ) t`, params);
    return Number(rows[0]?.n ?? 0);
}
async function getPorServicio(p) {
    const K = await getKeyExpr();
    const [w, params] = where(p);
    const [rows] = await prisma_js_1.pool.query(`SELECT
       a.servicio_id,
       COALESCE(s.nombre_display, s.nombre, 'Sin clasificar') AS nombre,
       COUNT(DISTINCT ${K}) AS pacientes,
       COUNT(*)             AS atenciones,
       COALESCE(SUM(a.valor_bruto), 0) AS valor
     FROM atenciones a
     LEFT JOIN servicios s ON s.id = a.servicio_id
     WHERE ${w} AND ${K} IS NOT NULL
     GROUP BY a.servicio_id, nombre
     ORDER BY pacientes DESC`, params);
    return rows.map((r) => ({
        clave: r.servicio_id ?? null,
        nombre: r.nombre,
        pacientes: Number(r.pacientes ?? 0),
        atenciones: Number(r.atenciones ?? 0),
        valor: Number(r.valor ?? 0),
    }));
}
/**
 * Un paciente está "retenido" en el mes M si vuelve en M+1.
 *
 * La ventana del lado derecho se extiende un mes más allá del período pedido;
 * si no, el último mes siempre reportaría 0 % y parecería una caída del negocio
 * en vez de un artefacto de la consulta.
 */
async function getRetencion(p, desde, hasta) {
    const K = await getKeyExpr();
    // Fin del mes siguiente, no "el mismo día del mes siguiente": setMonth(+1)
    // sobre un 28 o un 30 recorta los últimos días del mes destino y subestima la
    // retención del último mes cerrado.
    const hastaExt = new Date(Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth() + 2, 0, 23, 59, 59));
    // Mismos filtros de entidad y día que el resto de la página; sin esto la
    // gráfica mostraría la clínica completa junto a indicadores ya filtrados.
    const extra = [];
    const extraParams = [];
    if (p.entidadId) {
        extra.push('a.entidad_id = ?');
        extraParams.push(p.entidadId);
    }
    if (p.diaSemana !== undefined) {
        extra.push('DAYOFWEEK(a.fecha_dia) = ?');
        extraParams.push(p.diaSemana);
    }
    const f = extra.length > 0 ? ` AND ${extra.join(' AND ')}` : '';
    const [rows] = await prisma_js_1.pool.query(`SELECT m.anio, m.mes_idx,
            COUNT(DISTINCT m.k) AS pacientes,
            COUNT(DISTINCT CASE WHEN n.k IS NOT NULL THEN m.k END) AS retenidos
     FROM (
       SELECT DISTINCT ${K} AS k, a.anio, a.mes_idx
       FROM atenciones a
       WHERE a.fecha_dia >= ? AND a.fecha_dia <= ? AND ${K} IS NOT NULL${f}
     ) m
     LEFT JOIN (
       SELECT DISTINCT ${K} AS k, a.anio, a.mes_idx
       FROM atenciones a
       WHERE a.fecha_dia >= ? AND a.fecha_dia <= ? AND ${K} IS NOT NULL${f}
     ) n
       ON n.k = m.k AND (n.anio * 12 + n.mes_idx) = (m.anio * 12 + m.mes_idx) + 1
     GROUP BY m.anio, m.mes_idx
     ORDER BY m.anio, m.mes_idx`, [desde, hasta, ...extraParams, desde, hastaExt, ...extraParams]);
    return rows.map((r) => ({
        anio: Number(r.anio),
        mes_idx: Number(r.mes_idx),
        pacientes: Number(r.pacientes ?? 0),
        retenidos: Number(r.retenidos ?? 0),
    }));
}
/**
 * Una fila por atención del período. Es lo que pide quien quiere armar sus
 * propias tablas dinámicas y lo que los manuales ya prometían.
 *
 * `limit` acota el volumen: la respuesta va completa en memoria y de ahí al
 * navegador, así que no puede ser ilimitada.
 */
async function getDetalleAtenciones(p, limit) {
    const [w, params] = where(p);
    const [countRows] = await prisma_js_1.pool.query(`SELECT COUNT(*) AS n FROM atenciones a WHERE ${w}`, params);
    const total = Number(countRows[0]?.n ?? 0);
    const [rows] = await prisma_js_1.pool.query(`SELECT
       DATE(a.fecha_dia) AS fecha,
       a.paciente_nombre,
       a.paciente_documento,
       COALESCE(e.nombre, a.entidad_nombre_raw) AS entidad,
       e.tipo AS entidad_tipo,
       COALESCE(pr.nombre_completo, pr.nombre, a.profesional_nombre_raw) AS profesional,
       COALESCE(s.nombre_display, s.nombre) AS servicio,
       a.descripcion_raw,
       a.numero_autorizacion,
       a.valor_bruto
     FROM atenciones a
     LEFT JOIN entidades e     ON e.id  = a.entidad_id
     LEFT JOIN profesionales pr ON pr.id = a.profesional_id
     LEFT JOIN servicios s     ON s.id  = a.servicio_id
     WHERE ${w}
     ORDER BY a.fecha_dia ASC, a.id ASC
     LIMIT ?`, [...params, limit]);
    return {
        total,
        rows: rows.map((r) => ({
            fecha: new Date(r.fecha).toISOString().slice(0, 10),
            paciente: r.paciente_nombre ?? null,
            documento: r.paciente_documento ?? null,
            entidad: r.entidad ?? null,
            entidad_tipo: r.entidad_tipo ?? null,
            profesional: r.profesional ?? null,
            servicio: r.servicio ?? null,
            descripcion: r.descripcion_raw ?? '',
            autorizacion: r.numero_autorizacion ?? null,
            valor_bruto: Number(r.valor_bruto ?? 0),
        })),
    };
}
//# sourceMappingURL=pacientes.repo.js.map