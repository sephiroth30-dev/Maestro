import React, { useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
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

// ─── Category group row ───────────────────────────────────────────────────────

interface GroupHeaderProps {
  categoria: string;
  rows: ServicioRow[];
  totalValor: number;
  colorBase: string;
  expanded: boolean;
  onToggle: () => void;
}

function GroupHeader({ categoria, rows, totalValor, colorBase, expanded, onToggle }: GroupHeaderProps): React.ReactElement {
  const groupValor = rows.reduce((s, r) => s + r.valor_bruto, 0);
  const groupCantidad = rows.reduce((s, r) => s + r.cantidad, 0);
  const pct = totalValor > 0 ? (groupValor / totalValor) * 100 : 0;

  return (
    <tr className="svc-group-header" onClick={onToggle}>
      <td colSpan={2}>
        <div className="svc-group-header-inner">
          <span className="svc-group-chevron">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
          <span className="svc-group-dot" style={{ background: colorBase }} />
          <span className="svc-group-nombre">{categoria}</span>
          <span className="svc-group-count">{rows.length} proc.</span>
        </div>
      </td>
      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNum(groupCantidad)}</td>
      <td />
      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCOP(groupValor)}</td>
      <td style={{ textAlign: 'right', color: '#64748b', fontWeight: 500 }}>{pct.toFixed(1)}%</td>
      <td />
    </tr>
  );
}

// ─── Service row ──────────────────────────────────────────────────────────────

interface ServiceRowProps {
  r: ServicioRow;
  colorIdx: number;
  totalValor: number;
  maxCantidad: number;
  isAlerta: boolean;
  isChild: boolean;
}

