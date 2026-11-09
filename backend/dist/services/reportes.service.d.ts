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
    id: string | null;
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
export interface ServicioRow {
    id: string;
    nombre: string;
    tipo_conteo: 'unidad' | 'sesion';
    orden: number;
    categoria: string | null;
    cantidad: number;
    horas: number | null;
    valor_bruto: number;
}
export interface ServiciosResult {
    rows: ServicioRow[];
    sin_clasificar: number;
    valor_sin_clasificar: number;
    alerta_emg_neuro: boolean;
    emg_count: number;
    neuro_count: number;
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
        anio?: number;
    }): Promise<Array<{
        mes: string;
        anio: number;
        mesIdx: number;
        total: number;
        presupuesto: number;
    }>>;
    /**
     * Los meses de un año concreto, con su facturación y su presupuesto.
     *
     * Incluye un mes si tiene datos **o** presupuesto: así el año en curso muestra
     * también los meses futuros ya presupuestados, y un año histórico sin
     * presupuesto cargado solo muestra los meses con actividad. Los meses sin nada
     * de ninguno de los dos se omiten; el gráfico completa el eje de enero a
     * diciembre por su cuenta.
     */
    private getTendenciaDeAnio;
    getServicios(params: {
        mesIdx: number;
        anio: number;
        startDate?: Date;
        endDate?: Date;
        entidadId?: string;
        diaSemana?: number;
    }): Promise<ServiciosResult>;
    /**
     * Meses con datos, para el selector de Reportes.
     *
     * Se cachea como todo lo demás —y con el mismo prefijo de fuente— porque es
     * un agrupado sobre la tabla entera y lo pide cada carga de la pantalla.
     */
    getMesesDisponibles(): Promise<Array<{
        anio: number;
        mes: number;
        total: number;
        atenciones: number;
    }>>;
}
export declare const reportesService: ReportesService;
export {};
//# sourceMappingURL=reportes.service.d.ts.map