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
exports.asegurarFuenteActiva = asegurarFuenteActiva;
exports.cargarFuenteActiva = cargarFuenteActiva;
exports.fuenteActivaId = fuenteActivaId;
exports.sqlFiltroFuente = sqlFiltroFuente;
exports._setFuenteActivaParaPruebas = _setFuenteActivaParaPruebas;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("./../config/logger.js");
const fuente_activa_core_js_1 = require("./fuente-activa.core.js");
/** MySQL: la columna no existe (la migración m18 aún no corrió). */
const ER_BAD_FIELD_ERROR = 'ER_BAD_FIELD_ERROR';
async function leerDeBase() {
    try {
        const [rows] = await prisma_js_1.pool.query('SELECT id FROM conectores WHERE es_fuente_activa = 1 LIMIT 1');
        return rows[0]?.id ?? null;
    }
    catch (err) {
        // ÚNICO fallo que equivale de verdad a «no hay fuente marcada»: la columna
        // todavía no existe. Cualquier otro (conexión caída, timeout…) NO dice
        // nada sobre qué fuente hay marcada, y tratarlo como «ninguna» sumaría las
        // dos fuentes en silencio.
        if (err.code === ER_BAD_FIELD_ERROR) {
            logger_js_1.logger.warn('La columna es_fuente_activa no existe todavía; no se filtrará por origen');
            return null;
        }
        throw err;
    }
}
const estado = (0, fuente_activa_core_js_1.crearEstadoFuente)(leerDeBase, {
    maxEdadMs: 5_000,
    alFallar: (err) => logger_js_1.logger.warn('No se pudo releer la fuente activa; se conserva el último valor conocido', {
        error: err instanceof Error ? err.message : String(err),
    }),
});
/**
 * Garantiza que la fuente activa esté leída y sea reciente (máx. 5 s).
 *
 * Se llama en cada petición a `/api/` (ver `app.ts`). La frescura importa
 * porque el valor vive en la memoria de cada proceso y un cambio hecho en uno
 * tiene que llegar a los demás sin reiniciarlos.
 *
 * Lanza solo si nunca se ha podido leer: preferible a responder cifras
 * duplicadas.
 */
async function asegurarFuenteActiva() {
    await estado.asegurar();
}
/**
 * Relee la fuente activa ya. Al arrancar y tras cada cambio.
 *
 * No lanza: si falla, el hook de cada petición lo reintenta, y entre tanto se
 * conserva el valor anterior en vez de caer en «sin fuente».
 */
async function cargarFuenteActiva() {
    try {
        await estado.refrescar();
        logger_js_1.logger.info('Fuente activa del dashboard', { conectorId: estado.valor() ?? null });
    }
    catch (err) {
        logger_js_1.logger.warn('No se pudo leer la fuente activa', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
/** Id de la fuente activa, o `null` si no hay ninguna marcada (o aún no se leyó). */
function fuenteActivaId() {
    return estado.valor() ?? null;
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
    // Si nunca se ha leído, NO se devuelve «sin filtro»: eso es justo lo que
    // duplicaba las cifras. Esto solo ocurre si una consulta corre fuera del
    // hook de `app.ts`, y es un error de programación que debe verse.
    if (estado.valor() === undefined) {
        throw new Error('La fuente activa no se ha leído todavía: falta asegurarFuenteActiva() antes de consultar');
    }
    const id = fuenteActivaId();
    if (!id)
        return ['', []];
    const col = alias ? `${alias}.conector_id` : 'conector_id';
    return [` AND ${col} = ?`, [id]];
}
/** Se expone para las pruebas: fija el valor sin tocar la base. */
function _setFuenteActivaParaPruebas(id) {
    estado.fijar(id);
}
//# sourceMappingURL=fuente-activa.service.js.map