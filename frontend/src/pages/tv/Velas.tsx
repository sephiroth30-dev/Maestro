import React, { useMemo } from 'react';
import type { EstadoTv } from '../../api/tv.js';
import { velasDelMes, formatoCorto, DIAS_CORTOS, type Vela } from '../../lib/tv.js';

/** Clase de la barra de una vela. (Distinta de la de la columna: antes `tv-vela-hoy` pintaba la columna entera.) */
function claseBarra(x: Vela): string {
  if (x.estado === 'hoy') return 'tv-vb tv-vb-hoy';
  if (x.estado === 'futura' || x.sinDato) return 'tv-vb tv-vb-vacia';
  if (x.nivel === 'ok') return 'tv-vb tv-vb-ok';
  if (x.nivel === 'medio') return 'tv-vb tv-vb-medio';
  if (x.nivel === 'bajo') return 'tv-vb tv-vb-no';
  return 'tv-vb tv-vb-neutra';   // sábado, o sin meta cargada
}

/**
 * Velas diarias del mes: una barra por día, verde si alcanzó la meta diaria (presupuesto ÷ días hábiles)
 * y roja si no. El sábado va neutro (la meta es de lunes a viernes), hoy está en curso, los días que
 * faltan —y los pasados sin ningún dato— quedan vacíos. Sin presupuesto cargado no se juzga ningún día.
 */
export default function Velas({ d }: { d: EstadoTv }): React.ReactElement {
  const v = useMemo(() => velasDelMes(d.hoy, d.dias_mes.dias, d.dias_mes.meta_dia), [d.hoy, d.dias_mes]);
  const meta = d.dias_mes.meta_dia;
  const hayMeta = meta > 0;
  const tope = Math.max(hayMeta ? meta * 1.3 : 0, ...v.map((x) => x.facturado), 1);
  const juzgables = v.filter((x) => x.juzgable);
  const cumplen = juzgables.filter((x) => x.cumple).length;

  return (
    <section className="tv-card tv-velas" data-testid="tv-velas">
      <header className="tv-card-t">
        <span>Velas diarias · {d.hoy.slice(0, 7)}</span>
        <span className="tv-chip">
          {hayMeta ? `${cumplen} de ${juzgables.length} días en meta` : 'sin meta cargada'}
        </span>
      </header>
      <div className="tv-velas-cuerpo">
        {/* La línea de meta vive DENTRO del área de las barras: así su altura es la de una barra igual a la meta. */}
        <div className="tv-velas-barras">
          {hayMeta && <div className="tv-meta-dia" style={{ bottom: `${(meta / tope) * 100}%` }}><span>meta {formatoCorto(meta)}</span></div>}
          {v.map((x) => (
            <div key={x.fecha} className={`tv-vela tv-vela-${x.estado}`} data-estado={x.estado}>
              <div className="tv-vela-col">
                <i
                  className={claseBarra(x)}
                  style={{ height: `${Math.max((x.facturado / tope) * 100, x.estado === 'futura' || x.sinDato ? 2 : 1)}%` }}
                  title={x.sinDato ? `${DIAS_CORTOS[x.diaSemana]} ${x.dia}: sin datos` : `${DIAS_CORTOS[x.diaSemana]} ${x.dia}: ${formatoCorto(x.facturado)}`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="tv-velas-dias">
          {/* Solo algunas etiquetas (lunes, hoy y el primer día): 25 números juntos no se leen a distancia. */}
          {v.map((x, i) => (
            <span key={x.fecha} className={x.estado === 'hoy' ? 'tv-vela-d tv-vela-d-hoy' : 'tv-vela-d'}>
              {x.estado === 'hoy' || x.diaSemana === 1 || i === 0 ? x.dia : ''}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
