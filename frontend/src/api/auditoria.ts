import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from './client.js';
import type { AuditLog, AuditoriaResponse } from '../types/index.js';

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

/**
 * Trae todas las páginas del filtro actual para exportar.
 *
 * El backend limita `limit` a 200 (zod, auditoria.controller.ts), así que esto
 * son varias peticiones. Van SECUENCIALES a propósito: el servidor está en
 * hosting compartido con rate-limit, y una ráfaga de 10 peticiones simultáneas
 * es justo lo que lo dispara.
 */
export const AUDITORIA_EXPORT_MAX = 2000;
const PAGE_SIZE = 200;

export async function fetchAuditoriaAll(
  params: AuditoriaParams,
  max: number = AUDITORIA_EXPORT_MAX,
): Promise<{ rows: AuditLog[]; total: number; truncated: boolean }> {
  const base = Object.fromEntries(
    Object.entries({ ...params, page: undefined, limit: undefined })
      .filter(([, v]) => v !== undefined && v !== '')
  );

  const rows: AuditLog[] = [];
  let total = 0;

  for (let page = 1; rows.length < max; page += 1) {
    const res = await api.get<AuditoriaResponse>('/auditoria', {
      params: { ...base, page, limit: PAGE_SIZE },
    });
    total = res.data.total;
    rows.push(...res.data.data);
    if (res.data.data.length < PAGE_SIZE || rows.length >= total) break;
  }

  return { rows: rows.slice(0, max), total, truncated: total > max };
}
