import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from './client.js';

const STALE_TIME = 5 * 60 * 1000;

export interface CoberturaConector {
  conector_id: string | null;
  conector_nombre: string;
  filas: number;
  filas_con_paciente: number;
  cobertura_pct: number;
}

export interface PacientesResult {
  cobertura: {
    filas: number;
    filas_con_paciente: number;
    filas_con_documento: number;
    cobertura_pct: number;
    cobertura_documento_pct: number;
    valor_total: number;
    valor_sin_paciente: number;
    por_conector: CoberturaConector[];
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
  frecuencia: { bucket: string; pacientes: number; pct: number }[];
  por_pagador: DimensionRow[];
  pacientes_multi_pagador: number;
  por_servicio: (DimensionRow & { atenciones_por_paciente: number })[];
  retencion: RetencionRow[];
}

export interface DimensionRow {
  clave: string | null;
  nombre: string;
  pacientes: number;
  atenciones: number;
  valor: number;
}

export interface RetencionRow {
  anio: number;
  mes_idx: number;
  label: string;
  pacientes: number;
  retenidos: number;
  retencion_pct: number | null;
}

function params(mesIdx: number, anio: number, startDate?: string, endDate?: string): URLSearchParams {
  const p = new URLSearchParams();
  if (startDate && endDate) {
    p.set('start_date', startDate);
    p.set('end_date', endDate);
  }
  p.set('mes_idx', String(mesIdx));
  p.set('anio', String(anio));
  return p;
}

export function usePacientes(mesIdx: number, anio: number, startDate?: string, endDate?: string) {
  return useQuery<PacientesResult>({
    queryKey: ['pacientes', mesIdx, anio, startDate, endDate],
    queryFn: () =>
      api.get<PacientesResult>(`/reportes/pacientes?${params(mesIdx, anio, startDate, endDate)}`)
        .then((r) => r.data),
    staleTime: STALE_TIME,
  });
}

// ─── Detalle fila por fila ────────────────────────────────────────────────────

export interface DetalleAtencionRow {
  fecha: string;
  paciente: string | null;
  documento: string | null;
  entidad: string | null;
  entidad_tipo: string | null;
  profesional: string | null;
  servicio: string | null;
  descripcion: string;
  autorizacion: string | null;
  valor_bruto: number;
}

export interface DetalleResult {
  rows: DetalleAtencionRow[];
  total: number;
  limite: number;
  truncado: boolean;
}

/**
 * No es un hook: sólo se pide al exportar. Traer decenas de miles de filas en
 * cada render de la página sería absurdo.
 */
export async function fetchDetalleAtenciones(
  mesIdx: number,
  anio: number,
  startDate?: string,
  endDate?: string,
  entidadId?: string,
  diaSemana?: number,
): Promise<DetalleResult> {
  const p = params(mesIdx, anio, startDate, endDate);
  if (entidadId) p.set('entidad_id', entidadId);
  if (diaSemana !== undefined) p.set('dia_semana', String(diaSemana));
  const r = await api.get<DetalleResult>(`/reportes/detalle-atenciones?${p}`, { timeout: 60_000 });
  return r.data;
}
