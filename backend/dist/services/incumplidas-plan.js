"use strict";
/**
 * Plan de la sincronización de las citas CUMPLIDAS e INCUMPLIDAS (estados `C` e `I` de Medifolios), sin base
 * de datos ni red.
 *
 * Para poder filtrar por mes, semana, día, rango, día de la semana y EPS, y calcular el % de incumplimiento,
 * se guarda un RESUMEN por día y EPS (cuántas cumplidas y cuántas incumplidas; sin datos de pacientes ni una
 * fila por cita) en `citas_resumen_dia`. No se pide todo el histórico en cada vuelta (cada página son ~4 s
 * de Medifolios): se mantiene así
 *
 *   - **ventana**: los últimos 7 días, en CADA vuelta (una cita puede pasar a incumplida horas después);
 *   - **diario**: una vez al día, el mes anterior y lo que va del mes (corrige lo que cambió fuera de la ventana);
 *   - **histórico**: un mes más hacia atrás por vuelta, hasta el 1 de enero del año anterior.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUESTRA_MINIMA = exports.DIAS_VENTANA = void 0;
exports.inicioDeMes = inicioDeMes;
exports.inicioMesAnterior = inicioMesAnterior;
exports.limiteHistorico = limiteHistorico;
exports.planBasico = planBasico;
exports.tareaHistorica = tareaHistorica;
exports.planIncumplidas = planIncumplidas;
exports.fechaMenor = fechaMenor;
exports.aplicarTarea = aplicarTarea;
exports.agregarPorDiaEntidad = agregarPorDiaEntidad;
exports.periodoDeFiltro = periodoDeFiltro;
exports.coberturaCompleta = coberturaCompleta;
exports.rangoSospechoso = rangoSospechoso;
exports.respuestaSospechosa = respuestaSospechosa;
exports.porcentaje = porcentaje;
exports.armarIncumplidas = armarIncumplidas;
const agenda_ventana_js_1 = require("./agenda-ventana.js");
exports.DIAS_VENTANA = 7;
const pad = (n) => String(n).padStart(2, '0');
/** Primer día del mes de la fecha dada. */
function inicioDeMes(fecha) {
    return `${fecha.slice(0, 7)}-01`;
}
/** Primer día del mes ANTERIOR al de la fecha dada. */
function inicioMesAnterior(fecha) {
    const [y, m] = fecha.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 2, 1));
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-01`;
}
/** Hasta dónde se carga el histórico: el 1 de enero del año anterior. */
function limiteHistorico(hoy) {
    return `${Number(hoy.slice(0, 4)) - 1}-01-01`;
}
/**
 * La pasada diaria (una vez al día) y la ventana de cada vuelta, EN ESE ORDEN. Con la diaria primero, si el sistema
 * estuvo unos días sin sincronizar, la diaria se pega al tramo cargado (lo conserva) y la ventana se pega a la diaria;
 * al revés, la ventana se veía como un hueco y reiniciaba el tramo, y los meses ya cargados volvían a «incompletos».
 */
function planBasico(hoy, cobertura) {
    const tareas = [];
    if (cobertura?.ultimoDiario !== hoy) {
        tareas.push({ tipo: 'diario', desde: inicioMesAnterior(hoy), hasta: (0, agenda_ventana_js_1.diasAntes)(hoy, exports.DIAS_VENTANA + 1) });
    }
    tareas.push({ tipo: 'ventana', desde: (0, agenda_ventana_js_1.diasAntes)(hoy, exports.DIAS_VENTANA), hasta: hoy });
    return tareas;
}
/**
 * Un mes más hacia atrás, pegado a lo ya cargado; `null` si no hay cobertura conocida o ya se llegó al límite.
 * Se calcula DESPUÉS de las tareas básicas, con la cobertura ya actualizada: si estas reiniciaron el tramo por un
 * hueco, el histórico debe retroceder desde el tramo nuevo y no desde el viejo.
 */
function tareaHistorica(hoy, cobertura) {
    const desde = cobertura?.desde ?? null;
    const limite = limiteHistorico(hoy);
    if (desde === null || desde <= limite)
        return null;
    const ini = inicioMesAnterior(desde);
    return { tipo: 'historico', desde: ini < limite ? limite : ini, hasta: (0, agenda_ventana_js_1.diasAntes)(desde, 1) };
}
/** Todo lo de una vuelta, suponiendo que las tareas básicas no cambian la cobertura. Sirve para ver el plan. */
function planIncumplidas(hoy, cobertura) {
    const h = tareaHistorica(hoy, cobertura);
    return [...planBasico(hoy, cobertura), ...(h ? [h] : [])];
}
/** El menor de dos `YYYY-MM-DD`, tolerando `null`. */
function fechaMenor(a, b) {
    return a === null || b < a ? b : a;
}
const diaSiguiente = (f) => (0, agenda_ventana_js_1.diasAntes)(f, -1);
/**
 * Cobertura después de cargar una tarea con éxito. La cobertura es UN tramo sin huecos `[desde, hasta]`:
 *
 *  - sin cobertura previa, es la tarea;
 *  - si la tarea toca o se pega al tramo, se une;
 *  - si queda un HUECO (la tarea empieza después de `hasta + 1`: el sistema estuvo más de un mes sin
 *    sincronizar, o la agenda desactivada), el tramo se REINICIA en la tarea. Afirmar el tramo viejo sería
 *    mentir: `completa` diría que un mes está cargado cuando tiene 3 semanas vacías. El histórico vuelve a
 *    llenar hacia atrás, un mes por vuelta.
 */
function aplicarTarea(cob, t) {
    if (cob.desde === null || cob.hasta === null)
        return { desde: t.desde, hasta: t.hasta };
    if (t.desde > diaSiguiente(cob.hasta))
        return { desde: t.desde, hasta: t.hasta }; // hueco hacia adelante: se reinicia
    if (t.hasta < (0, agenda_ventana_js_1.diasAntes)(cob.desde, 1))
        return { desde: cob.desde, hasta: cob.hasta }; // antes y sin tocar: no cambia
    return { desde: t.desde < cob.desde ? t.desde : cob.desde, hasta: t.hasta > cob.hasta ? t.hasta : cob.hasta };
}
/**
 * Agrupa las citas de un rango por día y EPS. Una cita sin EPS vinculada se agrupa por el nombre de su
 * convenio; una vinculada ignora el convenio (todas las de una EPS suman en una fila).
 */
function agregarPorDiaEntidad(cumplidas, incumplidas, entidadDe) {
    const por = new Map();
    const sumar = (f, campo) => {
        const entidadId = entidadDe(f) ?? '';
        const convenioNombre = entidadId ? '' : f.convenioNombre.trim().slice(0, 100);
        // La llave de la tabla usa una colación que ignora mayúsculas y tildes: «Sanitas» y «SANITAS» son la MISMA fila allí.
        // Aquí se agrupan igual; si no, la segunda pisaría a la primera al guardar.
        const clave = `${f.fechaDia}|${entidadId}|${convenioNombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}`;
        let r = por.get(clave);
        if (!r) {
            r = { fechaDia: f.fechaDia, entidadId, convenioNombre, cumplidas: 0, incumplidas: 0 };
            por.set(clave, r);
        }
        r[campo]++;
    };
    for (const f of cumplidas)
        sumar(f, 'cumplidas');
    for (const f of incumplidas)
        sumar(f, 'incumplidas');
    return [...por.values()];
}
/**
 * Rango de fechas de un filtro de Reportes: el rango dado, o el mes entero. Sin recortar a «hoy»: una
 * incumplida es siempre una cita ya pasada.
 */
function periodoDeFiltro(p) {
    if (p.startDate && p.endDate)
        return { desde: p.startDate, hasta: p.endDate };
    const ultimo = new Date(Date.UTC(p.anio, p.mesIdx, 0)).getUTCDate();
    return { desde: `${p.anio}-${pad(p.mesIdx)}-01`, hasta: `${p.anio}-${pad(p.mesIdx)}-${pad(ultimo)}` };
}
/**
 * ¿Lo cargado cubre el periodo pedido? Debe empezar antes (o el mismo día) y llegar hasta el final del periodo o
 * hasta hoy, con un día de margen (la última pasada puede ser de ayer). Si no, el conteo puede quedar corto y hay que decirlo.
 */
function coberturaCompleta(cob, periodo, hoy) {
    if (cob.desde === null || cob.hasta === null)
        return false;
    // Un día de margen SOLO si el periodo llega hasta hoy (la última pasada puede ser de ayer). Un periodo ya cerrado
    // exige llegar hasta su último día: si no, un filtro del 13-nov con lo cargado hasta el 12 diría «completo».
    const margen = periodo.hasta >= hoy ? 1 : 0;
    const tope = periodo.hasta < hoy ? periodo.hasta : hoy;
    return cob.desde <= periodo.desde && cob.hasta >= (0, agenda_ventana_js_1.diasAntes)(tope, margen);
}
/**
 * ¿Es sospechoso lo que devolvió Medifolios para un rango? Además de vaciar o diezmar lo ya guardado
 * (`respuestaSospechosa`), se juzga la respuesta POR SÍ SOLA, porque todo mes de histórico entra con 0 filas previas y la
 * guarda de arriba no lo protege: unas cumplidas vacías con las incumplidas bien darían un 100 % de incumplimiento que
 * nadie volvería a pedir. Con la agenda real de una clínica, muchas incumplidas y NINGUNA cumplida (o al revés) no ocurre.
 */
function rangoSospechoso(previas, nuevas) {
    return respuestaSospechosa(previas.cumplidas, nuevas.cumplidas)
        || respuestaSospechosa(previas.incumplidas, nuevas.incumplidas)
        || (nuevas.cumplidas === 0 && nuevas.incumplidas >= 5)
        || (nuevas.incumplidas === 0 && nuevas.cumplidas >= 100);
}
/**
 * Una respuesta que vacía o diezma lo ya guardado no se acepta: Medifolios a veces responde 200 con una
 * lista corta o vacía en un fallo a medias, y reemplazar con ella borraría incumplidas reales. Las
 * incumplidas de un periodo cerrado casi no cambian; una caída de más de la mitad es un fallo, no un hecho.
 */
function respuestaSospechosa(previas, nuevas) {
    if (previas < 10)
        return false;
    return nuevas < previas * 0.5;
}
// ─── Respuesta de Reportes ────────────────────────────────────────────────────
/** Con menos citas resueltas que esto, un % no dice nada (3 de 5 es 60 % y es ruido). */
exports.MUESTRA_MINIMA = 10;
/** Porcentaje con un decimal; `null` si no hay base. */
function porcentaje(parte, total) {
    return total > 0 ? Math.round((parte / total) * 1000) / 10 : null;
}
/**
 * Arma la respuesta. El total sale de las MISMAS filas por EPS que se devuelven: tarjeta y tabla no pueden discrepar.
 * `hayConector` distingue «la agenda no está activada» (estado `null`: no hay nada que mostrar) de «está activada
 * pero aún no se ha sincronizado» (estado `nunca`): son mensajes distintos.
 */
function armarIncumplidas(filas, periodo, estado, aIso, hoy, hayConector = true) {
    const por = filas
        .map((f) => {
        const resueltas = f.cumplidas + f.incumplidas;
        return {
            entidad_id: f.entidadId, entidad: f.entidad, tipo: f.tipo, cumplidas: f.cumplidas, incumplidas: f.incumplidas,
            resueltas, pct: porcentaje(f.incumplidas, resueltas), muestra_pequena: resueltas < exports.MUESTRA_MINIMA,
        };
    })
        // Más incumplidas primero; a igualdad, por nombre (un empate no puede cambiar el orden entre llamadas).
        .sort((a, b) => b.incumplidas - a.incumplidas || a.entidad.localeCompare(b.entidad, 'es'));
    const incumplidas = por.reduce((s, f) => s + f.incumplidas, 0);
    const cumplidas = por.reduce((s, f) => s + f.cumplidas, 0);
    const cob = { desde: estado?.desde ?? null, hasta: estado?.hasta ?? null };
    return {
        total: { incumplidas, cumplidas, resueltas: incumplidas + cumplidas, pct: porcentaje(incumplidas, incumplidas + cumplidas) },
        por_entidad: por,
        periodo,
        cobertura: {
            desde: cob.desde,
            hasta: cob.hasta,
            completa: coberturaCompleta(cob, periodo, hoy),
            actualizado_en: aIso(estado?.ultimaOk ?? null),
            estado: !hayConector ? null : estado?.estado ?? 'nunca',
        },
    };
}
//# sourceMappingURL=incumplidas-plan.js.map