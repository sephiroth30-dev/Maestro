import { Decimal } from '@prisma/client/runtime/library';
export interface AggregadoMes {
    total: Decimal;
    atenciones: bigint;
}
export interface FacHoyResult {
    total: Decimal;
}
export interface DiasTranscurridosResult {
    dias: bigint;
}
export interface EntidadAggRow {
    entidad_id: string | null;
    nombre: string | null;
    tipo: string | null;
    es_grupo_caja: boolean | null;
    cantidad: bigint;
    valor_bruto: Decimal;
}
export interface FechasDelMes {
    fecha_dia: Date;
}
export interface TendenciaRow {
    anio: number;
    mes_idx: number;
    total: Decimal;
}
export interface PresupuestoRow {
    anio: number;
    mes: number;
    monto: Decimal;
    notas: string | null;
}
export declare function getAgregadoMes(mesIdx: number, anio: number, entidadId?: string, startDate?: Date, endDate?: Date): Promise<{
    total: number;
    atenciones: number;
}>;
export declare function getFacturacionDia(fecha: Date): Promise<number>;
export declare function getDiasTranscurridos(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<number>;
export declare function getFechasDelMes(mesIdx: number, anio: number): Promise<Date[]>;
export declare function getEntidadesAgg(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<EntidadAggRow[]>;
export declare function getDiariosDelMes(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<Array<{
    fecha_dia: Date;
    total: Decimal;
    atenciones: bigint;
}>>;
export declare function getDiasSemanaAgg(mesIdx: number, anio: number, startDate?: Date, endDate?: Date): Promise<Array<{
    dia_num: number;
    promedio: Decimal;
    total: Decimal;
    atenciones: bigint;
}>>;
export declare function getTendenciaMeses(meses: number): Promise<Array<{
    anio: number;
    mes_idx: number;
    total: Decimal;
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
export declare function upsertPresupuesto(anio: number, mes: number, monto: number, notas?: string): Promise<{
    id: string;
    anio: number;
    mes: number;
    monto: number;
    notas: string | null;
}>;
//# sourceMappingURL=reportes.repo.d.ts.map