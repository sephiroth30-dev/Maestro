export type EstadoAjuste = 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO';
export interface AjusteDB {
    id: string;
    liquidacion_id: string;
    categoria: string;
    descripcion: string;
    cantidad: number;
    valor_unitario: number;
    valor_total: number;
    justificacion: string;
    referencia_doc: string | null;
    estado: EstadoAjuste;
    creado_por: string;
    creado_por_nombre: string | null;
    autorizado_por: string | null;
    autorizado_por_nombre: string | null;
    autorizado_en: string | null;
    motivo_rechazo: string | null;
    created_at: string;
}
export declare function getAjustesByLiquidacion(liquidacionId: string): Promise<AjusteDB[]>;
export declare function getAjusteById(id: string): Promise<AjusteDB | null>;
export declare function crearAjuste(data: {
    liquidacion_id: string;
    categoria: string;
    descripcion: string;
    cantidad: number;
    valor_unitario: number;
    justificacion: string;
    referencia_doc?: string;
    creado_por: string;
}): Promise<AjusteDB>;
export declare function autorizarAjuste(id: string, autorizadoPor: string): Promise<void>;
export declare function rechazarAjuste(id: string, usuarioId: string, motivo: string): Promise<void>;
export declare function eliminarAjuste(id: string, creadoPor: string): Promise<void>;
export declare function getMontoAjustesAutorizados(liquidacionId: string): Promise<number>;
//# sourceMappingURL=ajustes.repo.d.ts.map