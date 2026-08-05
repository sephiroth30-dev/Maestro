"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capacidadRepo = exports.CapacidadRepository = void 0;
exports._resetSondasCapacidad = _resetSondasCapacidad;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("../config/logger.js");
const paciente_key_js_1 = require("./paciente-key.js");
const capacidad_grupos_js_1 = require("../config/capacidad-grupos.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapCapacidad(row) {
    return {
        id: row.id,
        grupo: row.grupo,
        nombre: row.nombre,
        anio: row.anio,
        mesIdx: row.mes_idx,
        capacidad: row.capacidad,
        recursos: row.recursos,
        baseConteo: row.base_conteo ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapUtilizacion(row) {
    const pacientes = Number(row.pacientes);
    const estudios = Number(row.estudios);
    const capacidad = row.capacidad != null ? Number(row.capacidad) : null;
    // La base viene resuelta del SQL cuando la columna existe; si no, se aplica
    // aquí el valor por omisión del catálogo.
    const base = row.base ?? capacidad_grupos_js_1.BASE_POR_GRUPO[row.grupo] ?? 'pacientes';
    const demanda = base === 'estudios' ? estudios : pacientes;
    // El porcentaje y el disponible se calculan en TypeScript y no en SQL: la
    // fórmula estaba repetida en las dos consultas y con dos bases habría hecho
    // falta un CASE anidado en cada una.
    const hayCapacidad = capacidad != null && capacidad > 0;
    return {
        grupo: row.grupo,
        nombre: row.nombre,
        capacidad,
        base,
        pacientes,
        estudios,
        sinPaciente: Number(row.sin_paciente),
        sesiones: demanda,
        pctOcupacion: hayCapacidad ? Math.round((demanda / capacidad) * 1000) / 10 : null,
        disponible: hayCapacidad ? capacidad - demanda : null,
    };
}
/**
 * ¿Existe `capacidad_instalada.base_conteo`?
 *
 * La migración que la añade puede no haber corrido: el runner registra el fallo
 * con un `logger.warn` y sigue. Sin esta sonda, un despliegue a medias dejaría
 * *toda* la pantalla de capacidad con error 500 en vez de degradarse a las bases
 * por omisión del catálogo.
 */
let sondaBase = null;
async function tieneBaseConteo() {
    if (sondaBase)
        return sondaBase;
    sondaBase = (async () => {
        try {
            const [rows] = await prisma_js_1.pool.query(`SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'capacidad_instalada'
           AND COLUMN_NAME = 'base_conteo' LIMIT 1`);
            return rows.length > 0;
        }
        catch (err) {
            sondaBase = null; // fallo transitorio: se reintenta
            throw err;
        }
    })();
    return sondaBase;
}
/**
 * Subconsulta de demanda: por grupo, cuántos estudios y cuántas visitas.
 *
 * `extraCols` y `extraGroup` permiten reutilizarla para el rango, que además
 * agrupa por año y mes.
 */
function sqlDemanda(keyExpr, whereClause, extraCols = '', extraGroup = '') {
    return `SELECT
          ${extraCols}${(0, capacidad_grupos_js_1.sqlClasificacionGrupo)('sv.nombre')} AS grupo,
          COUNT(a.id) AS estudios,
          COUNT(DISTINCT ${(0, paciente_key_js_1.sqlLlaveVisita)(keyExpr)}) AS pacientes,
          SUM(CASE WHEN ${keyExpr} IS NULL THEN 1 ELSE 0 END) AS sin_paciente
        FROM atenciones a
        JOIN servicios sv ON sv.id = a.servicio_id
        WHERE ${whereClause}
        GROUP BY ${extraGroup}grupo
        HAVING grupo IS NOT NULL`;
}
// ─── Repository ───────────────────────────────────────────────────────────────
class CapacidadRepository {
    async upsert(data) {
        const id = (0, node_crypto_1.randomUUID)();
        const conBase = await tieneBaseConteo();
        const cols = ['id', 'grupo', 'nombre', 'anio', 'mes_idx', 'capacidad', 'recursos'];
        const vals = [
            id, data.grupo, data.nombre, data.anio, data.mesIdx, data.capacidad, data.recursos ?? null,
        ];
        const sets = ['nombre = VALUES(nombre)', 'capacidad = VALUES(capacidad)', 'recursos = VALUES(recursos)'];
        if (conBase) {
            cols.push('base_conteo');
            vals.push(data.baseConteo ?? null);
            sets.push('base_conteo = VALUES(base_conteo)');
        }
        await prisma_js_1.pool.execute(`INSERT INTO capacidad_instalada (${cols.join(', ')}, created_at, updated_at)
       VALUES (${cols.map(() => '?').join(', ')}, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE ${sets.join(', ')}, updated_at = NOW(3)`, vals);
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ? LIMIT 1', [data.grupo, data.anio, data.mesIdx]);
        return mapCapacidad(rows[0]);
    }
    async findByAnio(anio) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM capacidad_instalada WHERE anio = ? ORDER BY mes_idx ASC', [anio]);
        return rows.map(mapCapacidad);
    }
    async deleteOne(grupo, anio, mesIdx) {
        await prisma_js_1.pool.execute('DELETE FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ?', [grupo, anio, mesIdx]);
    }
    /**
     * Utilización de un mes.
     *
     * Devuelve las DOS cifras de demanda —visitas y estudios— y cuál de ellas
     * gobierna la ocupación. Antes solo devolvía una, sin decir cuál era, y por eso
     * no se podía conciliar con «Mix por Servicio»: en Potenciales Evocados la
     * pantalla mostraba 56 (visitas) mientras el área reportaba 151 (estudios), y
     * ninguna de las dos era un error.
     */
    async getUtilizacion(anio, mesIdx) {
        const keyExpr = await (0, paciente_key_js_1.getKeyExpr)();
        const conBase = await tieneBaseConteo();
        const base = conBase ? 'COALESCE(ci.base_conteo, g.base_def)' : 'g.base_def';
        const [rows] = await prisma_js_1.pool.query(`SELECT
        g.grupo,
        g.nombre,
        ci.capacidad,
        ${base} AS base,
        COALESCE(s.pacientes, 0)    AS pacientes,
        COALESCE(s.estudios, 0)     AS estudios,
        COALESCE(s.sin_paciente, 0) AS sin_paciente
      FROM (
          ${(0, capacidad_grupos_js_1.sqlCatalogoGrupos)()}
      ) g
      LEFT JOIN capacidad_instalada ci ON ci.grupo = g.grupo AND ci.anio = ? AND ci.mes_idx = ?
      LEFT JOIN (
        ${sqlDemanda(keyExpr, 'a.mes_idx = ? AND a.anio = ?')}
      ) s ON s.grupo = g.grupo
      ORDER BY ${(0, capacidad_grupos_js_1.sqlOrdenGrupos)('g.grupo')}`, [anio, mesIdx, mesIdx, anio]);
        return rows.map(mapUtilizacion);
    }
    /**
     * Utilización mes a mes en un rango, para ver y exportar el histórico.
     *
     * Se resuelve en UNA consulta agrupando por (año, mes, grupo) en vez de
     * repetir la consulta mensual N veces: el conteo de visitas deduplica por
     * paciente y fecha, así que doce llamadas serían doce recorridos completos.
     *
     * Solo aparecen los meses con actividad o con capacidad configurada; un mes
     * enteramente vacío no genera filas.
     */
    async getUtilizacionRango(desdeAnio, desdeMes, hastaAnio, hastaMes) {
        // Se compara por (anio*12 + mes) para que el rango cruce el fin de año.
        const desde = desdeAnio * 12 + desdeMes;
        const hasta = hastaAnio * 12 + hastaMes;
        const keyExpr = await (0, paciente_key_js_1.getKeyExpr)();
        const conBase = await tieneBaseConteo();
        const base = conBase ? 'COALESCE(ci.base_conteo, p.base_def)' : 'p.base_def';
        const [rows] = await prisma_js_1.pool.query(`SELECT
        p.anio,
        p.mes_idx,
        p.grupo,
        p.nombre,
        ci.capacidad,
        ${base} AS base,
        COALESCE(s.pacientes, 0)    AS pacientes,
        COALESCE(s.estudios, 0)     AS estudios,
        COALESCE(s.sin_paciente, 0) AS sin_paciente
      FROM (
        -- Producto de los grupos por los meses que tienen algo: atenciones o
        -- capacidad configurada.
        SELECT g.grupo, g.nombre, g.base_def, m.anio, m.mes_idx
        FROM (
            ${(0, capacidad_grupos_js_1.sqlCatalogoGrupos)()}
        ) g
        CROSS JOIN (
          SELECT DISTINCT anio, mes_idx FROM atenciones
          WHERE (anio * 12 + mes_idx) BETWEEN ? AND ?
          UNION
          SELECT DISTINCT anio, mes_idx FROM capacidad_instalada
          WHERE (anio * 12 + mes_idx) BETWEEN ? AND ?
        ) m
      ) p
      LEFT JOIN capacidad_instalada ci
        ON ci.grupo = p.grupo AND ci.anio = p.anio AND ci.mes_idx = p.mes_idx
      LEFT JOIN (
        ${sqlDemanda(keyExpr, '(a.anio * 12 + a.mes_idx) BETWEEN ? AND ?', 'a.anio,\n          a.mes_idx,\n          ', 'a.anio, a.mes_idx, ')}
      ) s ON s.grupo = p.grupo AND s.anio = p.anio AND s.mes_idx = p.mes_idx
      ORDER BY p.anio, p.mes_idx, ${(0, capacidad_grupos_js_1.sqlOrdenGrupos)('p.grupo')}`, [desde, hasta, desde, hasta, desde, hasta]);
        return rows.map((r) => ({
            ...mapUtilizacion(r),
            anio: Number(r.anio),
            mesIdx: Number(r.mes_idx),
        }));
    }
}
exports.CapacidadRepository = CapacidadRepository;
exports.capacidadRepo = new CapacidadRepository();
/** Se expone para las pruebas: permite reiniciar las sondas entre casos. */
function _resetSondasCapacidad() {
    sondaBase = null;
    logger_js_1.logger.debug('Sondas de capacidad reiniciadas');
}
//# sourceMappingURL=capacidad.repo.js.map