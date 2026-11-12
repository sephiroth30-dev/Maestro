import React, { useMemo } from 'react';
import type { EstadoTv, EpsTvApi } from '../../api/tv.js';
import { treemap, colorVariacion, formatoCorto, textoPct, signoDelta } from '../../lib/tv.js';
import { useFlash } from './useFlash.js';

/** Un nombre corto para el cuadro: se quitan los prefijos que no distinguen. */
export function nombreCorto(n: string): string {
  const s = n.replace(/^(EPS|ENTIDAD PROMOTORA DE SALUD|CAJA DE COMPENSACION FAMILIAR)\s+/i, '').replace(/\s+(S\.?A\.?S?\.?)$/i, '').trim();
  return (s.length > 22 ? `${s.slice(0, 21)}…` : s) || n;
}

function Cuadro({ e, x, y, w, h }: { e: EpsTvApi; x: number; y: number; w: number; h: number }): React.ReactElement {
  // Parpadea solo cuando CAMBIA lo facturado real de la EPS (llega con una sincronización).
  const f = useFlash(e.facturado_mes);
  // Cuánto texto cabe se decide por el ALTO y el ANCHO del cuadro (en % del mapa), no por su área: un cuadro
  // largo y delgado tiene área de sobra pero ninguna línea de texto cabe a lo ancho.
  const unaLinea = h >= 8 && w >= 10;
  const dosLineas = h >= 15 && w >= 14;
  const tresLineas = h >= 25 && w >= 16;
  return (
    <div
      className={`tv-cuadro${f ? ` tv-flash-${f}` : ''}`}
      style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, background: colorVariacion(e.variacion_pct) }}
      title={`${e.entidad} · proyectado ${formatoCorto(e.proyectado)} · ${textoPct(e.variacion_pct)} vs su promedio de 3 meses`}
    >
      <div className="tv-cuadro-in">
        {unaLinea && <b>{nombreCorto(e.entidad)}</b>}
        {dosLineas && <span>{formatoCorto(e.proyectado)}</span>}
        {tresLineas && <span className={`tv-delta tv-delta-${signoDelta(e.variacion_pct)}`}>{textoPct(e.variacion_pct)}</span>}
      </div>
    </div>
  );
}

/**
 * Mapa de calor de EPS: el tamaño es lo proyectado (facturado del mes + agendado) y el color, su variación
 * contra su promedio de 3 meses. Gris = sin historial para comparar (no se pinta de verde ni de rojo).
 */
export default function MapaEps({ d }: { d: EstadoTv }): React.ReactElement {
  const cuadros = useMemo(
    // Las 10 mayores: con 15 los cuadros pequeños quedan ilegibles a distancia.
    () => treemap(d.eps.slice(0, 10).map((e) => ({ ...e, peso: e.proyectado })), 100, 100),
    [d.eps],
  );
  return (
    <section className="tv-card tv-mapa" data-testid="tv-mapa">
      <header className="tv-card-t"><span>Mapa de EPS</span><span className="tv-chip">color = vs su promedio</span></header>
      {cuadros.length === 0
        ? <p className="tv-vacio">Aún no hay EPS con facturación o agenda.</p>
        : <div className="tv-tm">{cuadros.map((c) => <Cuadro key={c.id ?? c.entidad} e={c} x={c.x} y={c.y} w={c.w} h={c.h} />)}</div>}
    </section>
  );
}
