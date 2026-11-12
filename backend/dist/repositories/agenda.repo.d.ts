import type { VisitaHistorica, OrigenValor } from '../services/agenda-valoracion.js';
/**
 * Consultas de la proyección por agenda.
 *
 * ⚠ Estas consultas se escribieron SIN poder ejecutarlas (el entorno de
 * desarrollo no tiene MySQL). Por eso son deliberadamente sencillas —sin
 * funciones de ventana, la mediana se calcula en JS— y reutilizan los
 * constructores que ya corren en producción (`sqlFiltroFuente`,
 * `sqlClasificacionGrupo`, `sqlLlaveVisita`). La primera ejecución real es el
 * examen de verdad: ver Diagnóstico → Proyección por agenda.
 *
 * Las fechas llegan y salen como texto (`dateStrings: true` en el pool): un DATE
 * es 'YYYY-MM-DD' y un DATETIME 'YYYY-MM-DD HH:MM:SS'.
 */
/**
 * Lo facturado por VISITA (paciente + fecha) de cada grupo de capacidad y EPS,
 * entre `desde` (incluido) y `hastaExcl` (excluido), de la fuente activa.
 *
 * `hastaExcl` existe para el backtest: valorar con un historial que llegue más
 * allá de la fecha evaluada contaminaría la prueba con lo que se quiere predecir.
 */
export declare function historialVisitas(desde: string, hastaExcl: string): Promise<VisitaHistorica[]>;
export interface CitaGuardable {
    codAsignacion: number;
    fechaCita: string;
    fechaDia: string;
    convenioCod: number | null;
    convenioNombre: string;
    entidadId: string | null;
    referenciaNombre: string;
    cups: string | null;
    grupo: string | null;
    valorEstimado: number | null;
    origenValor: OrigenValor;
}
/**
 * Reemplaza TODAS las citas de un conector, en una transacción.
 *
 * La tabla es chica (cientos o pocos miles de filas) y así lo atendido sale solo
 * en la siguiente vuelta, sin lógica de «qué cambió». Si algo falla a mitad, la
 * transacción se revierte y la agenda anterior sigue ahí.
 */
export declare function reemplazarCitas(conectorId: string, citas: CitaGuardable[]): Promise<void>;
export interface ConvenioEps {
    codConvenio: number;
    nombre: string;
    epsNombre: string | null;
    entidadId: string | null;
}
export declare function leerConvenios(conectorId: string): Promise<ConvenioEps[]>;
export declare function reemplazarConvenios(conectorId: string, convenios: ConvenioEps[]): Promise<void>;
export interface EstadoAgendaSync {
    conectorId: string;
    ultimoIntento: string | null;
    ultimaOk: string | null;
    estado: 'nunca' | 'ok' | 'error';
    error: string | null;
    httpStatus: number | null;
    citasLeidas: number;
    citasGuardadas: number;
    citasSinPrecio: number;
    horizonte: string | null;
    duracionMs: number | null;
    conveniosEstado: 'ok' | 'sin_permiso' | 'error' | null;
    conveniosError: string | null;
    conveniosActualizado: string | null;
    /** Última lectura de las citas de HOY (pantalla de TV): `ok`, `error` o nunca (null). */
    tvEstado: 'ok' | 'error' | null;
    tvError: string | null;
    tvActualizado: string | null;
}
/**
 * Guarda SOLO los campos que se pasan (el resto queda como estaba). Las fechas se
 * escriben como `Date` de JS —UTC, por la configuración del pool— y no con
 * `NOW()`, que usaría la zona horaria del servidor de base de datos.
 */
export declare function guardarEstadoSync(conectorId: string, cambios: Partial<Omit<EstadoAgendaSync, 'conectorId'>>): Promise<void>;
export declare function leerEstadoSync(conectorId?: string): Promise<EstadoAgendaSync | null>;
export interface FiltroAgenda {
    /** Primer día (YYYY-MM-DD). Ya recortado a «hoy»: una cita pendiente no puede estar en el pasado. */
    desde: string;
    hasta: string;
    entidadId?: string;
    /** `DAYOFWEEK` de MySQL (2 = lunes … 6 = viernes), igual que los demás endpoints. */
    diaSemana?: number;
}
export interface AgendaEntidadFila {
    entidadId: string | null;
    entidad: string;
    tipo: string;
    citas: number;
    valor: number;
    citasSinValor: number;
}
export declare function agendaPorEntidad(f: FiltroAgenda): Promise<AgendaEntidadFila[]>;
export declare function agendaPorDia(f: FiltroAgenda): Promise<Array<{
    fecha: string;
    citas: number;
    valor: number;
}>>;
/** Fecha de la última cita cargada, sin filtros: hasta dónde llega la agenda. */
export declare function horizonteAgenda(): Promise<string | null>;
/**
 * Facturación mensual MEDIA de cada EPS en los últimos 3 meses cerrados (de la
 * fuente activa), promediando solo los meses en que esa EPS tuvo movimiento.
 *
 * No es un tope: es la referencia con la que se compara lo proyectado, para ver
 * si una EPS va por encima o por debajo de lo habitual sin definir qué es «pasarse».
 */
export declare function promedio3Meses(mesesCerrados: Array<{
    anio: number;
    mes: number;
}>): Promise<Map<string, number>>;
export declare function resumenCitas(): Promise<{
    citas: number;
    conPrecio: number;
    sinPrecio: number;
    sinEntidad: number;
}>;
export declare function conveniosSinEntidad(limite?: number): Promise<Array<{
    convenio: string;
    citas: number;
}>>;
export declare function citasSinPrecioPorReferencia(limite?: number): Promise<Array<{
    referencia: string;
    convenio: string;
    citas: number;
}>>;
/** Lo facturado por EPS en un mes (fuente activa): el «real» contra el que se compara. */
export declare function facturadoPorEntidadMes(anio: number, mes: number): Promise<Array<{
    entidadId: string | null;
    entidad: string;
    valor: number;
}>>;
export interface EstadoBacktest {
    estado: 'nunca' | 'corriendo' | 'ok' | 'error';
    iniciado: string | null;
    terminado: string | null;
    error: string | null;
    /** JSON de `ResultadoBacktest`. */
    resultado: unknown | null;
}
export declare function guardarBacktest(conectorId: string, c: {
    estado: EstadoBacktest['estado'];
    iniciado?: string | null;
    terminado?: string | null;
    error?: string | null;
    resultado?: unknown;
}): Promise<void>;
export declare function leerBacktest(conectorId: string): Promise<EstadoBacktest>;
/** id → nombre de cada entidad, para rotular el backtest. */
export declare function nombresEntidades(): Promise<Map<string, string>>;
//# sourceMappingURL=agenda.repo.d.ts.map