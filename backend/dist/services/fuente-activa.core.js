"use strict";
/**
 * Estado de la fuente activa, sin acceso a base de datos.
 *
 * Está aparte de `fuente-activa.service.ts` para poder probarlo con un lector
 * falso. Y existe, en su forma actual, por tres fallos de la versión anterior
 * que daban la MISMA cifra equivocada —las dos fuentes sumadas— sin avisar:
 *
 * 1. **Se leía una sola vez, al arrancar.** El valor vive en la memoria del
 *    proceso, y Passenger puede tener varios: el clic en «Usar como fuente»
 *    actualizaba el que atendía esa petición y dejaba a los demás con el valor
 *    viejo.
 * 2. **Un fallo de lectura se convertía en «no filtrar».** El `catch` dejaba el
 *    valor en `null`, y `null` significa «no hay fuente marcada, suma todo».
 *    Un hipo de la base al arrancar bastaba para duplicar las cifras de ese
 *    proceso hasta el siguiente reinicio.
 * 3. **Se servían peticiones antes de leerla.** El puerto se abre primero (lo
 *    exige el watchdog de Hostinger), así que durante la conexión a la base
 *    las consultas corrían sin filtro, y su resultado quedaba en caché.
 *
 * La regla de fondo: ante la duda, **no inventar una cifra**. Se conserva el
 * último valor bueno, y si nunca hubo uno, se falla en voz alta.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearEstadoFuente = crearEstadoFuente;
function crearEstadoFuente(leer, opciones = {}) {
    const maxEdadMs = opciones.maxEdadMs ?? 5_000;
    const ahora = opciones.ahora ?? Date.now;
    let actual;
    let leidoEn = 0;
    let enVuelo = null;
    // Una sola lectura a la vez: con muchas peticiones simultáneas, todas
    // esperan la misma consulta en vez de lanzar una cada una.
    function refrescar() {
        if (!enVuelo) {
            enVuelo = (async () => {
                try {
                    actual = await leer();
                    leidoEn = ahora();
                }
                finally {
                    enVuelo = null;
                }
            })();
        }
        return enVuelo;
    }
    async function asegurar() {
        if (actual !== undefined && ahora() - leidoEn < maxEdadMs)
            return;
        try {
            await refrescar();
        }
        catch (err) {
            // Nunca hubo una lectura buena: no hay nada que conservar, y seguir
            // adelante sería inventar «sin fuente = sumar todo».
            if (actual === undefined)
                throw err;
            // Hubo una: se conserva, y se marca como «leída ahora» para no
            // martillar una base de datos caída con una consulta por petición.
            leidoEn = ahora();
            opciones.alFallar?.(err);
        }
    }
    return {
        asegurar,
        refrescar,
        valor: () => actual,
        fijar: (v) => { actual = v; leidoEn = ahora(); },
    };
}
//# sourceMappingURL=fuente-activa.core.js.map