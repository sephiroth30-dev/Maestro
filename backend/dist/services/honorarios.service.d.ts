/**
 * Liquidación de honorarios médicos — motor de reglas.
 *
 * Fuente de reglas: Reglas_de_liquidacion_General_1.xlsx (proporcionado por la clínica).
 * Cada profesional tiene tasas fijas (COP por consulta) o porcentuales (% del valor facturado)
 * según la categoría del servicio y si el paciente es de entidad o particular.
 */
export type HonCat = 'consulta' | 'emg_vcn' | 'infiltracion' | 'ecografia' | 'terapia_choque' | 'junta' | 'eeg' | 'psg_lms' | 'tlm' | 'pe' | 'excluido' | 'sin_regla';
export interface HonorariosCeldas {
    monto: number;
    cnt: number;
}
export interface HonorariosProfesionalRow {
    profesional_id: string;
    nombre: string;
    consulta: HonorariosCeldas;
    emg_vcn: HonorariosCeldas;
    infiltracion: HonorariosCeldas;
    ecografia: HonorariosCeldas;
    terapia_choque: HonorariosCeldas;
    junta: HonorariosCeldas;
    eeg: HonorariosCeldas;
    psg_lms: HonorariosCeldas;
    tlm: HonorariosCeldas;
    pe: HonorariosCeldas;
    total: number;
    sin_regla: HonorariosCeldas;
}
export interface HonorariosResult {
    year: number;
    month: number;
    rows: HonorariosProfesionalRow[];
    totales: Omit<HonorariosProfesionalRow, 'profesional_id' | 'nombre'>;
}
export declare function calcularHonorarios(mesIdx: number, anio: number): Promise<HonorariosResult>;
//# sourceMappingURL=honorarios.service.d.ts.map