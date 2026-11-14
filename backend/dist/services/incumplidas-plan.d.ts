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
import type { FilaCita } from './agenda-mapeo.js';
export declare const DIAS_VENTANA = 7;
export interface Cobertura {
    /** Primer día del tramo cubierto SIN huecos; `null` si aún no se ha cargado nada. */
    desde: string | null;
    /** Último día de ese tramo. Si pasa mucho tiempo sin sincronizar, la ventana nueva no lo toca y queda un hueco: ver `aplicarTarea`. */
    hasta: string | null;
    /** Último día en que se hizo la pasada «diaria». */
    ultimoDiario: string | null;
}
export type TipoTarea = 'ventana' | 'diario' | 'historico';
export interface Tarea {
    tipo: TipoTarea;
    /** `YYYY-MM-DD`, ambos incluidos. */
    desde: string;
    hasta: string;
}
/** Primer día del mes de la fecha dada. */
export declare function inicioDeMes(fecha: string): string;
/** Primer día del mes ANTERIOR al de la fecha dada. */
export declare function inicioMesAnterior(fecha: string): string;
/** Hasta dónde se carga el histórico: el 1 de enero del año anterior. */
export declare function limiteHistorico(hoy: string): string;
/**
 * La pasada diaria (una vez al día) y la ventana de cada vuelta, EN ESE ORDEN. Con la diaria primero, si el sistema
 * estuvo unos días sin sincronizar, la diaria se pega al tramo cargado (lo conserva) y la ventana se pega a la diaria;
 * al revés, la ventana se veía como un hueco y reiniciaba el tramo, y los meses ya cargados volvían a «incompletos».
 */
export declare function planBasico(hoy: string, cobertura: Pick<Cobertura, 'ultimoDiario'> | null): Tarea[];
/**
 * Un mes más hacia atrás, pegado a lo ya cargado; `null` si no hay cobertura conocida o ya se llegó al límite.
 * Se calcula DESPUÉS de las tareas básicas, con la cobertura ya actualizada: si estas reiniciaron el tramo por un
 * hueco, el histórico debe retroceder desde el tramo nuevo y no desde el viejo.
 */
export declare function tareaHistorica(hoy: string, cobertura: Pick<Cobertura, 'desde'> | null): Tarea | null;
/** Todo lo de una vuelta, suponiendo que las tareas básicas no cambian la cobertura. Sirve para ver el plan. */
export declare function planIncumplidas(hoy: string, cobertura: Cobertura | null): Tarea[];
/** El menor de dos `YYYY-MM-DD`, tolerando `null`. */
export declare function fechaMenor(a: string | null, b: string): string;
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
export declare function aplicarTarea(cob: {
    desde: string | null;
    hasta: string | null;
}, t: Pick<Tarea, 'desde' | 'hasta'>): {
    desde: string;
    hasta: string;
};
export interface ResumenDia {
    fechaDia: string;
    /** `''` si la cita no se pudo vincular a una EPS (entonces se agrupa por nombre de convenio). */
    entidadId: string;
    convenioNombre: string;
    cumplidas: number;
    incumplidas: number;
}
/**
 * Agrupa las citas de un rango por día y EPS. Una cita sin EPS vinculada se agrupa por el nombre de su
 * convenio; una vinculada ignora el convenio (todas las de una EPS suman en una fila).
 */
export declare function agregarPorDiaEntidad(cumplidas: ReadonlyArray<FilaCita>, incumplidas: ReadonlyArray<FilaCita>, entidadDe: (f: FilaCita) => string | null): ResumenDia[];
/**
 * Rango de fechas de un filtro de Reportes: el rango dado, o el mes entero. Sin recortar a «hoy»: una
 * incumplida es siempre una cita ya pasada.
 */
export declare function periodoDeFiltro(p: {
    mesIdx: number;
    anio: number;
    startDate?: string;
    endDate?: string;
}): {
    desde: string;
    hasta: string;
};
/**
 * ¿Lo cargado cubre el periodo pedido? Debe empezar antes (o el mismo día) y llegar hasta el final del periodo o
 * hasta hoy, con un día de margen (la última pasada puede ser de ayer). Si no, el conteo puede quedar corto y hay que decirlo.
 */
