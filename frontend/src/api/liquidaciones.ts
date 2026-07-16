import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from './client.js';
import type { HonorariosProfesionalRow } from './honorarios.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EstadoLiquidacion = 'CALCULADO' | 'APROBADO' | 'PAGADO';

export interface LiquidacionRow {
  id: string;
  profesional_id: string;
  profesional_nombre: string;
  profesional_display: string;
  especialidad: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  estado: EstadoLiquidacion;
  es_simulado: boolean;
  monto_total: number;
  datos_snapshot: HonorariosProfesionalRow;
  aprobado_por: string | null;
  aprobado_por_nombre: string | null;
  aprobado_en: string | null;
  pagado_por: string | null;
  pagado_por_nombre: string | null;
  pagado_en: string | null;
  notas: string | null;
}

// ─── Query key ────────────────────────────────────────────────────────────────

export const liqKey = (fd: string, fh: string) => ['liquidaciones', fd, fh] as const;

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useLiquidaciones(fechaDesde: string, fechaHasta: string) {
  return useQuery<LiquidacionRow[]>({
    queryKey: liqKey(fechaDesde, fechaHasta),
    queryFn: () =>
      api.get<LiquidacionRow[]>('/liquidaciones', { params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta } })
         .then((r) => r.data),
    enabled: !!fechaDesde && !!fechaHasta,
    staleTime: 30_000,
  });
}

export function useGenerarLiquidaciones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fechaDesde, fechaHasta }: { fechaDesde: string; fechaHasta: string }) =>
      api.post<LiquidacionRow[]>('/liquidaciones/generar', { fecha_desde: fechaDesde, fecha_hasta: fechaHasta })
         .then((r) => r.data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: liqKey(vars.fechaDesde, vars.fechaHasta) });
    },
  });
}

export function useAprobarLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<LiquidacionRow>(`/liquidaciones/${id}/aprobar`).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['liquidaciones'] }); },
  });
}

export function usePagarLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notas }: { id: string; notas?: string }) =>
      api.post<LiquidacionRow>(`/liquidaciones/${id}/pagar`, { notas }).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['liquidaciones'] }); },
  });
}

export function useAprobarLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/liquidaciones/aprobar-lote', { ids }).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['liquidaciones'] }); },
  });
}

export function useRevertirLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, razon }: { id: string; razon: string }) =>
      api.post<LiquidacionRow>(`/liquidaciones/${id}/revertir`, { razon }).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['liquidaciones'] }); },
  });
}

export function usePagarLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      api.post('/liquidaciones/pagar-lote', { ids }).then((r) => r.data),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['liquidaciones'] }); },
  });
}

// ─── PDF download (needs auth header) ────────────────────────────────────────

export async function descargarPDF(id: string, nombre: string): Promise<void> {
  const response = await api.get(`/liquidaciones/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `honorarios-${nombre.replace(/\s+/g, '_')}-${id.substring(0, 8)}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
