import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from './client.js';

export interface ContribucionRow {
  profesional_nombre: string;
  total_particular: number;
  total_entidad: number;
  total_bruto: number;
}

export interface HonorariosCeldas {
  monto: number;
  cnt: number;
}

export interface HonorariosProfesionalRow {
  profesional_id: string;
  nombre: string;
  consulta:       HonorariosCeldas;
  emg_vcn:        HonorariosCeldas;
  infiltracion:   HonorariosCeldas;
  ecografia:      HonorariosCeldas;
  terapia_choque: HonorariosCeldas;
  junta:          HonorariosCeldas;
  eeg:            HonorariosCeldas;
  psg_lms:        HonorariosCeldas;
  tlm:            HonorariosCeldas;
  pe:             HonorariosCeldas;
  total: number;
  sin_regla: HonorariosCeldas;
}

export interface HonorariosResult {
  year: number;
  month: number;
  rows: HonorariosProfesionalRow[];
  totales: Omit<HonorariosProfesionalRow, 'profesional_id' | 'nombre'>;
}

export function useHonorarios(mesIdx: number, anio: number) {
  return useQuery<HonorariosResult>({
    queryKey: ['honorarios', anio, mesIdx],
    queryFn: () =>
      api
        .get<HonorariosResult>('/honorarios', { params: { mes_idx: mesIdx, anio } })
        .then((r) => r.data),
    enabled: mesIdx >= 1 && mesIdx <= 12 && anio >= 2020,
    staleTime: 60_000,
  });
}

export function useContribucion(fechaDesde: string, fechaHasta: string, enabled = true) {
  return useQuery<ContribucionRow[]>({
    queryKey: ['contribucion', fechaDesde, fechaHasta],
    queryFn: () =>
      api
        .get<ContribucionRow[]>('/honorarios/contribucion', { params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta } })
        .then((r) => r.data),
    enabled: enabled && Boolean(fechaDesde) && Boolean(fechaHasta),
    staleTime: 60_000,
  });
}
