import React, { useState, useMemo, useCallback } from 'react';
import { Loader2, AlertCircle, Info, Lock, ChevronDown, CheckSquare, Square } from 'lucide-react';
import {
  useEntidadesCatalog,
  useUpdateEntidadGrupoCaja,
  useUpdateEntidadTipo,
  useBulkUpdateEntidades,
  TIPOS_ENTIDAD,
  type TipoEntidad,
} from '../../api/entidades.js';
import type { EntidadCatalogRow } from '../../api/entidades.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_SIEMPRE_CAJA = new Set<string>(['PARTICULAR']);

// ─── Tipo select ──────────────────────────────────────────────────────────────

function EntidadTipoSelect({ entidad }: { entidad: EntidadCatalogRow }): React.ReactElement {
  const updateTipo = useUpdateEntidadTipo();
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const current = (optimistic ?? entidad.tipo) as TipoEntidad;

  async function handleChange(next: TipoEntidad): Promise<void> {
    if (next === current) return;
    setOptimistic(next);
    try {
      await updateTipo.mutateAsync({
        id: entidad.id,
        tipo: next,
        ...(next === 'PARTICULAR' ? { es_grupo_caja: true } : {}),
      });
    } catch {
      setOptimistic(null);
      return;
    }
    setOptimistic(null);
  }

  return (
    <div className="entidad-tipo-wrapper">
      <select
        value={current}
        onChange={(e) => void handleChange(e.target.value as TipoEntidad)}
        disabled={updateTipo.isPending}
        className={`entidad-tipo-select entidad-tipo-select--${current.toLowerCase()}`}
        title="Cambiar tipo"
      >
        {TIPOS_ENTIDAD.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <ChevronDown size={10} className="entidad-tipo-chevron" />
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface EntidadRowProps {
  entidad: EntidadCatalogRow;
  isSelected: boolean;
  onToggle: () => void;
}

function EntidadRow({ entidad, isSelected, onToggle }: EntidadRowProps): React.ReactElement {
  const update = useUpdateEntidadGrupoCaja();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);

  const esSiempreCaja = TIPO_SIEMPRE_CAJA.has(entidad.tipo);
  const value = esSiempreCaja ? true : (optimistic ?? entidad.es_grupo_caja);

  async function toggle(): Promise<void> {
    if (esSiempreCaja) return;
    const next = !value;
    setOptimistic(next);
    try {
      await update.mutateAsync({ id: entidad.id, es_grupo_caja: next });
    } catch {
      setOptimistic(null);
      return;
    }
    setOptimistic(null);
  }

  return (
    <tr className={`tabla-entidades-tr${value ? ' entidad-row--caja' : ''}${isSelected ? ' entidad-row--selected' : ''}`}>
      <td className="tabla-entidades-td tabla-entidades-td--check">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          className="entidad-checkbox"
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className="tabla-entidades-td" style={{ fontWeight: 500 }}>
        {entidad.nombre}
      </td>
      <td className="tabla-entidades-td">
        <EntidadTipoSelect entidad={entidad} />
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
        {esSiempreCaja ? (
          <span className="entidad-toggle-fixed" title="Los Particulares siempre son flujo de caja">
            <Lock size={11} style={{ opacity: 0.5 }} />
            Siempre
          </span>
        ) : (
          <button
            type="button"
            className={`entidad-toggle ${value ? 'entidad-toggle--on' : 'entidad-toggle--off'}`}
            onClick={() => void toggle()}
            disabled={update.isPending}
            title={value ? 'Flujo de caja' : 'Cobro a entidades'}
          >
            {update.isPending ? '…' : value ? 'Flujo de caja' : 'Cobro'}
          </button>
        )}
      </td>
      <td className="tabla-entidades-td tabla-entidades-td--impacto">
        {value ? 'Suma al flujo de caja' : 'Suma al cobro a entidades'}
      </td>
    </tr>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

interface BulkBarProps {
  count: number;
  onSetTipo: (tipo: TipoEntidad) => void;
  onSetCaja: (caja: boolean) => void;
  onClear: () => void;
  isPending: boolean;
}

function BulkActionBar({ count, onSetTipo, onSetCaja, onClear, isPending }: BulkBarProps): React.ReactElement {
  const [bulkTipo, setBulkTipo] = useState<TipoEntidad | ''>('');

  function handleApplyTipo(): void {
    if (!bulkTipo) return;
    onSetTipo(bulkTipo as TipoEntidad);
    setBulkTipo('');
  }

  return (
    <div className="bulk-action-bar">
      <span className="bulk-action-count">
        <CheckSquare size={14} />
        {count} {count === 1 ? 'entidad' : 'entidades'} seleccionada{count !== 1 ? 's' : ''}
      </span>

      <div className="bulk-action-group">
        <span className="bulk-action-label">Tipo:</span>
        <select
          value={bulkTipo}
          onChange={(e) => setBulkTipo(e.target.value as TipoEntidad | '')}
          className="bulk-tipo-select"
          disabled={isPending}
        >
          <option value="">Seleccionar…</option>
          {TIPOS_ENTIDAD.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          type="button"
          className="bulk-action-btn bulk-action-btn--primary"
          onClick={handleApplyTipo}
          disabled={!bulkTipo || isPending}
        >
          Aplicar
        </button>
      </div>

      <div className="bulk-action-group">
        <span className="bulk-action-label">Clasificación:</span>
        <button
          type="button"
          className="bulk-action-btn bulk-action-btn--caja"
          onClick={() => onSetCaja(true)}
          disabled={isPending}
        >
          Flujo de caja
        </button>
        <button
          type="button"
          className="bulk-action-btn bulk-action-btn--cobro"
          onClick={() => onSetCaja(false)}
          disabled={isPending}
        >
          Cobro
        </button>
      </div>

      <button
        type="button"
        className="bulk-action-btn bulk-action-btn--clear"
        onClick={onClear}
        disabled={isPending}
      >
        {isPending ? <Loader2 size={12} className="spin" /> : <Square size={12} />}
        {isPending ? 'Guardando…' : 'Limpiar'}
      </button>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

const TIPOS_ORDEN = ['EPS', 'CONVENIO', 'ARL', 'PARTICULAR', 'OTRO'];

export default function TabEntidades(): React.ReactElement {
  const { data, isLoading, isError } = useEntidadesCatalog();
  const bulkUpdate = useBulkUpdateEntidades();

  const [filterTipo, setFilterTipo] = useState<string>('Todas');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const tiposDisponibles = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.map((e) => e.tipo));
    return ['Todas', ...TIPOS_ORDEN.filter((t) => set.has(t))];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterTipo === 'Todas' ? data : data.filter((e) => e.tipo === filterTipo);
  }, [data, filterTipo]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, caja: 0 };
    const subset = filterTipo === 'Todas' ? data : data.filter((e) => e.tipo === filterTipo);
    return {
      total: subset.length,
      caja: subset.filter((e) => e.es_grupo_caja || TIPO_SIEMPRE_CAJA.has(e.tipo)).length,
    };
  }, [data, filterTipo]);

  const allVisibleIds = filtered.map((e) => e.id);
  const allSelected   = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected  = allVisibleIds.some((id) => selectedIds.has(id));

  function toggleSelectAll(): void {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...allVisibleIds]));
    }
  }

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function clearSelection(): void {
    setSelectedIds(new Set());
  }

  async function handleBulkSetTipo(tipo: TipoEntidad): Promise<void> {
    const ids = [...selectedIds];
    const items = ids.map((id) => ({
      id,
      tipo,
      ...(tipo === 'PARTICULAR' ? { es_grupo_caja: true } : {}),
    }));
    await bulkUpdate.mutateAsync(items);
    clearSelection();
  }

  async function handleBulkSetCaja(caja: boolean): Promise<void> {
    const ids = [...selectedIds].filter((id) => {
      const e = data?.find((r) => r.id === id);
      return e && !TIPO_SIEMPRE_CAJA.has(e.tipo);
    });
    if (ids.length === 0) return;
    const items = ids.map((id) => ({ id, es_grupo_caja: caja }));
    await bulkUpdate.mutateAsync(items);
    clearSelection();
  }

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando entidades…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar el catálogo de entidades.
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: someSelected ? '72px' : 0, transition: 'padding-bottom 0.2s' }}>
      {/* Banner */}
      <div className="entidades-config-banner">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          Selecciona una o varias filas para hacer cambios masivos de <strong>Tipo</strong> o <strong>Clasificación</strong>.{' '}
          Para editar una sola entidad, usa el selector de Tipo o el botón de Clasificación directamente en la fila.
          Los cambios de Tipo persisten entre reinicios del servidor.
        </span>
      </div>

      {/* Filtros por tipo */}
      <div className="entidades-filter-bar">
        {tiposDisponibles.map((tipo) => {
          const count = tipo === 'Todas' ? data.length : data.filter((e) => e.tipo === tipo).length;
          return (
            <button
              key={tipo}
              type="button"
              className={`entidades-filter-btn${filterTipo === tipo ? ' entidades-filter-btn--active' : ''}`}
              onClick={() => { setFilterTipo(tipo); clearSelection(); }}
            >
              {tipo}
              <span className="entidades-filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Stats */}
      <p className="entidades-stats">
        {stats.total} entidades
        {' · '}
        <strong style={{ color: '#10b981' }}>{stats.caja}</strong> flujo de caja
        {' · '}
        <strong style={{ color: '#3b82f6' }}>{stats.total - stats.caja}</strong> cobro a entidades
        {someSelected && (
          <span style={{ color: '#6d28d9', marginLeft: 8 }}>
            · <strong>{selectedIds.size}</strong> seleccionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
        )}
      </p>

      {/* Tabla */}
      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <th className="tabla-entidades-th tabla-entidades-th--check">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                  onChange={toggleSelectAll}
                  className="entidad-checkbox"
                  title={allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
                />
              </th>
              <th className="tabla-entidades-th">Entidad</th>
              <th className="tabla-entidades-th">Tipo</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '130px' }}>
                Clasificación
              </th>
              <th className="tabla-entidades-th tabla-entidades-th--impacto">
                Impacto en el Mix
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <EntidadRow
                key={e.id}
                entidad={e}
                isSelected={selectedIds.has(e.id)}
                onToggle={() => toggleRow(e.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        {data.length} entidades en total · Cambios de Tipo permanecen entre reinicios · Clasificación (flujo/cobro) se puede resetear desde la semilla del servidor
      </p>

      {/* Bulk action bar — sticky bottom */}
      {someSelected && (
        <BulkActionBar
          count={selectedIds.size}
          onSetTipo={(t) => void handleBulkSetTipo(t)}
          onSetCaja={(c) => void handleBulkSetCaja(c)}
          onClear={clearSelection}
          isPending={bulkUpdate.isPending}
        />
      )}
    </div>
  );
}
