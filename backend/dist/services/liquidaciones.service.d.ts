import { getLiquidacionesByPeriodo, getLiquidacionById, type LiquidacionDB } from '../repositories/liquidaciones.repo.js';
export declare function generarLiquidaciones(fechaDesde: string, fechaHasta: string): Promise<LiquidacionDB[]>;
export declare function aprobarLiquidacion(id: string, usuarioId: string): Promise<LiquidacionDB | null>;
export declare function aprobarLote(ids: string[], usuarioId: string): Promise<void>;
export declare function pagarLiquidacion(id: string, usuarioId: string, notas?: string): Promise<LiquidacionDB | null>;
export declare function pagarLote(ids: string[], usuarioId: string): Promise<void>;
export declare function revertirLiquidacion(id: string, usuarioId: string, razon: string): Promise<LiquidacionDB | null>;
export { getLiquidacionesByPeriodo, getLiquidacionById };
export declare function generarPDFLiquidacion(id: string): Promise<Buffer>;
//# sourceMappingURL=liquidaciones.service.d.ts.map