function ServiceRow({ r, colorIdx, totalValor, maxCantidad, isAlerta, isChild }: ServiceRowProps): React.ReactElement {
  const pctValor = totalValor > 0 ? (r.valor_bruto / totalValor) * 100 : 0;
  const pctBar   = maxCantidad > 0 ? (r.cantidad / maxCantidad) * 100 : 0;
  const promedio = r.cantidad > 0 ? r.valor_bruto / r.cantidad : 0;
  const color    = BAR_COLORS[colorIdx % BAR_COLORS.length]!;
  const isSesion = r.tipo_conteo === 'sesion';

  return (
    <tr className={`mix-servicios__row${isAlerta ? ' mix-servicios__row--alerta' : ''}${isChild ? ' mix-servicios__row--child' : ''}`}>
      <td className="mix-servicios__nombre">
        <span className="mix-servicios__dot" style={{ background: color }} />
        {r.nombre}
        {isSesion && (
          <span className="mix-servicios__badge" title={`${r.horas ?? 0} registros totales`}>
            {r.horas ?? 0} reg.
          </span>
        )}
      </td>
      <td className="mix-servicios__cat-cell">
        {r.categoria && <span className="mix-servicios__cat-tag">{r.categoria}</span>}
      </td>
      <td style={{ textAlign: 'right', fontWeight: 600 }}>
        {fmtNum(r.cantidad)}{isSesion ? ' ses.' : ''}
      </td>
      <td>
        <div className="mix-servicios__bar-track">
          <div
            className="mix-servicios__bar-fill"
            style={{ width: `${pctBar}%`, background: color }}
          />
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function TablaServicios({ result, entidadNombre }: Props): React.ReactElement {
  const { rows, sin_clasificar, valor_sin_clasificar, alerta_emg_neuro, emg_count, neuro_count } = result;

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Derive sorted rows and categories
  const sorted = useMemo(() => [...rows].sort((a, b) => b.valor_bruto - a.valor_bruto), [rows]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    sorted.forEach((r) => { if (r.categoria) cats.add(r.categoria); });
    return ['Todas', ...Array.from(cats).sort(), ...(sorted.some((r) => !r.categoria) ? ['Sin categoría'] : [])];
  }, [sorted]);

  const showAll = categories.length <= 2; // Only one real cat → don't show filter bar

  // Group rows by category
  const groups = useMemo<Array<{ categoria: string; rows: ServicioRow[] }>>(() => {
    const catMap = new Map<string, ServicioRow[]>();
    for (const r of sorted) {
      const cat = r.categoria ?? 'Sin categoría';
      if (!catMap.has(cat)) catMap.set(cat, []);
      catMap.get(cat)!.push(r);
    }
    return Array.from(catMap.entries()).map(([categoria, catRows]) => ({ categoria, rows: catRows }));
  }, [sorted]);

  const filteredRows = useMemo(() => {
    if (!selectedCat || selectedCat === 'Todas') return sorted;
    if (selectedCat === 'Sin categoría') return sorted.filter((r) => !r.categoria);
    return sorted.filter((r) => r.categoria === selectedCat);
  }, [sorted, selectedCat]);

  const totalValor    = rows.reduce((s, r) => s + r.valor_bruto, 0) + valor_sin_clasificar;
  const totalCantidad = rows.reduce((s, r) => s + r.cantidad, 0) + sin_clasificar;
  const maxCantidad   = sorted.length > 0 ? sorted[0]!.cantidad : 1;

  function toggleGroup(cat: string): void {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (rows.length === 0 && sin_clasificar === 0) {
    return (
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
        Sin datos para el período seleccionado.
      </p>
    );
  }

  const isGrouped = !selectedCat || selectedCat === 'Todas';

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

      {/* Category filter chips */}
      {!showAll && (
        <div className="svc-filter-bar">
          {categories.map((cat) => {
            const isActive = (!selectedCat && cat === 'Todas') || selectedCat === cat;
            const count = cat === 'Todas'
              ? sorted.length
              : cat === 'Sin categoría'
              ? sorted.filter((r) => !r.categoria).length
              : sorted.filter((r) => r.categoria === cat).length;
            return (
              <button
                key={cat}
                type="button"
                className={`svc-filter-chip${isActive ? ' svc-filter-chip--active' : ''}`}
                onClick={() => setSelectedCat(isActive && cat !== 'Todas' ? null : cat === 'Todas' ? null : cat)}
              >
                {cat}
                <span className="svc-filter-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mix-servicios__table-wrap">
        <table className="mix-servicios__table">
          <thead>
            <tr>
              <th>Procedimiento</th>
              <th style={{ width: '110px' }}>Categoría</th>
              <th style={{ textAlign: 'right' }}>Cantidad</th>
              <th style={{ width: '20%' }}>Volumen</th>
              <th style={{ textAlign: 'right' }}>Valor total</th>
              <th style={{ textAlign: 'right' }}>Promedio</th>
              <th style={{ textAlign: 'right' }}>% facturación</th>
            </tr>
          </thead>
          <tbody>
            {isGrouped ? (
              // Grouped view — show category headers with collapse
              groups.map((group, gi) => {
                const expanded = !collapsedGroups.has(group.categoria);
                const colorBase = BAR_COLORS[gi % BAR_COLORS.length]!;
                return (
                  <React.Fragment key={group.categoria}>
                    <GroupHeader
                      categoria={group.categoria}
                      rows={group.rows}
                      totalValor={totalValor}
                      colorBase={colorBase}
                      expanded={expanded}
                      onToggle={() => toggleGroup(group.categoria)}
                    />
                    {expanded && group.rows.map((r, ri) => {
                      const isAlerta = alerta_emg_neuro && (
                        r.nombre.toUpperCase().includes('ELECTROMIOGRAFIA') ||
                        r.nombre.toUpperCase().includes('NEUROCONDUCCION')
                      );
                      return (
                        <ServiceRow
                          key={r.id}
                          r={r}
                          colorIdx={gi * 10 + ri}
                          totalValor={totalValor}
                          maxCantidad={maxCantidad}
                          isAlerta={isAlerta}
                          isChild
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })
            ) : (
              // Flat filtered view
              filteredRows.map((r, i) => {
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
                    isChild={false}
                  />
                );
              })
            )}

            {/* Sin clasificar — always visible at bottom */}
            {sin_clasificar > 0 && (
              <tr className="mix-servicios__row--sin-clasificar">
                <td className="mix-servicios__nombre" style={{ fontStyle: 'italic' }}>
                  <span className="mix-servicios__dot" style={{ background: '#9ca3af' }} />
                  Sin clasificar
                </td>
                <td />
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmtNum(sin_clasificar)}</td>
                <td>
                  <div className="mix-servicios__bar-track">
                    <div
                      className="mix-servicios__bar-fill"
                      style={{ width: `${maxCantidad > 0 ? (sin_clasificar / maxCantidad) * 100 : 0}%`, background: '#9ca3af' }}
                    />
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
              <td style={{ fontWeight: 600 }} colSpan={2}>Total</td>
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
