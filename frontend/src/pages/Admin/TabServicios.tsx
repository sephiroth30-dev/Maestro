import React, { useState } from 'react';
import { Loader2, AlertCircle, Info, Repeat2, Hash } from 'lucide-react';
import { useServiciosCatalog, useUpdateServicioTipoConteo } from '../../api/servicios.js';
import type { ServicioCatalogRow } from '../../api/servicios.js';

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

// ─── Row ─────────────────────────────────────────────────────────────────────

function ServicioRow({ s }: { s: ServicioCatalogRow }): React.ReactElement {
  const update = useUpdateServicioTipoConteo();
  const [optimistic, setOptimistic] = useState<'unidad' | 'sesion' | null>(null);
  const current = optimistic ?? s.tipo_conteo;

  async function toggle(): Promise<void> {
    const next: 'unidad' | 'sesion' = current === 'sesion' ? 'unidad' : 'sesion';
    setOptimistic(next);
    try {
      await update.mutateAsync({ id: s.id, tipo_conteo: next });
    } catch {
      setOptimistic(null);
      return;
    }
    setOptimistic(null);
  }

  const isSesion = current === 'sesion';

  return (
    <tr className="tabla-entidades-tr">
      <td className="tabla-entidades-td" style={{ fontWeight: 500 }}>
        {s.nombre}
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
        <button
          type="button"
          className={`svc-conteo-toggle ${isSesion ? 'svc-conteo-toggle--sesion' : 'svc-conteo-toggle--unidad'}`}
          onClick={() => void toggle()}
          disabled={update.isPending}
          title={isSesion
            ? 'Sesión: agrupa registros del mismo paciente en la misma fecha como 1 cita'
            : 'Unidad: cada registro cuenta por separado'}
        >
          {update.isPending ? (
            <Loader2 size={11} className="spin" />
          ) : isSesion ? (
            <><Repeat2 size={11} /> Sesión</>
          ) : (
            <><Hash size={11} /> Unidad</>
          )}
        </button>
      </td>
      <td className="tabla-entidades-td svc-kws-cell">
        {s.palabras_clave.length === 0 ? (
          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Sin palabras clave</span>
        ) : (
          <div className="svc-kws-list">
            {s.palabras_clave.map((kw) => (
              <span key={kw} className="svc-kw-tag">{kw}</span>
            ))}
          </div>
        )}
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
        {fmtNum(s.total_atenciones)}
      </td>
    </tr>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function TabServicios(): React.ReactElement {
  const { data, isLoading, isError } = useServiciosCatalog();

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando procedimientos…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar el catálogo de procedimientos.
      </div>
    );
  }

  const sesionCount = data.filter((s) => s.tipo_conteo === 'sesion').length;

  return (
    <div>
      {/* Banner */}
      <div className="entidades-config-banner">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          <strong>Unidad</strong>: cada fila del Google Sheet cuenta como 1 atención.
          {' '}
          <strong>Sesión</strong>: los registros del mismo paciente en la misma fecha se agrupan en 1 cita —
          ideal para procedimientos de monitoreo continuo (telemetría, video-EEG, polisomnografía)
          donde el sistema factura una fila por hora.
          El cambio se aplica en la próxima consulta de reportes.
        </span>
      </div>

      <p className="entidades-stats" style={{ marginTop: '8px' }}>
        {data.length} procedimientos en catálogo
        {' · '}
        <strong style={{ color: '#8b5cf6' }}>{sesionCount}</strong> en modo Sesión
        {' · '}
        <strong style={{ color: '#3b82f6' }}>{data.length - sesionCount}</strong> en modo Unidad
      </p>

      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <th className="tabla-entidades-th">Procedimiento</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '110px' }}>Modo conteo</th>
              <th className="tabla-entidades-th">Palabras clave (en el Sheet)</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'right', width: '90px' }}>Registros</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <ServicioRow key={s.id} s={s} />
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        El modo de conteo persiste entre reinicios del servidor. Las palabras clave se actualizan automáticamente en cada reinicio.
      </p>
    </div>
  );
}