export declare function coberturaCompleta(cob: {
    desde: string | null;
    hasta: string | null;
}, periodo: {
    desde: string;
    hasta: string;
}, hoy: string): boolean;
/**
 * ¿Es sospechoso lo que devolvió Medifolios para un rango? Además de vaciar o diezmar lo ya guardado
 * (`respuestaSospechosa`), se juzga la respuesta POR SÍ SOLA, porque todo mes de histórico entra con 0 filas previas y la
 * guarda de arriba no lo protege: unas cumplidas vacías con las incumplidas bien darían un 100 % de incumplimiento que
 * nadie volvería a pedir. Con la agenda real de una clínica, muchas incumplidas y NINGUNA cumplida (o al revés) no ocurre.
 */
export declare function rangoSospechoso(previas: {
    cumplidas: number;
    incumplidas: number;
}, nuevas: {
    cumplidas: number;
    incumplidas: number;
}): boolean;
/**
 * Una respuesta que vacía o diezma lo ya guardado no se acepta: Medifolios a veces responde 200 con una
 * lista corta o vacía en un fallo a medias, y reemplazar con ella borraría incumplidas reales. Las
 * incumplidas de un periodo cerrado casi no cambian; una caída de más de la mitad es un fallo, no un hecho.
 */
export declare function respuestaSospechosa(previas: number, nuevas: number): boolean;
/** Con menos citas resueltas que esto, un % no dice nada (3 de 5 es 60 % y es ruido). */
export declare const MUESTRA_MINIMA = 10;
export interface FilaResumen {
    entidadId: string | null;
    entidad: string;
    tipo: string;
    cumplidas: number;
    incumplidas: number;
}
export interface IncumplidasEntidad {
    entidad_id: string | null;
    entidad: string;
    tipo: string;
    cumplidas: number;
    incumplidas: number;
    /** Cumplidas + incumplidas: las citas que ya se resolvieron (el denominador del %). */
    resueltas: number;
    /** Incumplidas ÷ resueltas, en %. `null` sin citas resueltas: no se inventa. */
    pct: number | null;
    /** Menos de `MUESTRA_MINIMA` citas resueltas: el % no es fiable. */
    muestra_pequena: boolean;
}
export interface IncumplidasResultado {
    total: {
        incumplidas: number;
        cumplidas: number;
        resueltas: number;
        pct: number | null;
    };
    /** De la que más incumplidas tiene a la que menos. */
    por_entidad: IncumplidasEntidad[];
    periodo: {
        desde: string;
        hasta: string;
    };
    cobertura: {
        /** Primer día cargado; `null` si aún no se ha sincronizado nada. */
        desde: string | null;
        /** Último día cargado. */
        hasta: string | null;
        /** ¿Lo cargado cubre todo el periodo? Si no, el conteo puede quedar corto. */
        completa: boolean;
        actualizado_en: string | null;
        estado: 'nunca' | 'ok' | 'error' | null;
    };
}
/** Porcentaje con un decimal; `null` si no hay base. */
export declare function porcentaje(parte: number, total: number): number | null;
/**
 * Arma la respuesta. El total sale de las MISMAS filas por EPS que se devuelven: tarjeta y tabla no pueden discrepar.
 * `hayConector` distingue «la agenda no está activada» (estado `null`: no hay nada que mostrar) de «está activada
 * pero aún no se ha sincronizado» (estado `nunca`): son mensajes distintos.
 */
export declare function armarIncumplidas(filas: ReadonlyArray<FilaResumen>, periodo: {
    desde: string;
    hasta: string;
}, estado: {
    desde: string | null;
    hasta: string | null;
    ultimaOk: string | null;
    estado: 'nunca' | 'ok' | 'error';
} | null, aIso: (s: string | null) => string | null, hoy: string, hayConector?: boolean): IncumplidasResultado;
//# sourceMappingURL=incumplidas-plan.d.ts.map