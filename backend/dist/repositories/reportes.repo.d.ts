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
/**
 * Returns a [whereClause, params] tuple for filtering atenciones by date range
 * or by mes_idx/anio.
 */
export declare function buildDateWhere(mesIdx?: number, anio?: number, startDate?: Date, endDate?: Date, diaSemana?: number): [string, (Date | number)[]];
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
    nombres_raw: string[];
    total_atenciones: number;
}
export declare function listEntidades(): Promise<EntidadCatalogRow[]>;
export declare function updateEntidadGrupoCaja(id: string, esGrupoCaja: boolean): Promise<void>;
export declare const TIPOS_VALIDOS: readonly ["EPS", "ARL", "CONVENIO", "PARTICULAR", "OTRO"];
export type TipoEntidad = typeof TIPOS_VALIDOS[number];
export interface PatchEntidadFields {
    nombre?: string;
    es_grupo_caja?: boolean;
    tipo?: TipoEntidad;
    nombres_raw?: string[];
}
export declare function patchEntidad(id: string, fields: PatchEntidadFields): Promise<void>;
export declare function deleteEntidad(id: string): Promise<{
    nullified: number;
}>;
export interface CrearEntidadResult {
    id: string;
    nombre: string;
    tipo: string;
    reassigned: number;
}
export declare function createEntidadFromRaw(nombre: string, tipo: TipoEntidad, nombreRaw: string): Promise<CrearEntidadResult>;
export declare function reclasificarEntidades(): Promise<{
    updated: number;
    sin_entidad: number;
}>;
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
export interface ProfesionalRow {
    id: string;
    nombre: string;
    nombre_completo: string | null;
    nombres_raw: string[];
    es_nomina: boolean;
    especialidad: 'NEUROLOGIA' | 'FISIATRIA' | 'PEDIATRIA' | 'OTRO' | null;
    total_atenciones: number;
}
export declare function listProfesionales(): Promise<ProfesionalRow[]>;
export declare function createProfesional(nombre: string, nombreCompleto: string | null, especialidad: 'NEUROLOGIA' | 'FISIATRIA' | 'PEDIATRIA' | 'OTRO' | null, nombresRaw: string[]): Promise<{
    id: string;
}>;
export declare function patchProfesional(id: string, fields: {
    especialidad?: 'NEUROLOGIA' | 'FISIATRIA' | 'PEDIATRIA' | 'OTRO' | null;
    nombre_completo?: string | null;
    es_nomina?: boolean;
}): Promise<void>;
export interface SinProfesionalRow {
    nombre_raw: string;
    cnt: number;
    total: number;
}
export declare function getSinProfesionalDiagnostico(): Promise<SinProfesionalRow[]>;
export declare function reclasificarProfesionales(): Promise<{
    updated: number;
    sin_profesional: number;
}>;
export interface SinEntidadRow {
    nombre_raw: string | null;
    cnt: number;
    total: number;
}
export declare function getSinEntidadDiagnostico(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<SinEntidadRow[]>;
export interface SinServicioRow {
    descripcion_raw: string | null;
    cnt: number;
    total: number;
}
export declare function getSinServicioDiagnostico(limit?: number): Promise<SinServicioRow[]>;
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
    categoria: string | null;
    total_filas: number;
    sesiones: number;
    valor_bruto: number;
}
export declare function getServiciosAgg(mesIdx: number, anio: number, startDate?: Date, endDate?: Date, entidadId?: string, diaSemana?: number): Promise<ServicioAggRow[]>;
export interface ServicioCatalogRow {
    id: string;
    nombre: string;
    nombre_display: string | null;
    palabras_clave: string[];
    tipo_conteo: 'unidad' | 'sesion';
    orden: number;
    total_atenciones: number;
}
export declare function listServiciosCatalog(): Promise<ServicioCatalogRow[]>;
export declare function patchServicio(id: string, fields: {
    tipo_conteo?: 'unidad' | 'sesion';
    nombre_display?: string | null;
}): Promise<void>;
export interface ServicioAgrupacionItem {
    descripcion_raw: string | null;
    cnt: number;
    valor: number;
}
export interface ServicioAgrupacion {
    servicio_id: string;
    nombre: string;
    total_cnt: number;
    items: ServicioAgrupacionItem[];
}
export declare function getServicioAgrupaciones(): Promise<ServicioAgrupacion[]>;
export declare function upsertPresupuesto(anio: number, mes: number, monto: number, notas?: string): Promise<{
    id: string;
    anio: number;
    mes: number;
    monto: number;
    notas: string | null;
}>;
export declare function reclasificarServicios(): Promise<{
    total: number;
    updated: number;
    sin_clasificar: number;
}>;
//# sourceMappingURL=reportes.repo.d.ts.map