"use strict";
/**
 * Armado puro de la respuesta de la pantalla de TV, sin base de datos ni red.
 *
 * SOLO agregados: nada de pacientes ni de honorarios. La TV está en una oficina, pero
 * un monitor es visible: lo que no se envía no se puede mostrar.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EPS_TV = exports.HORA_FIN = exports.HORA_INICIO = void 0;
exports.armarEps = armarEps;
exports.horaDecimalBogota = horaDecimalBogota;
exports.ritmoDelDia = ritmoDelDia;
exports.armarEstadoTv = armarEstadoTv;
const agenda_ventana_js_1 = require("./agenda-ventana.js");
const tv_movimientos_js_1 = require("./tv-movimientos.js");
const agenda_periodo_js_1 = require("./agenda-periodo.js");
const tv_serie_js_1 = require("./tv-serie.js");
/** Horario de trabajo de la clínica, hora de Colombia: lunes a sábado, de 6:00 a 19:59. */
exports.HORA_INICIO = 6;
exports.HORA_FIN = 20;
exports.MAX_EPS_TV = 15;
/**
 * Une lo facturado del mes, lo facturado hoy y lo agendado por EPS, y deja las de mayor
 * proyectado. Se cruzan por id; una EPS sin id (sin vincular) se cruza por nombre.
 */
function armarEps(mes, hoy, agenda) {
    const clave = (id, nombre) => (id ? `id:${id}` : `n:${nombre.trim().toUpperCase()}`);
    const por = new Map();
    const get = (id, entidad, tipo) => {
        const k = clave(id, entidad);
        let x = por.get(k);
        if (!x) {
            x = { id, entidad, tipo, facturado_mes: 0, facturado_hoy: 0, agendado_valor: 0, agendado_citas: 0, proyectado: 0, promedio_3m: null, variacion_pct: null };
            por.set(k, x);
        }
        return x;
    };
    for (const r of mes)
        get(r.id, r.entidad, r.tipo).facturado_mes += r.valor_bruto;
    for (const r of hoy)
        get(r.id, r.entidad, r.tipo).facturado_hoy += r.valor_bruto;
    for (const a of agenda) {
        const x = get(a.entidad_id, a.entidad, a.tipo);
        x.agendado_valor += a.valor;
        x.agendado_citas += a.citas;
        if (a.promedio_3m !== null)
            x.promedio_3m = a.promedio_3m;
    }
    return [...por.values()]
        .map((x) => {
        const proyectado = x.facturado_mes + x.agendado_valor;
        return { ...x, proyectado, variacion_pct: (0, tv_serie_js_1.variacionPct)(proyectado, x.promedio_3m) };
    })
        .filter((x) => x.proyectado > 0 || x.facturado_hoy > 0)
        .sort((a, b) => b.proyectado - a.proyectado)
        .slice(0, exports.MAX_EPS_TV);
}
const aPuntos = (xs) => xs.flatMap((p) => {
    const ts = (0, agenda_periodo_js_1.aIso)(p.ts);
    return ts ? [{ ts, facturado: p.facturado, atendidas: p.atendidas, pendientes: p.pendientes, incumplidas: p.incumplidas }] : [];
});
/** Hora decimal en Colombia (UTC-5): 14,5 = 2:30 p. m. */
function horaDecimalBogota(ahora) {
    const l = new Date(ahora.getTime() - 5 * 3_600_000);
    return l.getUTCHours() + l.getUTCMinutes() / 60 + l.getUTCSeconds() / 3600;
}
/**
 * Ritmo del día: lo hecho hoy dividido entre las horas laborales transcurridas.
 *
 * Con menos de una hora de jornada NO se calcula: dividir por casi cero daría un ritmo
 * disparatado. Fuera de horario las horas quedan en el tope.
 * El consumo no trae hora de atención, así que el ritmo del facturado es LINEAL sobre la
 * jornada: una aproximación, no un perfil horario real.
 */
