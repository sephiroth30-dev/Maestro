"use strict";
/**
 * Llave canónica de paciente, compartida.
 *
 * Vivía dentro de `pacientes.repo.ts`, pero Capacidad necesita exactamente la
 * misma definición: si las dos pantallas discrepan sobre qué cuenta como *una*
 * persona, sus cifras no se pueden conciliar y no hay forma de saber cuál miente.
 *
 * Prefiere el documento (estable) y cae al nombre. Normaliza para absorber las
 * variantes reales de digitación: '1.234.567' vs '1234567', '  MARIA  PEREZ '
 * vs 'Maria Perez'.
 *
 * Deliberadamente NO usa el patrón `COALESCE(documento, nombre, a.id)` de
 * honorarios.repo: ese tercer respaldo es correcto para contar SESIONES (cada
 * fila anónima es una sesión propia) pero infla el conteo de PACIENTES en uno
 * por cada registro sin identificar.
 *
 * Todas las expresiones asumen que la tabla `atenciones` está aliasada como `a`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeyExpr = getKeyExpr;
exports.sqlLlaveVisita = sqlLlaveVisita;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("../config/logger.js");
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
/** Se cachea la PROMESA, no el valor: las consultas en paralelo comparten una
 *  sola sonda en vez de lanzar una idéntica cada una. */
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
/**
 * Llave de *visita*: paciente + día. Es lo que hay que contar cuando la
 * capacidad se mide en huecos de agenda y no en estudios facturados.
 *
 * El respaldo `CONCAT('#', a.id)` no es un detalle menor. La expresión anterior
 * era `CONCAT(fecha, '|', COALESCE(nombre,''), '|', COALESCE(documento,''))`, que
 * ante un registro sin identificación se reducía a `'2026-06-03||'` — idéntica
 * para todas las filas anónimas de ese día. Con una fuente sin columna de
 * paciente, la jornada entera colapsaba en UNA visita y la ocupación quedaba
 * silenciosamente reducida al número de días distintos del mes.
 *
 * Sin identificación no se puede deduplicar: cada fila se cuenta como su propia
 * visita, que es el supuesto conservador. `sinPaciente` reporta cuántas son para
 * que la interfaz pueda advertirlo en vez de esconderlo.
 */
function sqlLlaveVisita(keyExpr) {
    return `CONCAT(DATE(a.fecha_dia), '|', COALESCE(${keyExpr}, CONCAT('#', a.id)))`;
}
//# sourceMappingURL=paciente-key.js.map