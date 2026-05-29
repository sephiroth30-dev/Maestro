import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from './client.js';
import type { CapacidadConfig, UtilizacionGrupo } from '../types/index.js';

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useCapacidadConfig(anio: number) {
  return useQuery<CapacidadConfig[]>({
    queryKey: ['capacidad-config', anio],
    queryFn: () =>
      api
        .get<CapacidadConfig[]>('/capacidad', { params: { anio } })
        .then((r) => r.data),
    enabled: anio >= 2020,
    staleTime: 60_000,
  });
}

export function useUtilizacion(anio: number, mesIdx: number) {
  return useQuery<UtilizacionGrupo[]>({
    queryKey: ['capacidad-utilizacion', anio, mesIdx],
    queryFn: () =>
      api
        .get<UtilizacionGrupo[]>('/capacidad/utilizacion', {
          params: { anio, mes_idx: mesIdx },
        })
        .then((r) => r.data),
    enabled: anio >= 2020 && mesIdx >= 1 && mesIdx <= 12,
    staleTime: 60_000,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export interface UpsertCapacidadInput {
  grupo: string;
  nombre: string;
  anio: number;
  mesIdx: number;
  capacidad: number;
  recursos?: string | null;
}

export function useUpsertCapacidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertCapacidadInput) =>
      api.post<CapacidadConfig>('/capacidad', data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['capacidad-config', variables.anio] });
      void qc.invalidateQueries({ queryKey: ['capacidad-utilizacion', variables.anio] });
    },
  });
}

export interface BulkUpsertInput {
  rows: UpsertCapacidadInput[];
}

export function useUpsertCapacidadBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkUpsertInput) =>
      api.post<CapacidadConfig[]>('/capacidad/bulk', data).then((r) => r.data),
    onSuccess: (_data, variables) => {
      const anios = [...new Set(variables.rows.map((r) => r.anio))];
      anios.forEach((anio) => {
        void qc.invalidateQueries({ queryKey: ['capacidad-config', anio] });
        void qc.invalidateQueries({ queryKey: ['capacidad-utilizacion', anio] });
      });
    },
  });
}

export interface DeleteCapacidadInput {
  grupo: string;
  anio: number;
  mesIdx: number;
}

export function useDeleteCapacidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ grupo, anio, mesIdx }: DeleteCapacidadInput) =>
      api
        .delete(`/capacidad/${encodeURIComponent(grupo)}/${anio}/${mesIdx}`)
        .then((r) => r.data as { ok: boolean }),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['capacidad-config', variables.anio] });
      void qc.invalidateQueries({ queryKey: ['capacidad-utilizacion', variables.anio] });
    },
  });
}
