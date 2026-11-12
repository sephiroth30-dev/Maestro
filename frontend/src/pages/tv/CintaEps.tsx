import React, { useMemo } from 'react';
import type { EstadoTv, EpsTvApi } from '../../api/tv.js';
import { formatoCorto, textoPct, signoDelta } from '../../lib/tv.js';
import { nombreCorto } from './MapaEps.js';
import { useFlash } from './useFlash.js';

function Simbolo({ e }: { e: EpsTvApi }): React.ReactElement {
  const f = useFlash(e.facturado_mes);
  return (
    <span className={`tv-sim${f ? ` tv-flash-${f}` : ''}`}>
      <b className="tv-sim-n">{nombreCorto(e.entidad).toUpperCase()}</b>
      <span className="tv-sim-p">{formatoCorto(e.facturado_mes)}</span>
      <span className={`tv-delta tv-delta-${signoDelta(e.variacion_pct)}`}>{textoPct(e.variacion_pct)}</span>
      {e.facturado_hoy > 0 && <span className="tv-sim-h">hoy {formatoCorto(e.facturado_hoy)}</span>}
      {e.agendado_valor > 0 && <span className="tv-sim-a">agenda {formatoCorto(e.agendado_valor)}</span>}
    </span>
  );
}

/**
 * Cinta de EPS como la de una bolsa: facturado del mes, variación del proyectado contra su promedio de
 * 3 meses, lo facturado hoy y lo agendado. Se desplaza sin parar. Los datos cambian solo con cada
 * sincronización: el parpadeo verde/rojo ocurre únicamente cuando entra un cambio real.
 */
export default function CintaEps({ d }: { d: EstadoTv }): React.ReactElement {
  // Cada mitad se repite hasta tener al menos 8 símbolos (con 1 o 2 EPS quedarían huecos) y se duplica:
  // así el desplazamiento es continuo y el salto al reiniciar no se nota.
  const lista = useMemo(() => {
    if (d.eps.length === 0) return [];
    const mitad: EpsTvApi[] = [];
    while (mitad.length < 8) mitad.push(...d.eps);
    return [...mitad, ...mitad];
  }, [d.eps]);
  return (
    <footer className="tv-cinta tv-cinta-eps" data-testid="tv-cinta">
      <span className="tv-cinta-t">EPS</span>
      <div className="tv-cinta-v">
        {d.eps.length === 0
          ? <span className="tv-cinta-i">Sin EPS con facturación o agenda todavía</span>
          : <div className="tv-cinta-pista" style={{ animationDuration: `${Math.max(45, d.eps.length * 9)}s` }}>
              {lista.map((e, i) => <Simbolo key={`${e.id ?? e.entidad}-${i}`} e={e} />)}
            </div>}
      </div>
    </footer>
  );
}
