import React from 'react';
import { CalendarX } from 'lucide-react';
import type { IncumplidasResult } from '../../api/reportes.js';
import { formatNumber } from './KpiCard.js';
import { fechaCorta } from './agenda.js';
import { enHorarioLaboral, horaBogota, HORA_INICIO } from '../../lib/tv.js';

/** Más de esto sin sincronizar, EN HORARIO DE TRABAJO, y se avisa: el conteo ya no crece. */
const HORAS_VIEJO = 2;
/** Al abrir la jornada la primera sincronización tarda un poco (L–S desde las 6:07): no se avisa antes. */
const GRACIA_APERTURA_H = 0.5;

/**
 * ¿Hay que avisar de que lo cargado está viejo? Las citas se sincronizan cada 15 min de lunes a sábado de 6:00 a 19:59
 * (hora de Colombia); fuera de ese horario no hay nada que esperar, así que una lectura de anoche NO es un fallo. Dentro
 * del horario, pasadas dos horas sin sincronizar sí lo es.
 */
export function desactualizado(actualizadoEn: string | null | undefined, ahoraMs: number): boolean {
  if (!actualizadoEn) return false;
  const ultima = Date.parse(actualizadoEn);
  if (!Number.isFinite(ultima)) return false;
  if (!enHorarioLaboral(ahoraMs) || horaBogota(ahoraMs).hora < HORA_INICIO + GRACIA_APERTURA_H) return false;
  return (ahoraMs - ultima) / 3_600_000 > HORAS_VIEJO;
}

/**
 * Qué parte del periodo NO está cargada, dicho con precisión (el principio y el final no son lo mismo): `null` si está
 * completa. «Cargado del X al Y» cuando faltan los dos extremos.
 */
export function avisoCobertura(
  c: { desde: string | null; hasta: string | null; completa: boolean },
  periodo: { desde: string; hasta: string },
): string | null {
  if (c.completa || !c.desde) return null;
  const faltaInicio = c.desde > periodo.desde;
  const faltaFinal = c.hasta !== null && c.hasta < periodo.hasta;
  if (faltaInicio && faltaFinal) return `Cargado del ${fechaCorta(c.desde)} al ${fechaCorta(c.hasta!)}: fuera de ese tramo el conteo puede quedar corto.`;
  if (faltaInicio) return `Cargado desde el ${fechaCorta(c.desde)}: antes de esa fecha el conteo puede quedar corto.`;
  if (c.hasta) return `Cargado hasta el ${fechaCorta(c.hasta)}: faltan los últimos días y el conteo puede quedar corto.`;
  return null;
}

/**
 * Tarjeta de citas INCUMPLIDAS (estado I de Medifolios): las que no se cumplieron, en el periodo y con el filtro
 * aplicado. Una sola cifra, como las demás tarjetas; el desglose por EPS está en la columna «Incumplidas» de la tabla.
 *
 * Cuenta CITAS (por el día de la cita), no facturación. No dice «0» cuando no hay datos: sin sincronizar o con un
 * error se avisa, porque «0 incumplidas» y «no sé» no se pueden ver igual.
 */
export default function KpiIncumplidas({ data, cargando, error, actualizando = false }: {
  data: IncumplidasResult | undefined;
  cargando: boolean;
  error: boolean;
  /** Se muestran las cifras del filtro anterior mientras llegan las del nuevo (`keepPreviousData`). */
  actualizando?: boolean;
}): React.ReactElement {
  const c = data?.cobertura;
  // Sin cobertura (nada cargado) no hay conteo que mostrar, aunque el último intento haya fallado: «0» sería mentira.
  const sinDatos = Boolean(data) && (c?.estado === null || c?.estado === 'nunca' || c?.desde === null);
  // Un periodo ENTERO anterior a lo cargado no tiene conteo: «0» sería mentira (no es que no hubo, es que no se cargó).
  const antesDeLoCargado = Boolean(data && c?.desde && data.periodo.hasta < c.desde);
  const viejo = desactualizado(c?.actualizado_en, Date.now());
  const aviso = data && c ? avisoCobertura(c, data.periodo) : null;

  return (
    <div className="kpi-card kpi-card--rose" data-testid="kpi-incumplidas" aria-busy={actualizando} style={actualizando ? { opacity: 0.6, transition: 'opacity .15s' } : undefined}>
      <div className="kpi-card-header">
        <div className="kpi-card-icon"><CalendarX size={16} /></div>
        <span className="kpi-card-title">Citas Incumplidas</span>
      </div>

      {cargando ? (
        <div className="kpi-card-value">…</div>
      ) : error || !data ? (
        <div className="kpi-card-agenda-aviso" data-testid="incumplidas-error">⚠ No se pudieron cargar las citas incumplidas.</div>
      ) : sinDatos ? (
        <>
          <div className="kpi-card-value">—</div>
          <div className="kpi-card-agenda-aviso" data-testid="incumplidas-sin-sincronizar">
            ⚠ {c?.estado === null
              ? 'La agenda de citas no está activada.'
              : c?.estado === 'error'
                ? 'No se pudieron sincronizar las citas incumplidas (el motivo está en Configuración → Diagnóstico).'
                : 'Aún no se han sincronizado las citas incumplidas.'}
          </div>
        </>
      ) : antesDeLoCargado ? (
        <>
          <div className="kpi-card-value">—</div>
          <div className="kpi-card-agenda-aviso" data-testid="incumplidas-antes">
            ⚠ Este periodo es anterior a lo cargado (desde el {fechaCorta(c!.desde!)}): aún no hay conteo. Los meses anteriores se van cargando de a uno.
          </div>
        </>
      ) : (
        <>
          <div className="kpi-card-value" data-testid="incumplidas-total">{formatNumber(data.total.incumplidas)}</div>
          <div className="kpi-card-periodo" data-testid="incumplidas-sub">citas que no se cumplieron</div>

          {c?.estado === 'error' && (
            <div className="kpi-card-agenda-aviso" title="Se muestra lo último que se cargó bien. El motivo está en Configuración → Diagnóstico.">
              ⚠ La última sincronización falló: puede estar desactualizado.
            </div>
          )}
          {c?.estado !== 'error' && viejo && c?.actualizado_en && (
            <div className="kpi-card-agenda-aviso" data-testid="incumplidas-viejo" title="Las citas incumplidas se sincronizan junto con la agenda (cada 15 minutos, de lunes a sábado en horario de trabajo); si esta se detiene, el conteo deja de crecer.">
              ⚠ Sincronizado hace {Math.round((Date.now() - Date.parse(c.actualizado_en)) / 3_600_000)} h: puede estar desactualizado.
            </div>
          )}
          {aviso && (
            <div
              className="kpi-card-agenda-aviso"
              data-testid="incumplidas-incompleto"
              title="Los meses anteriores se van cargando de a uno por vuelta (cada 15 minutos). Mientras tanto, los periodos más antiguos pueden quedar cortos."
            >
              ⚠ {aviso}
            </div>
          )}
        </>
      )}
    </div>
  );
}