function ritmoDelDia(ahora, facturadoHoy, atendidasHoy) {
    // Mínimo una hora de jornada: antes, el ritmo es ruido (a las 6:30 una sola cita ya sería «2 por hora») y
    // el contador se adelantaría mucho a lo real.
    const h = horaDecimalBogota(ahora);
    const horas = Math.min(Math.max(h - exports.HORA_INICIO, 0), exports.HORA_FIN - exports.HORA_INICIO);
    if (horas < 1)
        return { horas_transcurridas: Math.round(horas * 100) / 100, facturado_por_hora: null, atendidas_por_hora: null };
    return {
        horas_transcurridas: Math.round(horas * 100) / 100,
        facturado_por_hora: facturadoHoy > 0 ? Math.round(facturadoHoy / horas) : 0,
        atendidas_por_hora: Math.round((atendidasHoy / horas) * 10) / 10,
    };
}
function armarEstadoTv(e) {
    const esDeHoy = e.citasDia !== null && e.citasDia.fechaDia === e.hoy;
    // Si las citas guardadas son de otro día NO se muestran como de hoy: cero, y se avisa.
    const resumen = (0, tv_movimientos_js_1.resumenCitasHoy)(esDeHoy ? e.citasDia.citas : []);
    const k = e.kpis;
    const agendaMes = e.agendaMes.total;
    return {
        generado_en: e.ahora.toISOString(),
        hoy: e.hoy,
        version: e.version,
        reloj: { en_horario: (0, agenda_ventana_js_1.enHorarioLaboral)(e.ahora), hora_inicio: exports.HORA_INICIO, hora_fin: exports.HORA_FIN },
        meta: {
            mes_idx: e.mesIdx, anio: e.anio,
            presupuesto: k.presupuesto,
            facturado_mes: k.facturacion_bruta,
            cumplimiento_pct: k.cumplimiento_pct,
            facturado_hoy: k.facturacion_hoy,
            atenciones_mes: k.atenciones,
            dias_transcurridos: k.dias_transcurridos,
            dias_restantes: k.dias_restantes,
            proyeccion_ritmo: k.proyeccion_cierre,
            agendado_mes: { citas: agendaMes.citas, valor: agendaMes.valor, citas_sin_valor: agendaMes.citas_sin_valor },
            proyectado: k.facturacion_bruta + agendaMes.valor,
        },
        ritmo: ritmoDelDia(e.ahora, k.facturacion_hoy, resumen.atendidas),
        citas_hoy: {
            ...resumen, actualizado_en: esDeHoy ? (0, agenda_periodo_js_1.aIso)(e.citasDia.syncEn) : null, es_de_hoy: esDeHoy,
            // Aunque haya una lectura de ayer guardada, si la última intentada falló, se dice.
            lectura: e.lecturaCitasDia === 'error' ? 'error' : esDeHoy ? 'ok' : 'nunca',
        },
        agenda: {
            actualizado_en: e.agendaSemana.actualizado_en,
            horizonte: e.agendaSemana.horizonte,
            total: e.agendaMes.total,
            proximos_dias: e.agendaSemana.por_dia,
            top_entidades: [...e.agendaMes.por_entidad]
                .sort((a, b) => b.valor - a.valor)
                .slice(0, 5)
                .map((x) => ({ entidad: x.entidad, citas: x.citas, valor: x.valor })),
        },
        serie: { fecha: e.hoy, puntos: aPuntos(e.serieHoy) },
        previa: e.seriePrevia ? { fecha: e.seriePrevia.fecha, puntos: aPuntos(e.seriePrevia.puntos) } : null,
        vs_previa: (0, tv_serie_js_1.compararConPrevia)({ facturado: k.facturacion_hoy, atendidas: resumen.atendidas }, e.seriePrevia ? { fecha: e.seriePrevia.fecha, puntos: aPuntos(e.seriePrevia.puntos) } : null, e.ahora.getTime()),
        eps: armarEps(e.entidadesMes, e.entidadesHoy, e.agendaMes.por_entidad.map((x) => ({
            entidad_id: x.entidad_id, entidad: x.entidad, tipo: x.tipo, citas: x.citas, valor: x.valor, promedio_3m: x.promedio_3m,
        }))),
        dias_mes: {
            meta_dia: Math.round(k.presupuesto / Math.max(1, (0, tv_serie_js_1.diasHabilesDelMes)(e.anio, e.mesIdx))),
            dias: e.diarios.map((d) => ({ fecha: d.fecha, facturado: Math.round(d.total) })),
        },
        movimientos: e.movimientos.map((m) => ({ tipo: m.tipo, cantidad: m.cantidad, valor: m.valor, detectado_en: (0, agenda_periodo_js_1.aIso)(m.creado) })),
        actualizado: { consumos: e.consumosActualizado, citas: e.agendaMes.actualizado_en, cadencia_consumos_min: e.cadenciaConsumosMin },
    };
}
//# sourceMappingURL=tv-estado.js.map