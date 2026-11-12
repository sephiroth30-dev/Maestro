import React, { useMemo } from 'react';
import type { EstadoTv } from '../../api/tv.js';
import {
  geometriaGrafico, trazo, valorEntreLecturas, formatoCorto, formatoCOP, textoDelta, signoDelta, enHorarioLaboral, xEnJornada, HORA_INICIO, HORA_FIN,
} from '../../lib/tv.js';

const ANCHO = 1000;
const ALTO = 330;
const M = { izq: 74, der: 24, arr: 14, abajo: 30 };
const AW = ANCHO - M.izq - M.der;
const AH = ALTO - M.arr - M.abajo;

const msDe = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

/**
 * Lo facturado acumulado hoy, como la línea de una acción: un punto por sincronización (real), el día
 * anterior de fondo para comparar y, si se permite, un tramo punteado hasta «ahora» al ritmo del día
 * (estimado, marcado «≈»). La punta pulsa.
 */
export default function GraficoDia({ d, interpolar, ahora }: { d: EstadoTv; interpolar: boolean; ahora: number }): React.ReactElement {
  const enHorario = enHorarioLaboral(ahora);
  const anclaMs = msDe(d.actualizado.consumos);
  const tope = Math.min(d.actualizado.cadencia_consumos_min ?? 30, 60);
  const estimado = interpolar && anclaMs !== null
    ? valorEntreLecturas({ ancla: d.meta.facturado_hoy, anclaMs, ahoraMs: ahora, porHora: d.ritmo.facturado_por_hora, enHorario, topeMin: tope })
    : d.meta.facturado_hoy;

  const g = useMemo(
    () => geometriaGrafico(d.serie.puntos, d.previa?.puntos ?? null, AW, AH, estimado),
    // `estimado` se redondea para no recalcular la geometría en cada décima de segundo
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.serie.puntos, d.previa, Math.round(estimado / 50_000)],
  );

  const ultimo = g.linea[g.linea.length - 1]!;
  const hayPuntos = d.serie.puntos.length > 0;
  const xAhora = xEnJornada(ahora) * AW;
  const yEstimado = AH - (Math.max(0, estimado) / g.max) * AH;
  const hayTramoVivo = interpolar && enHorario && estimado > d.meta.facturado_hoy + 1 && xAhora > ultimo.x;
  const punta = hayTramoVivo ? { x: xAhora, y: yEstimado } : ultimo;

  const area = hayPuntos ? `${trazo(g.linea)} L${ultimo.x.toFixed(1)} ${AH} L0 ${AH} Z` : '';
  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, y: AH - f * AH }));
  const horas = [6, 8, 10, 12, 14, 16, 18, 20];

  const dFact = d.vs_previa && d.vs_previa.facturado !== null ? d.vs_previa.facturado : null;

  return (
    <section className="tv-card tv-grafico" data-testid="tv-grafico">
      <header className="tv-card-t">
        <span>Facturado acumulado hoy</span>
        <span className="tv-grafico-cifra">
          {hayTramoVivo && <span className="tv-aprox-n" title="Estimado al ritmo de hoy; el dato real está en «Facturado hoy»">≈ </span>}{formatoCOP(estimado)}
          {dFact !== null && <em className={`tv-delta tv-delta-${signoDelta(dFact)}`}> {textoDelta(dFact)} vs {d.vs_previa!.fecha.slice(8)}/{d.vs_previa!.fecha.slice(5, 7)}</em>}
        </span>
      </header>
      <svg className="tv-svg" viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label="Facturado acumulado durante el día" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="tv-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2fd47a" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#2fd47a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform={`translate(${M.izq} ${M.arr})`}>
          {ticksY.map((t) => (
            <g key={t.f}>
              <line x1="0" x2={AW} y1={t.y} y2={t.y} className="tv-rejilla" />
              <text x="-10" y={t.y + 4} textAnchor="end" className="tv-eje">{t.f === 0 ? '0' : formatoCorto(g.max * t.f)}</text>
            </g>
          ))}
          {horas.map((h) => {
            const x = ((h - HORA_INICIO) / (HORA_FIN - HORA_INICIO)) * AW;
            return <text key={h} x={x} y={AH + 20} textAnchor="middle" className="tv-eje">{h > 12 ? h - 12 : h}{h < 12 ? 'a' : 'p'}</text>;
          })}

          {g.fantasma.length > 1 && <path d={trazo(g.fantasma)} className="tv-fantasma" fill="none" />}
          {hayPuntos && <path d={area} fill="url(#tv-area)" />}
          {hayPuntos && <path d={trazo(g.linea)} className="tv-linea" fill="none" pathLength={1} />}
          {g.linea.slice(1).map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.4" className="tv-punto-serie" />)}

          {hayTramoVivo && <path d={`M${ultimo.x.toFixed(1)} ${ultimo.y.toFixed(1)} L${xAhora.toFixed(1)} ${yEstimado.toFixed(1)}`} className="tv-tramo-vivo" fill="none" />}
          {enHorario && <line x1={xAhora} x2={xAhora} y1="0" y2={AH} className="tv-linea-ahora" />}
          {(hayPuntos || hayTramoVivo) && (
            <g transform={`translate(${punta.x} ${punta.y})`}>
              <circle r="14" className="tv-halo" />
              <circle r="5.5" className="tv-cabeza" />
            </g>
          )}
        </g>
      </svg>
      <p className="tv-grafico-pie">
        {!hayPuntos
          ? 'La línea se dibuja a medida que se sincroniza: una foto de las cifras en cada sincronización de citas (cada 15 min).'
          : <>
              <span><i className="tv-leyenda tv-leyenda-hoy" /> hoy (un punto por sincronización)</span>
              {d.previa && <span><i className="tv-leyenda tv-leyenda-prev" /> {d.previa.fecha.slice(8)}/{d.previa.fecha.slice(5, 7)}</span>}
              {hayTramoVivo && <span><i className="tv-leyenda tv-leyenda-vivo" /> ≈ al ritmo de hoy, hasta ahora</span>}
              {!d.previa && <span>La comparación con el día anterior aparece desde la segunda jornada.</span>}
            </>}
      </p>
    </section>
  );
}
