"use strict";
/**
 * Serie del día y comparación con el día anterior, sin base de datos ni red.
 *
 * En cada sincronización se guarda una FOTO de las cifras del día (`tv_serie`): con ellas se dibuja
 * el gráfico «lo facturado hoy» como una línea REAL (un punto por sincronización) y se compara con
 * el mismo momento del día anterior. No hay datos por hora de Medifolios: sin estas fotos, no hay
 * historial intradía.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.minutoDelDiaBogota = minutoDelDiaBogota;
exports.puntoEnMomento = puntoEnMomento;
exports.compararConPrevia = compararConPrevia;
exports.diasHabilesDelMes = diasHabilesDelMes;
exports.variacionPct = variacionPct;
const OFFSET_BOGOTA_MS = -5 * 3_600_000;
/** Minuto del día (0–1439) en hora de Colombia. */
function minutoDelDiaBogota(ms) {
    const l = new Date(ms + OFFSET_BOGOTA_MS);
    return l.getUTCHours() * 60 + l.getUTCMinutes();
}
/**
 * Valor de la serie en un momento del día: el del ÚLTIMO punto a esa hora o antes (la cifra
 * «vigente» entonces, no una interpolación). `null` si aún no había ningún punto ese día a esa hora.
 */
function puntoEnMomento(puntos, minutoDelDia) {
    let mejor = null;
    let mejorMin = -1;
    for (const p of puntos) {
        const t = Date.parse(p.ts);
        if (!Number.isFinite(t))
            continue;
        const m = minutoDelDiaBogota(t);
        if (m <= minutoDelDia && m >= mejorMin) {
            mejor = p;
            mejorMin = m;
        }
    }
    return mejor;
}
/**
 * Diferencia de HOY frente al día anterior con datos, A LA MISMA HORA.
 * `null` si no hay día anterior guardado (la primera jornada de la serie).
 */
function compararConPrevia(hoy, previa, ahoraMs) {
    if (!previa || previa.puntos.length === 0)
        return null;
    const p = puntoEnMomento(previa.puntos, minutoDelDiaBogota(ahoraMs));
    return {
        fecha: previa.fecha,
        facturado: p ? Math.round(hoy.facturado - p.facturado) : null,
        atendidas: p ? hoy.atendidas - p.atendidas : null,
    };
}
/** Días hábiles (lunes a viernes) de un mes: con ellos se reparte la meta mensual en meta diaria. */
function diasHabilesDelMes(anio, mesIdx) {
    const ultimo = new Date(Date.UTC(anio, mesIdx, 0)).getUTCDate();
    let n = 0;
    for (let d = 1; d <= ultimo; d++) {
        const dow = new Date(Date.UTC(anio, mesIdx - 1, d)).getUTCDay();
        if (dow >= 1 && dow <= 5)
            n++;
    }
    return n;
}
/** Variación porcentual contra una referencia; `null` si no hay referencia válida (no se inventa). */
function variacionPct(valor, referencia) {
    if (referencia === null || referencia === undefined || !Number.isFinite(referencia) || referencia <= 0)
        return null;
    if (!Number.isFinite(valor))
        return null;
    return Math.round(((valor - referencia) / referencia) * 1000) / 10;
}
//# sourceMappingURL=tv-serie.js.map