import React, { useState, useMemo } from 'react';
import { Loader2, AlertCircle, Info, Lock } from 'lucide-react';
import { useEntidadesCatalog, useUpdateEntidadGrupoCaja } from '../../api/entidades.js';
import type { EntidadCatalogRow } from '../../api/entidades.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPO_BADGE_CLASS: Record<string, string> = {
  EPS:        'badge badge--blue',
  PARTICULAR: 'badge badge--green',
  CONVENIO:   'badge badge--purple',
  ARL:        'badge badge--amber',
  OTRO:       'badge badge--gray',
};

// PARTICULAREs siempre son flujo de caja — el toggle no tiene sentido para ellos
const TIPO_SIEMPRE_CAJA = new Set(['PARTICULAR']);

// ─── Row ─────────────────────────────────────────────────────────────────────

function EntidadRow({ entidad }: { entidad: EntidadCatalogRow }): React.ReactElement {
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
    <tr className={`tabla-entidades-tr${value ? ' entidad-row--caja' : ''}`}>
      <td className="tabla-entidades-td" style={{ fontWeight: 500 }}>
        {entidad.nombre}
      </td>
      <td className="tabla-entidades-td">
        <span className={TIPO_BADGE_CLASS[entidad.tipo] ?? 'badge badge--gray'}>
          {entidad.tipo}
        </span>
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
            title={value ? 'Flujo de caja — paga al momento de la atención' : 'Cobro a entidades — facturación y cartera'}
          >
            {update.isPending ? '…' : value ? 'Flujo de caja' : 'Cobro'}
          </button>
        )}
      </td>
      <td className="tabla-entidades-td" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
        {value ? 'Suma al flujo de caja' : 'Suma al cobro a entidades'}
      </td>
    </tr>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

const TIPOS_ORDEN = ['EPS', 'CONVENIO', 'ARL', 'PARTICULAR', 'OTRO'];

export default function TabEntidades(): React.ReactElement {
  const { data, isLoading, isError } = useEntidadesCatalog();
  const [filterTipo, setFilterTipo] = useState<string>('Todas');

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
    <div>
      {/* Banner explicativo */}
      <div className="entidades-config-banner">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          Marca cada entidad según cómo cobra:{' '}
          <strong>Flujo de caja</strong> = paga al momento de la atención (particulares, convenios contado).{' '}
          <strong>Cobro a entidades</strong> = facturación y cartera (EPS, ARL, convenios con plazo).
          Esta clasificación afecta el <em>Mix de Pagadores</em> en el Dashboard y Reportes.
        </span>
      </div>

      {/* Filtros por tipo */}
      <div className="entidades-filter-bar">
        {tiposDisponibles.map((tipo) => {
          const count = tipo === 'Todas'
            ? data.length
            : data.filter((e) => e.tipo === tipo).length;
          return (
            <button
              key={tipo}
              type="button"
              className={`entidades-filter-btn${filterTipo === tipo ? ' entidades-filter-btn--active' : ''}`}
              onClick={() => setFilterTipo(tipo)}
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
      </p>

      {/* Tabla */}
      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <th className="tabla-entidades-th">Entidad</th>
              <th className="tabla-entidades-th">Tipo</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '130px' }}>
                Clasificación
              </th>
              <th className="tabla-entidades-th" style={{ width: '180px' }}>
                Impacto en el Mix
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <EntidadRow key={e.id} entidad={e} />
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        {data.length} entidades en total · El catálogo se sincroniza al reiniciar el servidor.
      </p>
    </div>
  );
}
