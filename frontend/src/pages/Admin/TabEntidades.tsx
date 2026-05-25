import React, { useState } from 'react';
import { Loader2, AlertCircle, Info } from 'lucide-react';
import { useEntidadesCatalog, useUpdateEntidadGrupoCaja } from '../../api/entidades.js';
import type { EntidadCatalogRow } from '../../api/entidades.js';

const TIPO_BADGE_CLASS: Record<string, string> = {
  EPS:        'badge badge--blue',
  PARTICULAR: 'badge badge--green',
  CONVENIO:   'badge badge--purple',
  ARL:        'badge badge--amber',
  OTRO:       'badge badge--gray',
};

function EntidadRow({ entidad }: { entidad: EntidadCatalogRow }): React.ReactElement {
  const update = useUpdateEntidadGrupoCaja();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const value = optimistic ?? entidad.es_grupo_caja;

  async function toggle(): Promise<void> {
    const next = !value;
    setOptimistic(next);
    try {
      await update.mutateAsync({ id: entidad.id, es_grupo_caja: next });
    } catch {
      setOptimistic(null);
    }
    setOptimistic(null);
  }

  return (
    <tr className="tabla-entidades-tr">
      <td className="tabla-entidades-td tabla-entidades-nombre" style={{ fontWeight: 500 }}>
        {entidad.nombre}
      </td>
      <td className="tabla-entidades-td">
        <span className={TIPO_BADGE_CLASS[entidad.tipo] ?? 'badge badge--gray'}>
          {entidad.tipo}
        </span>
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
        <button
          type="button"
          className={`entidad-toggle ${value ? 'entidad-toggle--on' : 'entidad-toggle--off'}`}
          onClick={() => void toggle()}
          disabled={update.isPending}
          title={value ? 'Marcada como Flujo de Caja (excluida de KPIs)' : 'No marcada como Flujo de Caja'}
        >
          {value ? 'Caja' : '—'}
        </button>
      </td>
    </tr>
  );
}

export default function TabEntidades(): React.ReactElement {
  const { data, isLoading, isError } = useEntidadesCatalog();

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
      <div className="entidades-config-banner">
        <Info size={14} />
        <span>
          Las entidades marcadas como <strong>Caja</strong> (PARTICULARES, etc.) se muestran
          en el gráfico de pagadores pero <strong>no suman al total de facturación EPS</strong> ni a los KPIs.
        </span>
      </div>

      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <th className="tabla-entidades-th">Entidad</th>
              <th className="tabla-entidades-th">Tipo</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '110px' }}>
                Flujo de Caja
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <EntidadRow key={e.id} entidad={e} />
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        {data.length} entidades · El catálogo se sincroniza automáticamente en cada reinicio del servidor.
      </p>
    </div>
  );
}
