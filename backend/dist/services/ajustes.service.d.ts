import { getAjustesByLiquidacion, type AjusteDB } from '../repositories/ajustes.repo.js';
export { getAjustesByLiquidacion };
export declare function crearAjusteLiquidacion(liquidacionId: string, usuarioId: string, data: {
    categoria: string;
    descripcion: string;
    cantidad: number;
    valor_unitario: number;
    justificacion: string;
    referencia_doc?: string;
}): Promise<AjusteDB>;
export declare function autorizarAjusteLiquidacion(id: string, usuarioId: string): Promise<AjusteDB>;
export declare function rechazarAjusteLiquidacion(id: string, usuarioId: string, motivo: string): Promise<AjusteDB>;
export declare function eliminarAjusteLiquidacion(id: string, usuarioId: string): Promise<void>;
//# sourceMappingURL=ajustes.service.d.ts.map