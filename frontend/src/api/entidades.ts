import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';

export interface EntidadCatalogRow {
  id: string;
  nombre: string;
  tipo: string;
  es_grupo_caja: boolean;
  activa: boolean;
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['entidades-catalog'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['entidades'] });
    },
  });
}
