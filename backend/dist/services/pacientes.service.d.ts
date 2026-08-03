/**
 * Compone la analítica de pacientes en una sola respuesta.
 *
 * Siete agregados en un solo viaje: en hosting compartido siete peticiones HTTP
 * costarían más que las consultas, y el cliente tiene 15 s de timeout.
 */
import * as repo from '../repositories/pacientes.repo.js';
import type { PacientesParams } from '../repositories/pacientes.repo.js';
export interface PacientesResult {
    cobertura: {
        filas: number;
        filas_con_paciente: number;
        filas_con_documento: number;
        cobertura_pct: number;
        cobertura_documento_pct: number;
        valor_total: number;
        valor_sin_paciente: number;
        por_conector: {
            conector_id: string | null;
            conector_nombre: string;
            filas: number;
            filas_con_paciente: number;
            cobertura_pct: number;
        }[];
    };
    resumen: {
        pacientes_unicos: number;
        atenciones_con_paciente: number;
        visitas_unicas: number;
        promedio_atenciones: number;
        promedio_visitas: number;
        nuevos: number;
        recurrentes: number;
        nuevos_pct: number;
        historia_desde: string | null;
    };
    frecuencia: {
        bucket: string;
        pacientes: number;
        pct: number;
    }[];
    por_pagador: repo.DimensionRow[];
    pacientes_multi_pagador: number;
    por_servicio: (repo.DimensionRow & {
        atenciones_por_paciente: number;
    })[];
    retencion: {
        anio: number;
        mes_idx: number;
        label: string;
        pacientes: number;
        retenidos: number;
        retencion_pct: number | null;
    }[];
}
export declare function getPacientes(p: PacientesParams): Promise<PacientesResult>;
export declare function getDetalleAtenciones(p: PacientesParams, limit: number): ReturnType<typeof repo.getDetalleAtenciones>;
//# sourceMappingURL=pacientes.service.d.ts.map