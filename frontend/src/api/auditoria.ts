import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from './client.js';
import type { AuditoriaResponse } from '../types/index.js';

export interface AuditoriaParams {
  page?: number;
  limit?: number;
  usuarioId?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
}

export function useAuditoria(params: AuditoriaParams) {
  return useQuery<AuditoriaResponse>({
    queryKey: ['auditoria', params],
    queryFn: () =>
      api
        .get<AuditoriaResponse>('/auditoria', {
          params: Object.fromEntries(
            Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
          ),
        })
        .then((r) => r.data),
    staleTime: 15_000,
  });
}

export function useAuditoriaAcciones() {
  return useQuery<string[]>({
    queryKey: ['auditoria-acciones'],
    queryFn: () => api.get<string[]>('/auditoria/acciones').then((r) => r.data),
    staleTime: 60_000,
  });
}
