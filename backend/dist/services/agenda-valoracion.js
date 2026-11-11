"use strict";
/**
 * Valoración de una cita, sin base de datos.
 *
 * La API de Medifolios no trae el precio de una cita, así que se ESTIMA con lo
 * que de verdad se ha facturado antes a esa EPS por ese tipo de servicio.
 *
 * ## Por qué no la tarifa del convenio
 *
 * `GET /catalogos/convenios/{id}/tarifa` existe, pero es una consulta por cada
 * convenio × procedimiento y la propia especificación advierte que *«NO es el
 * valor facturado»*: en agosto solo el 41 % de las líneas se facturó a la tarifa
 * del convenio. Lo facturado antes ya está en nuestra base, no cuesta una sola
 * llamada, y refleja los ajustes que la tarifa no ve.
 *
 * ## Por qué por VISITA y por GRUPO
 *
 * Una cita no es una línea de factura. Una visita de Potenciales Evocados genera
 * ~2,7 estudios facturados: estimar «por línea» la subestimaría a casi la tercera
 * parte. Por eso lo que se mide es el valor de una VISITA (paciente + fecha) de un
 * grupo de capacidad, el mismo criterio con el que el resto del dashboard cuenta
 * visitas.
 *
 * ## Mediana, no promedio
 *
 * Unas pocas visitas con un valor atípico (un ajuste, un paquete) moverían un
 * promedio; la mediana no.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_CASOS = void 0;
exports.mediana = mediana;
exports.construirTablaPrecios = construirTablaPrecios;
exports.valorarCita = valorarCita;
/** Casos mínimos para fiarse de una mediana. Con menos, se cae al siguiente nivel. */
exports.MIN_CASOS = 3;
function mediana(valores) {
    if (valores.length === 0)
        return 0;
    const o = [...valores].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 === 1 ? o[m] : (o[m - 1] + o[m]) / 2;
}
const claveEG = (entidadId, grupo) => `${entidadId}|${grupo}`;
function construirTablaPrecios(visitas, minCasos = exports.MIN_CASOS) {
    const eg = new Map();
    const g = new Map();
    for (const v of visitas) {
        // Una visita en $0 es un consumo sin facturar (cortesía, error de carga): no
        // dice cuánto vale el servicio y arrastraría la mediana hacia abajo.
        if (!(v.valor > 0))
            continue;
        (g.get(v.grupo) ?? g.set(v.grupo, []).get(v.grupo)).push(v.valor);
        if (v.entidad_id) {
            const k = claveEG(v.entidad_id, v.grupo);
            (eg.get(k) ?? eg.set(k, []).get(k)).push(v.valor);
        }
    }
    const reducir = (m) => {
        const out = new Map();
        for (const [k, vals] of m)
            if (vals.length >= minCasos)
                out.set(k, { mediana: mediana(vals), n: vals.length });
        return out;
    };
    return { porEntidadGrupo: reducir(eg), porGrupo: reducir(g) };
}
/**
 * Valor estimado de una cita, con el nivel del que salió.
 *
 * Jerarquía: EPS × grupo → el grupo en todas las EPS → **sin precio**. Lo último
 * devuelve `valor: null`, no 0: una cita sin precio de referencia se AVISA, y
 * contarla como cero haría parecer más baja la proyección sin que nadie lo notara.
 */
function valorarCita(tabla, entidadId, grupo) {
    if (!grupo)
        return { valor: null, origen: 'sin_precio' };
    if (entidadId) {
        const p = tabla.porEntidadGrupo.get(claveEG(entidadId, grupo));
        if (p)
            return { valor: p.mediana, origen: 'entidad_grupo' };
    }
    const gr = tabla.porGrupo.get(grupo);
    if (gr)
        return { valor: gr.mediana, origen: 'grupo' };
    return { valor: null, origen: 'sin_precio' };
}
//# sourceMappingURL=agenda-valoracion.js.map