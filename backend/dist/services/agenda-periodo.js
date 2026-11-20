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
exports.mesesFuturosConAgenda = mesesFuturosConAgenda;
exports.agregarMesesFuturos = agregarMesesFuturos;
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
/**
 * Meses SIN atenciones que ya tienen agenda: los posteriores al último mes con
 * datos, hasta el mes del horizonte (la fecha de la última cita cargada)
 * inclusive. Del más reciente al más antiguo.
 *
 * Sin atenciones no hay último mes y sin horizonte no hay agenda: en ambos casos
 * no se ofrece nada. Un horizonte que no pasa del último mes con datos tampoco
 * agrega nada.
 */
function mesesFuturosConAgenda(ultimoMesConDatos, horizonte) {
    if (!ultimoMesConDatos || !horizonte)
        return [];
    const m = /^(\d{4})-(\d{2})/.exec(horizonte);
    if (!m)
        return [];
    const anioH = Number(m[1]);
    const mesH = Number(m[2]);
    if (mesH < 1 || mesH > 12)
        return [];
    const out = [];
    let anio = ultimoMesConDatos.anio;
    let mes = ultimoMesConDatos.mes;
    // Se avanza un mes a la vez hasta el del horizonte; el tope evita un bucle
    // largo si el último mes con datos viniera corrupto.
    for (let i = 0; i < 24; i++) {
        mes += 1;
        if (mes > 12) {
            mes = 1;
            anio += 1;
        }
        if (anio > anioH || (anio === anioH && mes > mesH))
            break;
        out.push({ anio, mes, total: 0, atenciones: 0, futuro: true });
    }
    return out.reverse();
}
/**
 * Lista del selector: los meses reales (marcados `futuro: false`) más los meses
 * futuros con agenda que aún no estén en ella. Orden anio DESC, mes DESC.
 * `reales` ya viene ordenado así desde el repositorio, pero no se depende de eso.
 */
function agregarMesesFuturos(reales, horizonte) {
    const lista = reales.map((r) => ({ ...r, futuro: false }));
    const ultimo = reales.reduce((acc, r) => (!acc || r.anio > acc.anio || (r.anio === acc.anio && r.mes > acc.mes) ? { anio: r.anio, mes: r.mes } : acc), null);
    for (const f of mesesFuturosConAgenda(ultimo, horizonte)) {
        if (!lista.some((r) => r.anio === f.anio && r.mes === f.mes))
            lista.push(f);
    }
    return lista.sort((a, b) => b.anio - a.anio || b.mes - a.mes);
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