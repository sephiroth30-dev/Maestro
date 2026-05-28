export interface HonorariosLineaDB {
    profesional_id: string;
    profesional_nombre: string;
    profesional_display: string;
    servicio_nombre: string | null;
    servicio_tipo_conteo: string;
    entidad_tipo: string | null;
    entidad_nombre: string | null;
    cnt: number;
    cnt_sesiones: number;
    total_valor: number;
}
export declare function getLineasHonorarios(mesIdx: number, anio: number): Promise<HonorariosLineaDB[]>;
//# sourceMappingURL=honorarios.repo.d.ts.map