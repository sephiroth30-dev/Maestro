import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

export function useKpis(mesIdx: number, anio: number, entidadId?: string, startDate?: string, endDate?: string, diaSemana?: number) {
  const params = new URLSearchParams();
  if (startDate && endDate) {
    params.set('start_date', startDate);
    params.set('end_date', endDate);
  } else {
    params.set('mes_idx', String(mesIdx));
    params.set('anio', String(anio));
  }
  if (entidadId) params.set('entidad_id', entidadId);
  if (diaSemana !== undefined) params.set('dia_semana', String(diaSemana));

  return useQuery<KpisResult>({
    queryKey: ['kpis', mesIdx, anio, entidadId, startDate, endDate, diaSemana],
    queryFn: async () => {
      const response = await apiClient.get<KpisResult>(`/reportes/kpis?${params}`);
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useEntidades(mesIdx: number, anio: number, startDate?: string, endDate?: string, diaSemana?: number) {
  const params = new URLSearchParams();
  if (startDate && endDate) {
    params.set('start_date', startDate);
    params.set('end_date', endDate);
  } else {
    params.set('mes_idx', String(mesIdx));
    params.set('anio', String(anio));
  }
  if (diaSemana !== undefined) params.set('dia_semana', String(diaSemana));

  return useQuery<EntidadesResult>({
    queryKey: ['entidades', mesIdx, anio, startDate, endDate, diaSemana],
    queryFn: async () => {
      const response = await apiClient.get<EntidadesResult>(`/reportes/entidades?${params}`);
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useCumplimientoSemanal(mesIdx: number, anio: number, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate && endDate) {
    params.set('start_date', startDate);
    params.set('end_date', endDate);
  } else {
    params.set('mes_idx', String(mesIdx));
    params.set('anio', String(anio));
  }

  return useQuery<CumplimientoSemanalResult>({
    queryKey: ['cumplimiento-semanal', mesIdx, anio, startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<CumplimientoSemanalResult>(`/reportes/cumplimiento/semanal?${params}`);
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useDiasSemana(mesIdx: number, anio: number, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate && endDate) {
    params.set('start_date', startDate);
    params.set('end_date', endDate);
  } else {
    params.set('mes_idx', String(mesIdx));
    params.set('anio', String(anio));
  }
  return useQuery<DiaSemanaRow[]>({
    queryKey: ['dias-semana', mesIdx, anio, startDate, endDate],
    queryFn: async () => {
      const response = await apiClient.get<DiaSemanaRow[]>(`/reportes/dias-semana?${params}`);
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
        `/reportes/tendencia?meses=${meses}`
      );
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export interface DiagnosticoRow {
  conector_id: string;
  conector_nombre: string;
  anio: number;
  mes_idx: number;
  atenciones: number;
  valor_bruto: number;
  sin_entidad: number;
  sin_valor: number;
}

export function useDiagnostico() {
  return useQuery<DiagnosticoRow[]>({
    queryKey: ['diagnostico'],
    queryFn: async () => {
      const res = await apiClient.get<DiagnosticoRow[]>('/reportes/diagnostico');
      return res.data;
    },
    staleTime: 30_000,
  });
}

// Alias used by Configuracion page (matches spec name)
export type Presupuesto = PresupuestoRow;

export function usePresupuestos() {
  return useQuery<PresupuestoRow[]>({
    queryKey: ['presupuestos'],
    queryFn: async () => {
      const response = await apiClient.get<PresupuestoRow[]>('/reportes/presupuestos');
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useUpsertPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { anio: number; mes: number; monto: number; notas?: string }) =>
      apiClient.post<PresupuestoRow>('/reportes/presupuestos', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['presupuestos'] });
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['tendencia'] });
    },
  });
}
