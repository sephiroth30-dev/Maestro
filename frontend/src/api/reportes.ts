import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KpisResult {
  facturacion_bruta: number;
  presupuesto: number;
  cumplimiento_pct: number;
  atenciones: number;
  ticket_promedio: number;
  proyeccion_cierre: number;
  proyeccion_cumplimiento_pct: number;
  dias_transcurridos: number;
  dias_restantes: number;
  facturacion_hoy: number;
  promedio_diario: number;
  semanas_en_meta: number;
  semanas_total: number;
}

export interface EntidadRow {
  entidad: string;
  tipo: string;
  es_grupo: boolean;
  cantidad: number;
  valor_bruto: number;
  participacion_pct: number;
}

export interface EntidadesResult {
  rows: EntidadRow[];
  total: number;
}

export interface SemanaRow {
  numero: number;
  fecha_ini: string;
  fecha_fin: string;
  estimado: number;
  venta: number;
  cumplimiento_pct: number;
  estado: 'CERRADA' | 'EN_CURSO' | 'FUTURA';
}

export interface CumplimientoSemanalResult {
  semanas: SemanaRow[];
}

export interface DiaSemanaRow {
  dia: string;
  dia_num: number;
  promedio: number;
  total: number;
  atenciones: number;
}

export interface TendenciaRow {
  mes: string;
  anio: number;
  mesIdx: number;
  total: number;
  presupuesto: number;
}

export interface PresupuestoRow {
  id: string;
  anio: number;
  mes: number;
  monto: number;
  notas: string | null;
  createdAt: string;
}

// ─── Query config ─────────────────────────────────────────────────────────────

const STALE_TIME = 5 * 60 * 1000;       // 5 min
const REFETCH_INTERVAL = 10 * 60 * 1000; // 10 min

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useKpis(mesIdx: number, anio: number, entidadId?: string) {
  const params = new URLSearchParams({
    mes_idx: String(mesIdx),
    anio: String(anio),
  });
  if (entidadId) params.set('entidad_id', entidadId);

  return useQuery<KpisResult>({
    queryKey: ['kpis', mesIdx, anio, entidadId],
    queryFn: async () => {
      const response = await apiClient.get<KpisResult>(`/api/reportes/kpis?${params}`);
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useEntidades(mesIdx: number, anio: number) {
  return useQuery<EntidadesResult>({
    queryKey: ['entidades', mesIdx, anio],
    queryFn: async () => {
      const response = await apiClient.get<EntidadesResult>(
        `/api/reportes/entidades?mes_idx=${mesIdx}&anio=${anio}`
      );
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useCumplimientoSemanal(mesIdx: number, anio: number) {
  return useQuery<CumplimientoSemanalResult>({
    queryKey: ['cumplimiento-semanal', mesIdx, anio],
    queryFn: async () => {
      const response = await apiClient.get<CumplimientoSemanalResult>(
        `/api/reportes/cumplimiento/semanal?mes_idx=${mesIdx}&anio=${anio}`
      );
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useDiasSemana(mesIdx: number, anio: number) {
  return useQuery<DiaSemanaRow[]>({
    queryKey: ['dias-semana', mesIdx, anio],
    queryFn: async () => {
      const response = await apiClient.get<DiaSemanaRow[]>(
        `/api/reportes/dias-semana?mes_idx=${mesIdx}&anio=${anio}`
      );
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useTendencia(meses = 6) {
  return useQuery<TendenciaRow[]>({
    queryKey: ['tendencia', meses],
    queryFn: async () => {
      const response = await apiClient.get<TendenciaRow[]>(
        `/api/reportes/tendencia?meses=${meses}`
      );
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function usePresupuestos() {
  return useQuery<PresupuestoRow[]>({
    queryKey: ['presupuestos'],
    queryFn: async () => {
      const response = await apiClient.get<PresupuestoRow[]>('/api/reportes/presupuestos');
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}
