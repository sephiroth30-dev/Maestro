import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from './client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EstadoAjuste = 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO';

export interface AjusteRow {
  id: string;
  liquidacion_id: string;
  categoria: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
  justificacion: string;
  referencia_doc: string | null;
  estado: EstadoAjuste;
  creado_por: string;
  creado_por_nombre: string | null;
  autorizado_por: string | null;
  autorizado_por_nombre: string | null;
  autorizado_en: string | null;
  motivo_rechazo: string | null;
  created_at: string;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAjustes(liquidacionId: string, enabled = true) {
  return useQuery<AjusteRow[]>({
    queryKey: ['ajustes', liquidacionId],
    queryFn: () =>
      api.get<AjusteRow[]>(`/liquidaciones/${liquidacionId}/ajustes`).then((r) => r.data),
    enabled,
    staleTime: 15_000,
  });
}

export function useCrearAjuste(liquidacionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      categoria: string;
      descripcion: string;
      cantidad: number;
      valor_unitario: number;
      justificacion: string;
      referencia_doc?: string;
    }) => api.post<AjusteRow>(`/liquidaciones/${liquidacionId}/ajustes`, data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ajustes', liquidacionId] });
      void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
    },
  });
}

export function useAutorizarAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<AjusteRow>(`/ajustes/${id}/autorizar`).then((r) => r.data),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['ajustes', data.liquidacion_id] });
      void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
    },
  });
}

export function useRechazarAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post<AjusteRow>(`/ajustes/${id}/rechazar`, { motivo }).then((r) => r.data),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['ajustes', data.liquidacion_id] });
      void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
    },
  });
}

export function useEliminarAjuste() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, liquidacionId }: { id: string; liquidacionId: string }) =>
      api.delete(`/ajustes/${id}`).then(() => ({ id, liquidacionId })),
    onSuccess: ({ liquidacionId }) => {
      void qc.invalidateQueries({ queryKey: ['ajustes', liquidacionId] });
      void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
    },
  });
}
