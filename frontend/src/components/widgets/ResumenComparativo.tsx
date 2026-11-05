import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { EntidadRow, KpisResult } from '../../api/reportes.js';
import { formatCOP, formatNumber } from './KpiCard.js';
import { tipoLabel } from './tipoLabel.js';

export interface PeriodoResumen {
  /** Texto del periodo, p. ej. "Octubre 2026". */
  label: string;
  kpis: KpisResult;
  entidades: EntidadRow[];
}

interface Props {
  actual: PeriodoResumen;
  comparado: PeriodoResumen;
}

const COLOR_ACTUAL = '#2563eb';
const COLOR_COMPARADO = '#a5b4fc';

function variacion(actual: number, base: number): number | null {
  return base === 0 ? null : ((actual - base) / base) * 100;
}

/** Variación con el mismo criterio visual que las tablas: el empate va en gris y sin flecha. */
function Variacion({ actual, base }: { actual: number; base: number }): React.ReactElement {
  const v = variacion(actual, base);
  if (v === null) return <span className="resumen-comp-var resumen-comp-var--igual">—</span>;
  const igual = Math.abs(v) < 0.05;
  const clase = igual ? 'igual' : v > 0 ? 'sube' : 'baja';
  const flecha = igual ? '=' : v > 0 ? '▲' : '▼';
  return (
    <span className={`resumen-comp-var resumen-comp-var--${clase}`}>
      {flecha} {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function sumarPorTipo(rows: EntidadRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.tipo, (m.get(r.tipo) ?? 0) + r.valor_bruto);
  return m;
}

const fmtCorto = (v: number): string =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${v}`;

/**
 * Totales de dos meses frente a frente, con el desglose por tipo de pagador.
 *
 * Existe porque las tarjetas y las tablas dan la variación, pero no dejan ver
 * los dos periodos completos de un vistazo: aquí las cifras absolutas de cada
 * uno son lo principal, y la variación es el complemento.
 */
export default function ResumenComparativo({ actual, comparado }: Props): React.ReactElement {
  const filas = useMemo(() => {
    const a = sumarPorTipo(actual.entidades);
    const c = sumarPorTipo(comparado.entidades);
    const tipos = new Set<string>([...a.keys(), ...c.keys()]);
    return [...tipos]
      .map((t) => ({ tipo: t, nombre: tipoLabel(t), actual: a.get(t) ?? 0, comparado: c.get(t) ?? 0 }))
      .sort((x, y) => Math.max(y.actual, y.comparado) - Math.max(x.actual, x.comparado));
  }, [actual.entidades, comparado.entidades]);

  const metricas: Array<{ titulo: string; a: number; c: number; fmt: (n: number) => string }> = [
    { titulo: 'Facturación bruta', a: actual.kpis.facturacion_bruta, c: comparado.kpis.facturacion_bruta, fmt: formatCOP },
    { titulo: 'Atenciones',        a: actual.kpis.atenciones,        c: comparado.kpis.atenciones,        fmt: formatNumber },
    { titulo: 'Ticket promedio',   a: actual.kpis.ticket_promedio,   c: comparado.kpis.ticket_promedio,   fmt: formatCOP },
  ];

  return (
    <div className="chart-card resumen-comp">
      <h2 className="chart-title">Comparativo de totales</h2>

      <div className="resumen-comp-grid">
        <div />
        <div className="resumen-comp-col" style={{ color: COLOR_ACTUAL }}>{actual.label}</div>
        <div className="resumen-comp-col" style={{ color: '#6366f1' }}>{comparado.label}</div>
        <div className="resumen-comp-col">Variación</div>

        {metricas.map((m) => (
          <React.Fragment key={m.titulo}>
            <div className="resumen-comp-metrica">{m.titulo}</div>
            <div className="resumen-comp-valor">{m.fmt(m.a)}</div>
            <div className="resumen-comp-valor resumen-comp-valor--base">{m.fmt(m.c)}</div>
            <div><Variacion actual={m.a} base={m.c} /></div>
          </React.Fragment>
        ))}
      </div>

      <h3 className="resumen-comp-sub">Por tipo de pagador</h3>
      {filas.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Sin movimiento en ninguno de los dos periodos.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={filas} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#64748b' }} interval={0} />
              <YAxis tickFormatter={fmtCorto} tick={{ fontSize: 11, fill: '#64748b' }} width={60} />
              <Tooltip formatter={(v: number, name: string) => [formatCOP(v), name]} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#64748b' }} />
              {/* El periodo anterior a la izquierda: se lee primero y el actual cierra el par. */}
              <Bar dataKey="comparado" name={comparado.label} fill={COLOR_COMPARADO} radius={[3, 3, 0, 0]} maxBarSize={44} />
              <Bar dataKey="actual" name={actual.label} fill={COLOR_ACTUAL} radius={[3, 3, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>

          <table className="resumen-comp-tabla">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>{actual.label}</th>
                <th>{comparado.label}</th>
                <th>Variación</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.tipo}>
                  <td>{f.nombre}</td>
                  <td>{formatCOP(f.actual)}</td>
                  <td className="resumen-comp-valor--base">{formatCOP(f.comparado)}</td>
                  <td><Variacion actual={f.actual} base={f.comparado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
