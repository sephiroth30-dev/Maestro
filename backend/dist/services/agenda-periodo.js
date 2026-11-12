"use strict";
/**
 * Lógica pura del endpoint de agenda: qué fechas se consultan y cómo se arma la
 * respuesta. Sin base de datos, para poder probarla.
 *
 * El contrato de la respuesta (`AgendaResult`) vive también en
 * `frontend/src/api/reportes.ts`; deben coincidir.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.periodoDeAgenda = periodoDeAgenda;
exports.mesesCerradosPrevios = mesesCerradosPrevios;
exports.aIso = aIso;
exports.armarAgenda = armarAgenda;
exports.agendaVacia = agendaVacia;
const pad = (n) => String(n).padStart(2, '0');
/**
 * Fechas de agenda de un periodo, recortadas a «de hoy en adelante».
 *
 * Una cita PENDIENTE no puede estar en el pasado: si el periodo ya terminó no
 * queda nada por atender, y si está en curso solo cuenta lo que falta. `null` =
 * no hay nada que consultar.
 */
function periodoDeAgenda(p, hoy) {
    let inicio;
    let fin;
    if (p.startDate && p.endDate) {
        inicio = p.startDate;
        fin = p.endDate;
    }
    else {
        inicio = `${p.anio}-${pad(p.mesIdx)}-01`;
        const ultimo = new Date(Date.UTC(p.anio, p.mesIdx, 0)).getUTCDate();
        fin = `${p.anio}-${pad(p.mesIdx)}-${pad(ultimo)}`;
    }
    const desde = inicio > hoy ? inicio : hoy;
    return desde > fin ? null : { desde, hasta: fin };
}
/**
 * Los `n` meses CERRADOS anteriores a la fecha dada (el mes en curso no cuenta: a
 * medias distorsionaría el promedio), del más reciente al más antiguo.
 */
function mesesCerradosPrevios(hoy, n = 3) {
    const [y, m] = hoy.split('-').map(Number);
    const out = [];
    for (let i = 1; i <= n; i++) {
        const t = new Date(Date.UTC(y, m - 1 - i, 1));
        out.push({ anio: t.getUTCFullYear(), mes: t.getUTCMonth() + 1 });
    }
    return out;
}
/** `'YYYY-MM-DD HH:MM:SS'` (UTC, del pool) → ISO. `null` si no hay o no se entiende. */
function aIso(s) {
    if (!s)
        return null;
    // El pool entrega 'YYYY-MM-DD HH:MM:SS' en UTC; un ISO que ya trae zona se respeta tal cual.
    const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s.replace(' ', 'T') : `${s.replace(' ', 'T')}Z`);
    return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function armarAgenda(porEntidad, porDia, promedios, horizonte, ultimaOk) {
    const filas = porEntidad.map((e) => ({
        entidad_id: e.entidadId,
        entidad: e.entidad,
        tipo: e.tipo,
        citas: e.citas,
        valor: Math.round(e.valor),
        citas_sin_valor: e.citasSinValor,
        // Sin historial, `null`: no se inventa una comparación.
        promedio_3m: e.entidadId && promedios.has(e.entidadId) ? Math.round(promedios.get(e.entidadId)) : null,
    }));
    return {
        actualizado_en: aIso(ultimaOk),
        horizonte,
        // El total sale de las MISMAS filas que se devuelven: así la ficha y la tabla
        // por EPS no pueden discrepar.
        total: {
            citas: filas.reduce((s, f) => s + f.citas, 0),
            valor: filas.reduce((s, f) => s + f.valor, 0),
            citas_sin_valor: filas.reduce((s, f) => s + f.citas_sin_valor, 0),
        },
        por_entidad: filas,
        por_dia: porDia.map((d) => ({ fecha: d.fecha, citas: d.citas, valor: Math.round(d.valor) })),
    };
}
function agendaVacia(horizonte, ultimaOk) {
    return armarAgenda([], [], new Map(), horizonte, ultimaOk);
}
//# sourceMappingURL=agenda-periodo.js.map