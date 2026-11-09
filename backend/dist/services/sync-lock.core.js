"use strict";
/**
 * Candado de sincronización entre procesos, sin acceso directo a la base.
 *
 * Existe porque nada impedía que una misma fuente se sincronizara varias veces
 * a la vez. Cada proceso del servidor (Passenger puede tener varios) programa el
 * mismo cron y, al arrancar, lanza además un «catch-up», así que a la hora en
 * punto salían varias sincronizaciones simultáneas del mismo conector. Con una
 * API que paga cada página, y un guardado que es «borrar todo y reinsertar», eso
 * producía dos fallos distintos en el historial:
 *
 * - **HTTP 401.** Si Medifolios emite un solo token vigente por usuario, cada
 *   proceso que entra invalida el token del anterior: se pisan entre ellos.
 * - **Duplicate entry en `atenciones_hash_fila_key`.** Dos sincronizaciones
 *   terminan casi a la vez e insertan las mismas filas (mismo hash); la segunda
 *   choca con la primera. Tras ~25 minutos de descarga, no queda nada.
 *
 * Se usa `GET_LOCK` de MySQL porque lo ven todos los procesos y, a diferencia de
 * una marca en una tabla, **se libera solo si el proceso muere**: MySQL lo
 * suelta al cerrarse la conexión que lo tiene. Una marca `EN_PROCESO` huérfana
 * habría bloqueado la fuente para siempre sin un plazo de caducidad que adivinar.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.nombreCandado = nombreCandado;
exports.crearAdquisidor = crearAdquisidor;
function nombreCandado(conectorId) {
    // MySQL limita el nombre a 64 caracteres: 13 de prefijo + 36 de un UUID caben de sobra.
    return `maestro:sync:${conectorId}`;
}
function crearAdquisidor(obtenerConexion, opciones = {}) {
    const heartbeatMs = opciones.heartbeatMs ?? 60_000;
    return async function adquirir(conectorId) {
        const nombre = nombreCandado(conectorId);
        const conn = await obtenerConexion();
        let obtenido = false;
        try {
            // Timeout 0: si otro proceso ya lo tiene, no se espera — se omite esta ronda.
            const res = (await conn.query('SELECT GET_LOCK(?, 0) AS ok', [nombre]));
            obtenido = res[0]?.[0]?.ok === 1;
        }
        catch (err) {
            conn.release();
            throw err;
        }
        if (!obtenido) {
            conn.release();
            return null;
        }
        let perdido = false;
        let liberado = false;
        // Una sincronización puede tardar más de 25 minutos con la conexión parada.
        // Sin esto, un servidor con `wait_timeout` corto la cerraría en silencio y el
        // candado se soltaría a mitad de sincronización.
        const latido = setInterval(() => {
            conn.query('SELECT 1').catch((err) => {
                if (perdido)
                    return;
                perdido = true;
                opciones.alPerder?.(err);
            });
        }, heartbeatMs);
        latido.unref?.();
        return {
            perdido: () => perdido,
            async liberar() {
                if (liberado)
                    return;
                liberado = true;
                clearInterval(latido);
                try {
                    if (!perdido)
                        await conn.query('SELECT RELEASE_LOCK(?)', [nombre]);
                }
                catch {
                    perdido = true;
                }
                finally {
                    // Una conexión caída no debe volver al pool: la siguiente consulta que
                    // la reciba fallaría sin motivo.
                    if (perdido && conn.destroy)
                        conn.destroy();
                    else
                        conn.release();
                }
            },
        };
    };
}
//# sourceMappingURL=sync-lock.core.js.map