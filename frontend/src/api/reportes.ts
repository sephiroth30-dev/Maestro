import { useQuery, useMutation, useQueryClient, type UseMutationResult, type QueryClient } from '@tanstack/react-query';
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
  id: string | null;
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

/**
 * `enabled` existe para la comparación entre meses: la pantalla llama a estos
 * hooks una segunda vez con el mes comparado, y sin esto pediría ese mes al
 * servidor aunque la comparación esté apagada. Las reglas de React prohíben
 * llamar un hook condicionalmente, así que lo condicional tiene que ser la
 * petición, no la llamada.
 */
export function useKpis(mesIdx: number, anio: number, entidadId?: string, startDate?: string, endDate?: string, diaSemana?: number, enabled = true) {
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
    enabled,
    queryKey: ['kpis', mesIdx, anio, entidadId, startDate, endDate, diaSemana],
    queryFn: async () => {
      const response = await apiClient.get<KpisResult>(`/reportes/kpis?${params}`);
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useEntidades(mesIdx: number, anio: number, startDate?: string, endDate?: string, diaSemana?: number, enabled = true) {
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
    enabled,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useCumplimientoSemanal(mesIdx: number, anio: number, startDate?: string, endDate?: string, enabled = true) {
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
    enabled,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useDiasSemana(mesIdx: number, anio: number, startDate?: string, endDate?: string, enabled = true) {
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
    enabled,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// ─── Agenda (citas pendientes) ────────────────────────────────────────────────
//
// Lo AGENDADO: citas pendientes de atender dentro del periodo, valoradas con lo
// que se ha facturado antes a esa EPS por ese tipo de servicio. La pantalla lo
// suma a lo ya facturado para obtener el PROYECTADO.
//
// Devuelve solo la parte agendada a propósito: lo facturado ya lo tiene la
// pantalla (kpis, entidades), y así no se calcula dos veces.

export interface AgendaEntidad {
  entidad_id: string | null;
  entidad: string;
  tipo: string;
  /** Citas pendientes de esa EPS dentro del periodo. */
  citas: number;
  /** Valor estimado de esas citas. */
  valor: number;
  /** Citas sin precio de referencia (no se cuentan como cero: se avisan). */
  citas_sin_valor: number;
  /**
   * Facturación mensual media de los últimos 3 meses cerrados. `null` si no hay
   * historial. No es un tope: es la referencia con la que se compara lo
   * proyectado para saber si la EPS va por encima o por debajo de lo normal.
   */
  promedio_3m: number | null;
}

export interface AgendaDia {
  /** YYYY-MM-DD */
  fecha: string;
  citas: number;
  valor: number;
}

export interface AgendaResult {
  /** Cuándo se sincronizaron las citas por última vez. */
  actualizado_en: string | null;
  /** Fecha de la última cita cargada (YYYY-MM-DD): hasta dónde llega la agenda. */
  horizonte: string | null;
  total: { citas: number; valor: number; citas_sin_valor: number };
  por_entidad: AgendaEntidad[];
  por_dia: AgendaDia[];
}

/**
 * Citas pendientes del periodo. Mismos parámetros que `useKpis`: mes o rango,
 * entidad y día de la semana, para que la proyección siga el filtro aplicado.
 *
 * `enabled` se apaga en periodos ya pasados: no queda agenda pendiente y pedirlo
 * sería una consulta para saber que es cero.
 */
export function useAgenda(
  mesIdx: number,
  anio: number,
  startDate?: string,
  endDate?: string,
  entidadId?: string,
  diaSemana?: number,
  enabled = true,
) {
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

  return useQuery<AgendaResult>({
    queryKey: ['agenda', mesIdx, anio, startDate, endDate, entidadId, diaSemana],
    queryFn: async () => {
      const response = await apiClient.get<AgendaResult>(`/reportes/agenda?${params}`);
      return response.data;
    },
    enabled,
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

export interface MesDisponible {
  anio: number;
  mes: number;
  total: number;
  atenciones: number;
}

/**
 * Los meses que de verdad tienen datos, del más reciente al más antiguo.
 *
 * El selector de Reportes los calculaba antes en el navegador ("los seis
 * anteriores a hoy"), así que ofrecía meses vacíos y escondía el historial.
 * Viene del servidor y ya respeta la fuente activa del dashboard.
 */
export function useMesesDisponibles() {
  return useQuery<MesDisponible[]>({
    queryKey: ['meses-disponibles'],
    queryFn: async () => {
      const response = await apiClient.get<MesDisponible[]>('/reportes/meses-disponibles');
      return response.data;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

/**
 * Los meses de UN año concreto con su facturación y presupuesto.
 *
 * `useTendencia(n)` solo trae «los n meses más recientes», así que con histórico
 * cargado no sirve para ver un año antiguo. `enabled` permite pedir el año
 * comparado únicamente cuando la comparación está activa.
 */
export function useTendenciaAnio(anio: number | null, enabled = true) {
  return useQuery<TendenciaRow[]>({
    queryKey: ['tendencia', 'anio', anio],
    queryFn: async () => {
      const response = await apiClient.get<TendenciaRow[]>(`/reportes/tendencia?anio=${anio}`);
      return response.data;
    },
    enabled: enabled && anio !== null,
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

export interface ServicioRow {
  id: string;
  nombre: string;
  tipo_conteo: 'unidad' | 'sesion';
  orden: number;
  categoria: string | null;
  cantidad: number;
  horas: number | null;
  valor_bruto: number;
}

export interface ServiciosResult {
  rows: ServicioRow[];
  sin_clasificar: number;
  valor_sin_clasificar: number;
  alerta_emg_neuro: boolean;
  emg_count: number;
  neuro_count: number;
}

export function useServicios(
  mesIdx: number,
  anio: number,
  startDate?: string,
  endDate?: string,
  entidadId?: string | null,
  diaSemana?: number | null,
  enabled = true,
) {
  const params = new URLSearchParams();
  if (startDate && endDate) {
    params.set('start_date', startDate);
    params.set('end_date', endDate);
  } else {
    params.set('mes_idx', String(mesIdx));
    params.set('anio', String(anio));
  }
  if (entidadId) params.set('entidad_id', entidadId);
  if (diaSemana != null) params.set('dia_semana', String(diaSemana));
  return useQuery<ServiciosResult>({
    queryKey: ['servicios', mesIdx, anio, startDate, endDate, entidadId ?? null, diaSemana ?? null],
    queryFn: async () => {
      const response = await apiClient.get<ServiciosResult>(`/reportes/servicios?${params}`);
      return response.data;
    },
    enabled,
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

// ─── Diagnóstico de la proyección por agenda (solo ADMIN) ────────────────────

export type PermisoAgenda = 'ok' | 'sin_permiso' | 'error' | 'desconocido';

export interface FilaBacktestAgenda {
  entidadKey: string;
  entidad: string;
  cumplidas: number;
  incumplidas: number;
  sinPrecio: number;
  estimado: number;
  real: number;
  cobertura: number | null;
  inasistencia: number | null;
}

export interface ResultadoBacktestAgenda {
  mes: string;
  filas: FilaBacktestAgenda[];
  total: Omit<FilaBacktestAgenda, 'entidadKey' | 'entidad'>;
}

export interface AgendaDiagnostico {
  configurada: boolean;
  conector: { id: string; nombre: string } | null;
  estado?: {
    ultimoIntento: string | null;
    ultimaOk: string | null;
    estado: 'nunca' | 'ok' | 'error';
    error: string | null;
    httpStatus: number | null;
    citasLeidas: number;
    citasGuardadas: number;
    citasSinPrecio: number;
    horizonte: string | null;
    duracionMs: number | null;
    conveniosEstado: 'ok' | 'sin_permiso' | 'error' | null;
    conveniosError: string | null;
    conveniosActualizado: string | null;
  } | null;
  permisos?: { citas: PermisoAgenda; convenios: PermisoAgenda };
  resumen?: { citas: number; conPrecio: number; sinPrecio: number; sinEntidad: number };
  conveniosSinEntidad?: Array<{ convenio: string; citas: number }>;
  citasSinPrecio?: Array<{ referencia: string; convenio: string; citas: number }>;
  backtest?: {
    estado: 'nunca' | 'corriendo' | 'ok' | 'error';
    iniciado: string | null;
    terminado: string | null;
    error: string | null;
    resultado: ResultadoBacktestAgenda | null;
  };
}

/**
 * Mientras el backtest corre (o la sincronización acaba de pedirse) se consulta
 * cada pocos segundos para ver el resultado sin recargar.
 */
export function useAgendaDiagnostico(refrescarCada: number | false = false) {
  return useQuery<AgendaDiagnostico>({
    queryKey: ['agenda-diagnostico'],
    queryFn: async () => {
      const res = await apiClient.get<AgendaDiagnostico>('/diagnostico/agenda');
      return res.data;
    },
    staleTime: 0,
    refetchInterval: refrescarCada,
  });
}

export function useSincronizarCitas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<{ status: string }>('/diagnostico/agenda/sincronizar')).data,
    // La sincronización corre en segundo plano (~1 min): se vuelve a leer el estado después.
    onSuccess: () => { setTimeout(() => { void qc.invalidateQueries({ queryKey: ['agenda-diagnostico'] }); }, 3000); },
  });
}

export function useEjecutarBacktest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await apiClient.post<{ status: string }>('/diagnostico/agenda/backtest')).data,
    onSuccess: () => { setTimeout(() => { void qc.invalidateQueries({ queryKey: ['agenda-diagnostico'] }); }, 1500); },
  });
}

export interface SinEntidadRow {
  nombre_raw: string | null;
  cnt: number;
  total: number;
}

/**
 * `startDate`/`endDate` (YYYY-MM-DD) cubren un rango en vez de un solo mes — los usa el
 * aviso del menú lateral para revisar una ventana de varios meses de una vez, en lugar de
 * solo el mes calendario de hoy. Con ambos presentes, el backend los prefiere sobre
 * `mesIdx`/`anio` (mismo comportamiento que el resto de endpoints de reportes).
 */
export function useSinEntidadDiagnostico(mesIdx: number, anio: number, startDate?: string, endDate?: string) {
  return useQuery<SinEntidadRow[]>({
    queryKey: ['sin-entidad-diagnostico', mesIdx, anio, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string | number> = { mes_idx: mesIdx, anio };
      if (startDate && endDate) {
        params.start_date = startDate;
        params.end_date = endDate;
      }
      const res = await apiClient.get<SinEntidadRow[]>('/diagnostico/sin-entidad', { params });
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}

export interface SinServicioRow {
  descripcion_raw: string | null;
  cnt: number;
  total: number;
}

export function useSinServicioDiagnostico() {
  return useQuery<SinServicioRow[]>({
    queryKey: ['sin-servicio-diagnostico'],
    queryFn: async () => {
      const res = await apiClient.get<SinServicioRow[]>('/diagnostico/sin-servicio');
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}

export interface CrearEntidadFromRawInput {
  nombre: string;
  tipo: 'EPS' | 'ARL' | 'CONVENIO' | 'PARTICULAR' | 'OTRO';
  nombre_raw: string;
}

export interface CrearEntidadFromRawResult {
  id: string;
  nombre: string;
  tipo: string;
  reassigned: number;
}

export function useCrearEntidadFromRaw(): UseMutationResult<
  CrearEntidadFromRawResult,
  Error,
  CrearEntidadFromRawInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CrearEntidadFromRawInput) => {
      const res = await apiClient.post<CrearEntidadFromRawResult>(
        '/diagnostico/sin-entidad/crear-entidad',
        input
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sin-entidad-diagnostico'] });
      void qc.invalidateQueries({ queryKey: ['entidades'] });
    },
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

// ─── Invalidación ─────────────────────────────────────────────────────────────

/**
 * Claves de todas las consultas que dependen de la tabla de atenciones.
 *
 * Existe porque los paneles se refrescaban de forma dispar: cada consulta tiene
 * su propio temporizador de 10 minutos, así que tras una sincronización unas
 * tarjetas se actualizaban y otras no. Refrescarlas por separado, una a una,
 * garantizaba que alguna se quedara atrás.
 */
export const CLAVES_REPORTES = [
  'kpis', 'entidades', 'cumplimiento-semanal', 'dias-semana', 'tendencia',
  'servicios', 'pacientes', 'utilizacion', 'liquidaciones', 'honorarios',
  'contribucion', 'diagnostico',
  // La agenda cambia con cada sincronización de citas y de consumos.
  'agenda',
  // Un cargue puede estrenar un mes que antes no existía; sin esto el selector
  // seguiría sin ofrecerlo hasta recargar la página.
  'meses-disponibles',
] as const;

/** Marca como obsoleto todo lo que dependa de las atenciones. */
export function invalidarReportes(qc: QueryClient): void {
  for (const clave of CLAVES_REPORTES) {
    void qc.invalidateQueries({ queryKey: [clave] });
  }
}
