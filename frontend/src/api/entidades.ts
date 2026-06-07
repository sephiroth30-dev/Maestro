import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';

export const TIPOS_ENTIDAD = ['EPS', 'ARL', 'CONVENIO', 'PARTICULAR', 'OTRO'] as const;
export type TipoEntidad = typeof TIPOS_ENTIDAD[number];

export interface EntidadCatalogRow {
  id: string;
  nombre: string;
  tipo: string;
  es_grupo_caja: boolean;
  activa: boolean;
  nombres_raw: string[];
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['entidades-catalog'] });
  void qc.invalidateQueries({ queryKey: ['kpis'] });
  void qc.invalidateQueries({ queryKey: ['entidades'] });
}

export function useEntidadesCatalog() {
  return useQuery<EntidadCatalogRow[]>({
    queryKey: ['entidades-catalog'],
    queryFn: async () => {
      const res = await apiClient.get<EntidadCatalogRow[]>('/entidades');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateEntidadGrupoCaja() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, es_grupo_caja }: { id: string; es_grupo_caja: boolean }) =>
      apiClient.patch(`/entidades/${id}`, { es_grupo_caja }).then((r) => r.data),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateEntidadTipo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tipo, es_grupo_caja }: { id: string; tipo: TipoEntidad; es_grupo_caja?: boolean }) =>
      apiClient.patch(`/entidades/${id}`, { tipo, ...(es_grupo_caja !== undefined ? { es_grupo_caja } : {}) }).then((r) => r.data),
    onSuccess: () => invalidateAll(qc),
  });
}

export interface BulkPatchItem {
  id: string;
  tipo?: TipoEntidad;
  es_grupo_caja?: boolean;
}

export function useUpdateEntidadNombresRaw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, nombres_raw, nombre }: { id: string; nombres_raw: string[]; nombre?: string }) =>
      apiClient.patch(`/entidades/${id}`, { nombres_raw, ...(nombre !== undefined ? { nombre } : {}) }).then((r) => r.data),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useReclasificarEntidades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<{ updated: number; sin_entidad: number }>('/entidades/reclasificar').then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['entidades-catalog'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['entidades'] });
      void qc.invalidateQueries({ queryKey: ['sin-entidad-diagnostico'] });
    },
  });
}

export function useBulkUpdateEntidades() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: BulkPatchItem[]) =>
      Promise.all(
        items.map((item) => {
          const { id, ...fields } = item;
          return apiClient.patch(`/entidades/${id}`, fields).then((r) => r.data);
        })
      ),
    onSuccess: () => invalidateAll(qc),
  });
}
