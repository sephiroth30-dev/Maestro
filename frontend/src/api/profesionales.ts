import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';

export type Especialidad = 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO' | null;

export interface ProfesionalRow {
  id: string;
  nombre: string;
  nombre_completo: string | null;
  nombres_raw: string[];
  es_nomina: boolean;
  especialidad: Especialidad;
  total_atenciones: number;
}

export function useProfesionales() {
  return useQuery<ProfesionalRow[]>({
    queryKey: ['profesionales-catalog'],
    queryFn: async () => {
      const res = await apiClient.get<ProfesionalRow[]>('/profesionales');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useUpdateProfesional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string; especialidad?: Especialidad; nombre_completo?: string | null }) =>
      apiClient.patch(`/profesionales/${id}`, fields).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profesionales-catalog'] });
    },
  });
}

export function useCreateProfesional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nombres_raw: string[]; nombre_completo?: string | null; especialidad?: Especialidad }) =>
      apiClient.post<{ id: string }>('/profesionales', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profesionales-catalog'] });
    },
  });
}
