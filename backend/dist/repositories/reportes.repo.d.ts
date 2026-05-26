export interface AggregadoMes {
    total: number;
    atenciones: number;
}
export interface FacHoyResult {
    total: number;
}
export interface DiasTranscurridosResult {
    dias: number;
}
export interface EntidadAggRow {
    entidad_id: string | null;
    nombre: string | null;
    tipo: string | null;
    es_grupo_caja: boolean | null;
    cantidad: number;
    valor_bruto: number;
}
export interface FechasDelMes {
    fecha_dia: Date;
}
export interface TendenciaRow {
    anio: number;
    mes_idx: number;
    total: number;
}
export interface PresupuestoRow {
    anio: number;
    mes: number;
    monto: number;
    notas: string | null;
}
export declare function getAgregadoMes(mesIdx: number, anio: number, entidadId?: string, startDate?: Date, endDate?: Date, diaSemana?: number): Promise<{
    total: number;
    atenciones: number;
}>;
export declare function getFacturacionDia(fecha: Date): Promise<number>;
export declare function getDiasTranscurridos(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<number>;
export declare function getFechasDelMes(mesIdx: number, anio: number): Promise<Date[]>;
export declare function getEntidadesAgg(mesIdx: number, anio: number, startDate?: Date, endDate?: Date, diaSemana?: number): Promise<EntidadAggRow[]>;
export declare function getDiariosDelMes(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<Array<{
    fecha_dia: Date;
    total: number;
    atenciones: number;
}>>;
export declare function getDiasSemanaAgg(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<Array<{
    dia_num: number;
    promedio: number;
    total: number;
    atenciones: number;
}>>;
export declare function getTendenciaMeses(meses: number): Promise<Array<{
    anio: number;
    mes_idx: number;
    total: number;
}>>;
export declare function getPresupuesto(anio: number, mes: number): Promise<number>;
export declare function listPresupuestos(): Promise<Array<{
    id: string;
    anio: number;
    mes: number;
    monto: number;
    notas: string | null;
    createdAt: Date;
}>>;
export interface EntidadCatalogRow {
    id: string;
    nombre: string;
    tipo: string;
    es_grupo_caja: boolean;
    activa: boolean;
}
export declare function listEntidades(): Promise<EntidadCatalogRow[]>;
export declare function updateEntidadGrupoCaja(id: string, esGrupoCaja: boolean): Promise<void>;
export declare const TIPOS_VALIDOS: readonly ["EPS", "ARL", "CONVENIO", "PARTICULAR", "OTRO"];
export type TipoEntidad = typeof TIPOS_VALIDOS[number];
export interface PatchEntidadFields {
    es_grupo_caja?: boolean;
    tipo?: TipoEntidad;
}
export declare function patchEntidad(id: string, fields: PatchEntidadFields): Promise<void>;
export interface DiagnosticoRow {
    conector_id: string;
    conector_nombre: string;
    anio: number;
    mes_idx: number;
    atenciones: number;
    valor_bruto: number;
    sin_entidad: number;
    sin_valor: number;
}
export declare function getDiagnosticoConectores(): Promise<DiagnosticoRow[]>;
export interface SinEntidadRow {
    nombre_raw: string | null;
    cnt: number;
    total: number;
}
export declare function getSinEntidadDiagnostico(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<SinEntidadRow[]>;
export declare function getServiciosDiagnostico(): Promise<{
    servicios_en_catalogo: number;
    servicios_con_keywords: number;
    atenciones_clasificadas: number;
    atenciones_sin_clasificar: number;
    cobertura_pct: number;
}>;
export interface ServicioAggRow {
    servicio_id: string | null;
    nombre: string | null;
    tipo_conteo: 'unidad' | 'sesion';
    orden: number;
    total_filas: number;
    sesiones: number;
    valor_bruto: number;
}
export declare function getServiciosAgg(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<ServicioAggRow[]>;
export declare function upsertPresupuesto(anio: number, mes: number, monto: number, notas?: string): Promise<{
    id: string;
    anio: number;
    mes: number;
    monto: number;
    notas: string | null;
}>;
//# sourceMappingURL=reportes.repo.d.ts.map