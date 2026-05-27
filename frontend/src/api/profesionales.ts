import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';

export type Especialidad = 'NEUROLOGIA' | 'FISIATRIA' | 'OTRO' | null;

export interface ProfesionalRow {
  id: string;
  nombre: string;
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

export function useUpdateProfesionalEspecialidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, especialidad }: { id: string; especialidad: Especialidad }) =>
      apiClient.patch(`/profesionales/${id}`, { especialidad }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profesionales-catalog'] });
    },
  });
}
