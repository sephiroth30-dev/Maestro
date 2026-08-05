import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from './client.js';
import type { BaseConteo, CapacidadConfig, UtilizacionGrupo } from '../types/index.js';

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

/** Catálogo de grupos con su base por omisión, servido por el backend. */
export interface GrupoCatalogo {
  grupo: string;
  nombre: string;
  base: BaseConteo;
}

/**
 * El catálogo lo define el backend en `config/capacidad-grupos.ts`. Se pide en
 * vez de repetirlo aquí: la lista de nombres ya vivía duplicada y las reglas de
 * conteo habrían acabado divergiendo igual.
 */
export function useGruposCapacidad() {
  return useQuery<GrupoCatalogo[]>({
    queryKey: ['capacidad-grupos'],
    queryFn: () => api.get<GrupoCatalogo[]>('/capacidad/grupos').then((r) => r.data),
    staleTime: 60 * 60 * 1000, // sólo cambia con un despliegue
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
  /** `null` deja que el grupo use su base por omisión. */
  baseConteo?: BaseConteo | null;
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

// ─── Utilización por rango de meses ───────────────────────────────────────────

export interface UtilizacionMes extends UtilizacionGrupo {
  anio: number;
  mesIdx: number;
}

/**
 * Utilización mes a mes, para ver y exportar el histórico.
 *
 * Devuelve una fila por grupo y por mes; solo aparecen los meses con actividad
 * o con capacidad configurada.
 */
export function useUtilizacionRango(
  desdeAnio: number,
  desdeMes: number,
  hastaAnio: number,
  hastaMes: number,
  enabled = true,
) {
  return useQuery<UtilizacionMes[]>({
    queryKey: ['utilizacion-rango', desdeAnio, desdeMes, hastaAnio, hastaMes],
    queryFn: async () => {
      const p = new URLSearchParams({
        desde_anio: String(desdeAnio),
        desde_mes: String(desdeMes),
        hasta_anio: String(hastaAnio),
        hasta_mes: String(hastaMes),
      });
      const r = await api.get<UtilizacionMes[]>(`/capacidad/utilizacion/rango?${p}`);
      return r.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
