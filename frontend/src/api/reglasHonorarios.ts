import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from './client.js';

export interface ReglaHonorariosRow {
  id: string;
  profesional_nombre: string;
  categoria: string;
  tipo: 'fijo' | 'pct';
  valor_entidad: number;
  valor_particular: number;
  activo: boolean;
  notas: string | null;
}

export interface ReglaEspecialRow {
  id: string;
  tipo_regla: string;
  profesional_nombre: string;
  condicion: string | null;
  valor: number;
  descripcion: string | null;
  activo: boolean;
}

interface ReglasResponse {
  reglas: ReglaHonorariosRow[];
  especiales: ReglaEspecialRow[];
}

const QUERY_KEY = ['reglas-honorarios'];

export function useReglasHonorarios() {
  return useQuery<ReglasResponse>({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<ReglasResponse>('/reglas-honorarios').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useUpsertRegla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      profesional_nombre: string;
      categoria: string;
      tipo: 'fijo' | 'pct';
      valor_entidad: number;
      valor_particular: number;
      notas?: string | null;
    }) => api.put('/reglas-honorarios', payload).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: QUERY_KEY }); },
  });
}

export function useDeleteRegla() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/reglas-honorarios/${id}`).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: QUERY_KEY }); },
  });
}

export function useUpdateReglaEspecial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; valor: number; descripcion?: string | null }) =>
      api.patch(`/reglas-honorarios/especiales/${payload.id}`, {
        valor: payload.valor,
        descripcion: payload.descripcion,
      }).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: QUERY_KEY }); },
  });
}
