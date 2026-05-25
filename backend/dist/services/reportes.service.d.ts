export interface KpisResult {
    facturacion_bruta: number;
    presupuesto: number;
    cumplimiento_pct: number;
    atenciones: number;
    ticket_promedio: number;
    proyeccion_cierre: number;
    proyeccion_cumplimiento_pct: number;
    dias_transcurridos: number;
    dias_restantes: number;
    facturacion_hoy: number;
    promedio_diario: number;
    semanas_en_meta: number;
    semanas_total: number;
}
export interface EntidadRow {
    entidad: string;
    tipo: string;
    es_grupo: boolean;
    cantidad: number;
    valor_bruto: number;
    participacion_pct: number;
}
export interface SemanaRow {
    numero: number;
    fecha_ini: string;
    fecha_fin: string;
    estimado: number;
    venta: number;
    cumplimiento_pct: number;
    estado: 'CERRADA' | 'EN_CURSO' | 'FUTURA';
}
export interface DiaSemanaRow {
    dia: string;
    dia_num: number;
    promedio: number;
    total: number;
    atenciones: number;
}
declare class ReportesService {
    getKpis(params: {
        mesIdx: number;
        anio: number;
        entidadId?: string;
        startDate?: Date;
        endDate?: Date;
        diaSemana?: number;
    }): Promise<KpisResult>;
    getEntidades(params: {
        mesIdx: number;
        anio: number;
        startDate?: Date;
        endDate?: Date;
        diaSemana?: number;
    }): Promise<{
        rows: EntidadRow[];
        total: number;
    }>;
    getCumplimientoSemanal(params: {
        mesIdx: number;
        anio: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        semanas: SemanaRow[];
    }>;
    getDiasSemana(params: {
        mesIdx: number;
        anio: number;
        startDate?: Date;
        endDate?: Date;
    }): Promise<DiaSemanaRow[]>;
    getTendencia(params: {
        meses: number;
    }): Promise<Array<{
        mes: string;
        anio: number;
        mesIdx: number;
        total: number;
        presupuesto: number;
    }>>;
}
export declare const reportesService: ReportesService;
export {};
//# sourceMappingURL=reportes.service.d.ts.map