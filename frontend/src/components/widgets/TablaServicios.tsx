import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ColFilter, useColSort } from '../ColFilter.js';
import type { ServiciosResult, ServicioRow } from '../../api/reportes.js';

interface Props {
  result: ServiciosResult;
  entidadNombre?: string | null;
}

function fmtCOP(v: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(v);
}

function fmtNum(v: number): string {
  return new Intl.NumberFormat('es-CO').format(v);
}

const BAR_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#e11d48',
];

interface ServiceRowProps {
  r: ServicioRow;
  colorIdx: number;
  totalValor: number;
  maxCantidad: number;
  isAlerta: boolean;
}

function ServiceRow({ r, colorIdx, totalValor, maxCantidad, isAlerta }: ServiceRowProps): React.ReactElement {
  const pctValor = totalValor > 0 ? (r.valor_bruto / totalValor) * 100 : 0;
  const pctBar   = maxCantidad > 0 ? (r.cantidad / maxCantidad) * 100 : 0;
  const promedio = r.cantidad > 0 ? r.valor_bruto / r.cantidad : 0;
  const color    = BAR_COLORS[colorIdx % BAR_COLORS.length]!;
  const isSesion = r.tipo_conteo === 'sesion';

  return (
    <tr className={`mix-servicios__row${isAlerta ? ' mix-servicios__row--alerta' : ''}`}>
      <td className="mix-servicios__nombre" title={r.nombre}>
        <span className="mix-servicios__dot" style={{ background: color, marginTop: '2px' }} />
        <span>{r.nombre}</span>
        {isSesion && (
          <span className="mix-servicios__badge" title={`${r.horas ?? 0} registros totales`}>
            {r.horas ?? 0} reg.
          </span>
        )}
      </td>
      <td style={{ textAlign: 'right', fontWeight: 600 }}>
        {fmtNum(r.cantidad)}{isSesion ? ' ses.' : ''}
      </td>
      <td>
        <div className="mix-servicios__bar-track">
          <div className="mix-servicios__bar-fill" style={{ width: `${pctBar}%`, background: color }} />
        </div>
      </td>
      <td style={{ textAlign: 'right' }}>{fmtCOP(r.valor_bruto)}</td>
      <td style={{ textAlign: 'right', color: promedio < 50000 ? '#ef4444' : 'var(--color-text-primary)' }}>
        {fmtCOP(promedio)}
      </td>
      <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
        {pctValor.toFixed(1)}%
      </td>
    </tr>
  );
}

export default function TablaServicios({ result, entidadNombre }: Props): React.ReactElement {
  const { rows, sin_clasificar, valor_sin_clasificar, alerta_emg_neuro, emg_count, neuro_count } = result;

  const totalValor    = rows.reduce((s, r) => s + r.valor_bruto, 0) + valor_sin_clasificar;
  const totalCantidad = rows.reduce((s, r) => s + r.cantidad, 0) + sin_clasificar;

  const { sorted, sortField, sortDir, onSort } = useColSort(rows, (row, field) => {
    if (field === 'nombre')   return row.nombre;
    if (field === 'cantidad') return row.cantidad;
    if (field === 'valor')    return row.valor_bruto;
    if (field === 'promedio') return row.cantidad > 0 ? row.valor_bruto / row.cantidad : 0;
    if (field === 'pct')      return totalValor > 0 ? row.valor_bruto / totalValor : 0;
    return row.valor_bruto;
  });

  // Default sort by valor desc on first render
  const displayed = useMemo(() => {
    if (sortField) return sorted;
    return [...rows].sort((a, b) => b.valor_bruto - a.valor_bruto);
  }, [rows, sorted, sortField]);

  const maxCantidad = displayed.length > 0 ? Math.max(...displayed.map((r) => r.cantidad)) : 1;

  if (rows.length === 0 && sin_clasificar === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
        Sin datos para el período seleccionado.
      </p>
    );
  }

  return (
    <div className="mix-servicios">
      {alerta_emg_neuro && (
        <div className="mix-servicios__alerta">
          <AlertTriangle size={14} />
          <span>
            EMG ({fmtNum(emg_count)}) ≠ Neuroconducción ({fmtNum(neuro_count)}) — verificar registros duplicados o faltantes.
          </span>
        </div>
      )}

      {entidadNombre && (
        <div className="mix-servicios__entidad-badge">
          Servicios prestados a: <strong>{entidadNombre}</strong>
        </div>
      )}

      <div className="mix-servicios__table-wrap" style={{ overflow: 'visible' }}>
        <table className="mix-servicios__table">
          <thead>
            <tr>
              <ColFilter label="Procedimiento" field="nombre"   sortField={sortField} sortDir={sortDir} onSort={onSort} />
              <ColFilter label="Cantidad"       field="cantidad" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" sortLabels={['Menor → Mayor', 'Mayor → Menor']} />
              <th style={{ width: '20%', padding: '6px 12px', fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-gray-50)' }}>Volumen</th>
              <ColFilter label="Valor total"    field="valor"    sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" sortLabels={['Menor → Mayor', 'Mayor → Menor']} />
              <ColFilter label="Promedio"       field="promedio" sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" sortLabels={['Menor → Mayor', 'Mayor → Menor']} />
              <ColFilter label="% Facturación"  field="pct"      sortField={sortField} sortDir={sortDir} onSort={onSort} align="right" sortLabels={['Menor → Mayor', 'Mayor → Menor']} />
            </tr>
          </thead>
          <tbody>
            {displayed.map((r, i) => {
              const isAlerta = alerta_emg_neuro && (
                r.nombre.toUpperCase().includes('ELECTROMIOGRAFIA') ||
                r.nombre.toUpperCase().includes('NEUROCONDUCCION')
              );
              return (
                <ServiceRow
                  key={r.id}
                  r={r}
                  colorIdx={i}
                  totalValor={totalValor}
                  maxCantidad={maxCantidad}
                  isAlerta={isAlerta}
                />
              );
            })}

            {sin_clasificar > 0 && (
              <tr className="mix-servicios__row--sin-clasificar">
                <td className="mix-servicios__nombre" style={{ fontStyle: 'italic' }}>
                  <span className="mix-servicios__dot" style={{ background: '#9ca3af' }} />
                  Sin clasificar
                </td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmtNum(sin_clasificar)}</td>
                <td>
                  <div className="mix-servicios__bar-track">
                    <div className="mix-servicios__bar-fill" style={{ width: `${maxCantidad > 0 ? (sin_clasificar / maxCantidad) * 100 : 0}%`, background: '#9ca3af' }} />
                  </div>
                </td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmtCOP(valor_sin_clasificar)}</td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                  {sin_clasificar > 0 ? fmtCOP(valor_sin_clasificar / sin_clasificar) : '—'}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                  {totalValor > 0 ? ((valor_sin_clasificar / totalValor) * 100).toFixed(1) : '0.0'}%
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ fontWeight: 600 }}>Total</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNum(totalCantidad)}</td>
              <td />
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(totalValor)}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                {totalCantidad > 0 ? fmtCOP(totalValor / totalCantidad) : '—'}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {sin_clasificar > 0 && (
        <p className="mix-servicios__hint">
          {sin_clasificar} registro{sin_clasificar !== 1 ? 's' : ''} sin clasificar — la próxima sincronización los asignará automáticamente.
        </p>
      )}
    </div>
  );
}
