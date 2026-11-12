import React from 'react';
import type { EstadoTv } from '../../api/tv.js';
import {
  formatoCOP, formatoCorto, formatoNum, horaTexto, textoDelta, signoDelta, textoPct,
} from '../../lib/tv.js';
import Contador from './Contador.js';
import { useFlash } from './useFlash.js';

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function msDe(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Una celda de la barra de índices: etiqueta, cifra grande, variación y una línea de contexto. */
function Indice({
  etiqueta, flash, children, delta, sub, nota, testid,
}: {
  etiqueta: string;
  flash?: 'sube' | 'baja' | '';
  children: React.ReactNode;
  delta?: { texto: string; signo: ReturnType<typeof signoDelta> } | null;
  sub?: React.ReactNode;
  nota?: React.ReactNode;
  testid: string;
}): React.ReactElement {
  return (
    <div className={`tv-ind${flash ? ` tv-flash-${flash}` : ''}`} data-testid={testid}>
      <span className="tv-ind-etq">{etiqueta}{nota}</span>
      <div className="tv-ind-num">{children}</div>
      {delta && <div className={`tv-delta tv-delta-${delta.signo}`}>{delta.texto}</div>}
      <div className="tv-ind-sub">{sub}</div>
    </div>
  );
}

/** Barra de índices, como la de arriba de una pantalla de bolsa. */
export default function Indices({ d, interpolar, enHorario }: { d: EstadoTv; interpolar: boolean; enHorario: boolean }): React.ReactElement {
  const m = d.meta;
  const c = d.citas_hoy;
  // Sin presupuesto cargado no hay % de meta: se dice «—», no 0 % ni «▼ −100 %».
  const hayMeta = m.presupuesto > 0;
  const pct = hayMeta ? (m.facturado_mes / m.presupuesto) * 100 : 0;
  const pctProy = hayMeta ? (m.proyectado / m.presupuesto) * 100 : 0;
  const anclaConsumos = msDe(d.actualizado.consumos);
  const tope = Math.min(d.actualizado.cadencia_consumos_min ?? 30, 60);
  const ritmoFact = d.ritmo.facturado_por_hora;
  const estimandoFact = interpolar && enHorario && ritmoFact !== null && ritmoFact > 0 && anclaConsumos !== null;
  const ritmoAt = d.ritmo.atendidas_por_hora;
  const estimandoAt = interpolar && enHorario && ritmoAt !== null && ritmoAt > 0 && msDe(c.actualizado_en) !== null;

  // El parpadeo verde/rojo solo con datos REALES, nunca con la estimación.
  const fFact = useFlash(m.facturado_hoy);
  const fAt = useFlash(c.atendidas);
  const fMeta = useFlash(m.facturado_mes);

  const vs = d.vs_previa;
  const fechaVs = vs ? `${vs.fecha.slice(8)}/${vs.fecha.slice(5, 7)}` : '';
  const etqVs = !vs ? 'sin día anterior todavía'
    : vs.facturado === null ? `el ${fechaVs} aún no tenía dato a esta hora`
    : `vs ${fechaVs} a esta hora`;
  const dFact = vs && vs.facturado !== null ? { texto: textoDelta(vs.facturado), signo: signoDelta(vs.facturado) } : null;
  // Las atendidas de hoy solo se comparan si ya se leyeron las citas de hoy (si no, «0 atendidas» daría «▼ −7» falso).
  const dAt = vs && vs.atendidas !== null && c.es_de_hoy ? { texto: textoDelta(vs.atendidas, formatoNum), signo: signoDelta(vs.atendidas) } : null;

  return (
    <section className="tv-indices" data-testid="tv-indices">
      <Indice testid="tv-hoy" etiqueta="Facturado hoy" flash={fFact}
        nota={estimandoFact ? <i className="tv-aprox" title="Avanza al ritmo de hoy entre lecturas">≈</i> : null}
        delta={dFact}
        sub={<>{etqVs} · real {formatoCorto(m.facturado_hoy)} {horaTexto(d.actualizado.consumos)}</>}>
        <Contador className="tv-cifra" valor={m.facturado_hoy} anclaMs={anclaConsumos} porHora={ritmoFact} enHorario={enHorario}
          topeMin={tope} interpolar={interpolar} formato={formatoCOP} />
      </Indice>

      <Indice testid="tv-atendidas" etiqueta="Citas atendidas" flash={fAt}
        nota={estimandoAt ? <i className="tv-aprox" title="Avanza al ritmo de hoy entre lecturas">≈</i> : null}
        delta={dAt}
        sub={<>{formatoNum(c.pendientes)} pendientes · {formatoNum(c.incumplidas)} incumplidas · {formatoNum(c.total)} hoy</>}>
        <Contador className="tv-cifra" valor={c.atendidas} anclaMs={msDe(c.actualizado_en)} porHora={ritmoAt} enHorario={enHorario}
          topeMin={15} interpolar={interpolar} formato={formatoNum} entero />
      </Indice>

      <Indice testid="tv-meta" etiqueta={`Meta de ${MESES[m.mes_idx]}`} flash={fMeta}
        sub={hayMeta
          ? <>{formatoCorto(m.facturado_mes)} de {formatoCorto(m.presupuesto)} · {m.dias_restantes} días hábiles</>
          : <>sin presupuesto cargado para este mes</>}>
        <b className="tv-cifra tv-azul">{hayMeta ? `${pct.toFixed(1).replace('.', ',')} %` : '—'}</b>
        <div className="tv-mini"><i style={{ width: `${hayMeta ? Math.min(pct, 100) : 0}%` }} /></div>
      </Indice>

      <Indice testid="tv-proyectado" etiqueta="Proyectado (techo)"
        delta={hayMeta ? { texto: textoPct(pctProy - 100), signo: pctProy >= 100 ? 'sube' : 'baja' } : null}
        sub={<>atendido + agendado · no descuenta a quienes no llegan</>}>
        <b className="tv-cifra">{formatoCorto(m.proyectado)}</b>
      </Indice>

      <Indice testid="tv-agendado" etiqueta="Agenda pendiente del mes"
        sub={<>por ritmo {formatoCorto(m.proyeccion_ritmo)}{m.agendado_mes.citas_sin_valor > 0 ? ` · ${formatoNum(m.agendado_mes.citas_sin_valor)} sin precio` : ''}</>}>
        <b className="tv-cifra tv-violeta">{formatoCorto(m.agendado_mes.valor)}</b>
        <span className="tv-ind-aux">{formatoNum(m.agendado_mes.citas)} citas</span>
      </Indice>
    </section>
  );
}
