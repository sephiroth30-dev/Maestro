/**
 * Analítica de pacientes.
 *
 * La base sólo guarda dos campos de paciente (`paciente_nombre`,
 * `paciente_documento`), ambos opcionales y de texto libre. No hay fecha de
 * nacimiento, sexo ni ciudad, así que esto NO es demografía poblacional: es
 * analítica de utilización — cuántas personas distintas se atienden, cuántas
 * son nuevas y con qué frecuencia vuelven.
 *
 * Toda cifra se calcula sólo sobre las filas que sí tienen identificación; la
 * cobertura se devuelve aparte para que la interfaz pueda advertirlo.
 */
export interface PacientesParams {
    mesIdx?: number;
    anio?: number;
    startDate?: Date;
    endDate?: Date;
    entidadId?: string;
    diaSemana?: number;
}
export interface CoberturaConector {
    conector_id: string | null;
    conector_nombre: string | null;
    filas: number;
    filas_con_paciente: number;
}
export interface CoberturaRow {
    filas: number;
    filas_con_paciente: number;
    filas_con_documento: number;
    valor_total: number;
    valor_sin_paciente: number;
}
export declare function getCobertura(p: PacientesParams): Promise<{
    global: CoberturaRow;
    porConector: CoberturaConector[];
}>;
export interface ResumenRow {
    pacientes_unicos: number;
    atenciones_con_paciente: number;
    visitas_unicas: number;
}
export declare function getResumen(p: PacientesParams): Promise<ResumenRow>;
/**
 * "Nuevo" = sin ningún registro anterior EN LOS DATOS DISPONIBLES.
 *
 * Se compara contra `fecha_dia`, nunca contra `created_at` ni `id`: la
 * sincronización borra e reinserta todas las filas del conector en cada corrida
 * (`DELETE FROM atenciones WHERE conector_id = ?`), así que esos dos campos se
 * reinician y no sirven como línea de tiempo.
 */
export declare function getNuevosRecurrentes(p: PacientesParams): Promise<{
    nuevos: number;
    recurrentes: number;
    historia_desde: string | null;
}>;
export interface FrecuenciaRow {
    bucket: '1' | '2-3' | '4-6' | '7+';
    pacientes: number;
}
/** Los tramos cuentan VISITAS (fechas distintas), no filas: un EMG y un VCN el
 *  mismo día son dos atenciones pero una sola visita. */
export declare function getFrecuencia(p: PacientesParams): Promise<FrecuenciaRow[]>;
export interface DimensionRow {
    clave: string | null;
    nombre: string;
    pacientes: number;
    atenciones: number;
    valor: number;
}
/**
 * OJO: estos conteos NO suman `pacientes_unicos`. Un paciente con una atención
 * por EPS y otra particular se cuenta en ambos tramos. Por eso la interfaz lo
 * dibuja como barras y nunca como una torta.
 */
export declare function getPorPagador(p: PacientesParams): Promise<DimensionRow[]>;
/** Pacientes que aparecen en más de un tipo de pagador dentro del período. */
export declare function getMultiPagador(p: PacientesParams): Promise<number>;
export declare function getPorServicio(p: PacientesParams): Promise<DimensionRow[]>;
export interface RetencionRow {
    anio: number;
    mes_idx: number;
    pacientes: number;
    retenidos: number;
}
/**
 * Un paciente está "retenido" en el mes M si vuelve en M+1.
 *
 * La ventana del lado derecho se extiende un mes más allá del período pedido;
 * si no, el último mes siempre reportaría 0 % y parecería una caída del negocio
 * en vez de un artefacto de la consulta.
 */
export declare function getRetencion(p: PacientesParams, desde: Date, hasta: Date): Promise<RetencionRow[]>;
export interface DetalleAtencionRow {
    fecha: string;
    paciente: string | null;
    documento: string | null;
    entidad: string | null;
    entidad_tipo: string | null;
    profesional: string | null;
    servicio: string | null;
    descripcion: string;
    autorizacion: string | null;
    valor_bruto: number;
}
/**
 * Una fila por atención del período. Es lo que pide quien quiere armar sus
 * propias tablas dinámicas y lo que los manuales ya prometían.
 *
 * `limit` acota el volumen: la respuesta va completa en memoria y de ahí al
 * navegador, así que no puede ser ilimitada.
 */
export declare function getDetalleAtenciones(p: PacientesParams, limit: number): Promise<{
    rows: DetalleAtencionRow[];
    total: number;
}>;
//# sourceMappingURL=pacientes.repo.d.ts.map