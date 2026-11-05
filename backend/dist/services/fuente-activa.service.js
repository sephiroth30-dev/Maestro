"use strict";
/**
 * Fuente activa del dashboard.
 *
 * Qué conector ve el dashboard, y por tanto qué filas de `atenciones` entran en
 * cada reporte. Existe porque dos fuentes pueden tener cargado el mismo mes —el
 * Sheet histórico y la API de Medifolios— y hasta ahora ninguna consulta
 * distinguía el origen: las habría sumado, duplicando la facturación sin avisar.
 *
 * Es **distinta** de `conectores.activo`, que decide si un conector se
 * sincroniza. Durante la transición hace falta sincronizar Medifolios en
 * segundo plano y compararlo en Diagnóstico antes de que el dashboard lo
 * muestre.
 *
 * El id se cachea en memoria del proceso para poder leerlo de forma **síncrona**
 * desde los constructores de SQL (`buildDateWhere` lo es). El valor es global:
 * no depende de la petición ni del usuario, así que no hay que pasarlo por
 * parámetro desde el frontend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cargarFuenteActiva = cargarFuenteActiva;
exports.fuenteActivaId = fuenteActivaId;
exports.sqlFiltroFuente = sqlFiltroFuente;
exports._setFuenteActivaParaPruebas = _setFuenteActivaParaPruebas;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("./../config/logger.js");
/**
 * `undefined` = todavía no se ha consultado; `null` = no hay ninguna marcada.
 *
 * La diferencia importa: sin fuente marcada **no se filtra nada**, que es
 * exactamente el comportamiento anterior a este cambio.
 */
let fuenteActiva;
/** Relee la fuente activa de la base. Al arrancar y tras cada cambio. */
async function cargarFuenteActiva() {
    try {
        const [rows] = await prisma_js_1.pool.query('SELECT id FROM conectores WHERE es_fuente_activa = 1 LIMIT 1');
        fuenteActiva = rows[0]?.id ?? null;
        logger_js_1.logger.info('Fuente activa del dashboard', { conectorId: fuenteActiva });
    }
    catch (err) {
        // La columna puede no existir todavía si la migración no ha corrido. Sin
        // fuente activa no se filtra, que es el comportamiento de siempre: es
        // preferible a tumbar el arranque.
        fuenteActiva = null;
        logger_js_1.logger.warn('No se pudo leer la fuente activa; no se filtrará por origen', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
/** Id de la fuente activa, o `null` si no hay ninguna marcada. */
function fuenteActivaId() {
    return fuenteActiva ?? null;
}
/**
 * Fragmento de SQL que restringe las atenciones a la fuente activa.
 *
 * Devuelve cadena vacía y sin parámetros cuando no hay fuente marcada, de modo
 * que concatenarlo siempre es seguro.
 *
 * @param alias Alias de la tabla `atenciones` en la consulta, si lo tiene.
 */
function sqlFiltroFuente(alias) {
    const id = fuenteActivaId();
    if (!id)
        return ['', []];
    const col = alias ? `${alias}.conector_id` : 'conector_id';
    return [` AND ${col} = ?`, [id]];
}
/** Se expone para las pruebas: fija el valor sin tocar la base. */
function _setFuenteActivaParaPruebas(id) {
    fuenteActiva = id;
}
//# sourceMappingURL=fuente-activa.service.js.map