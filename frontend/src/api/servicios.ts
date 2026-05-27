import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';

export interface ServicioCatalogRow {
  id: string;
  nombre: string;
  palabras_clave: string[];
  tipo_conteo: 'unidad' | 'sesion';
  orden: number;
  total_atenciones: number;
}

export function useServiciosCatalog() {
  return useQuery<ServicioCatalogRow[]>({
    queryKey: ['servicios-catalog'],
    queryFn: async () => {
      const res = await apiClient.get<ServicioCatalogRow[]>('/servicios');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateServicioTipoConteo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tipo_conteo }: { id: string; tipo_conteo: 'unidad' | 'sesion' }) =>
      apiClient.patch(`/servicios/${id}`, { tipo_conteo }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servicios-catalog'] });
      void qc.invalidateQueries({ queryKey: ['servicios'] });
    },
  });
}
