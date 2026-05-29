import type { HonorariosProfesionalRow } from '../services/honorarios.service.js';
export type EstadoLiquidacion = 'CALCULADO' | 'APROBADO' | 'PAGADO';
export interface LiquidacionDB {
    id: string;
    profesional_id: string;
    profesional_nombre: string;
    profesional_display: string;
    especialidad: string | null;
    fecha_desde: string;
    fecha_hasta: string;
    estado: EstadoLiquidacion;
    monto_total: number;
    datos_snapshot: HonorariosProfesionalRow;
    aprobado_por: string | null;
    aprobado_por_nombre: string | null;
    aprobado_en: string | null;
    pagado_por: string | null;
    pagado_por_nombre: string | null;
    pagado_en: string | null;
    notas: string | null;
    created_at: string;
    updated_at: string;
}
export declare function revertirEstado(id: string, _usuarioId: string, razon: string): Promise<void>;
export declare function getLiquidacionesByPeriodo(fechaDesde: string, fechaHasta: string): Promise<LiquidacionDB[]>;
export declare function getLiquidacionById(id: string): Promise<LiquidacionDB | null>;
export declare function upsertLiquidacion(data: {
    profesional_id: string;
    fecha_desde: string;
    fecha_hasta: string;
    monto_total: number;
    datos_snapshot: HonorariosProfesionalRow;
}): Promise<string>;
export declare function actualizarEstado(id: string, estado: 'APROBADO' | 'PAGADO', usuarioId: string, notas?: string): Promise<void>;
export declare function actualizarEstadoLote(ids: string[], estado: 'APROBADO' | 'PAGADO', usuarioId: string): Promise<void>;
//# sourceMappingURL=liquidaciones.repo.d.ts.map