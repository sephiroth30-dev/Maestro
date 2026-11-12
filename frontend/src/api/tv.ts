import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client.js';

/**
 * Estado de la pantalla de TV. Solo agregados: sin pacientes ni honorarios.
 * El contrato vive en `backend/src/services/tv-estado.ts` (`EstadoTv`); deben coincidir.
 */
export interface MovimientoTvApi {
  tipo: string;
  cantidad: number;
  valor: number | null;
  /** Cuándo se DETECTÓ al sincronizar, no cuándo ocurrió. */
  detectado_en: string | null;
}

export interface CitasPorHoraTv {
  hora: number;
  pendientes: number;
  atendidas: number;
  incumplidas: number;
}

export interface EstadoTv {
  generado_en: string;
  hoy: string;
  version: string;
  reloj: { en_horario: boolean; hora_inicio: number; hora_fin: number };
  meta: {
    mes_idx: number; anio: number;
    presupuesto: number; facturado_mes: number; cumplimiento_pct: number;
    facturado_hoy: number; atenciones_mes: number;
    dias_transcurridos: number; dias_restantes: number;
    proyeccion_ritmo: number;
    agendado_mes: { citas: number; valor: number; citas_sin_valor: number };
    proyectado: number;
  };
  ritmo: { horas_transcurridas: number; facturado_por_hora: number | null; atendidas_por_hora: number | null };
  citas_hoy: {
    atendidas: number; pendientes: number; incumplidas: number; total: number;
    por_hora: CitasPorHoraTv[];
    actualizado_en: string | null;
    es_de_hoy: boolean;
    /** `error` = la última lectura de las citas de hoy falló (ver Diagnóstico); `nunca` = aún no corrió. */
    lectura: 'ok' | 'error' | 'nunca';
  };
  agenda: {
    actualizado_en: string | null;
    horizonte: string | null;
    total: { citas: number; valor: number; citas_sin_valor: number };
    proximos_dias: Array<{ fecha: string; citas: number; valor: number }>;
    top_entidades: Array<{ entidad: string; citas: number; valor: number }>;
  };
  movimientos: MovimientoTvApi[];
  actualizado: { consumos: string | null; citas: string | null; cadencia_consumos_min: number | null };
}

/** Cada cuánto pregunta la pantalla a NUESTRO servidor (no a Medifolios). */
export const TV_REFRESCO_MS = 45_000;

export function useEstadoTv(habilitado = true) {
  return useQuery<EstadoTv>({
    queryKey: ['tv-estado'],
    // Un rol sin acceso no debe ni preguntar (el servidor respondería 403).
    enabled: habilitado,
    queryFn: async () => (await apiClient.get<EstadoTv>('/tv/estado')).data,
    refetchInterval: TV_REFRESCO_MS,
    // Una pantalla de oficina suele quedar tapada o en segundo plano: debe seguir leyendo.
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: 2,
    retryDelay: (n) => Math.min(2_000 * 2 ** n, 15_000),
    // Si una lectura falla, la pantalla conserva la última buena (y avisa), no se vacía.
    gcTime: Infinity,
  });
}
