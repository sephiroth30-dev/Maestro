import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';

export interface ServicioCatalogRow {
  id: string;
  nombre: string;
  nombre_display: string | null;
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

export function useUpdateServicio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string; tipo_conteo?: 'unidad' | 'sesion'; nombre_display?: string | null }) =>
      apiClient.patch(`/servicios/${id}`, fields).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servicios-catalog'] });
      void qc.invalidateQueries({ queryKey: ['servicios'] });
    },
  });
}

export interface ReclasificarResult {
  total: number;
  updated: number;
  sin_clasificar: number;
}

export function useReclasificarServicios() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<ReclasificarResult>('/admin/reclasificar-servicios').then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['servicios-catalog'] });
      void qc.invalidateQueries({ queryKey: ['servicios'] });
      void qc.invalidateQueries({ queryKey: ['sin-servicio-diagnostico'] });
    },
  });
}

// ─── Agrupaciones (what raw descriptions actually map to each service) ─────────

export interface ServicioAgrupacionItem {
  descripcion_raw: string | null;
  cnt: number;
  valor: number;
}

export interface ServicioAgrupacion {
  servicio_id: string;
  nombre: string;
  total_cnt: number;
  items: ServicioAgrupacionItem[];
}

export function useServicioAgrupaciones() {
  return useQuery<ServicioAgrupacion[]>({
    queryKey: ['servicio-agrupaciones'],
    queryFn: async () => {
      const res = await apiClient.get<ServicioAgrupacion[]>('/diagnostico/servicio-agrupaciones');
      return res.data;
    },
    staleTime: 120_000,
  });
}
