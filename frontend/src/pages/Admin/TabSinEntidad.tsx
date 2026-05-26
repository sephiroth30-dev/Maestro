import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useSinEntidadDiagnostico } from '../../api/reportes.js';
import type { SinEntidadRow } from '../../api/reportes.js';

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

export default function TabSinEntidad(): React.ReactElement {
  const now = new Date();
  const mesIdx = now.getMonth() + 1;
  const anio = now.getFullYear();

  const { data, isLoading, isError, refetch } = useSinEntidadDiagnostico(mesIdx, anio);

  const totalAtenciones = data?.reduce((s, r) => s + r.cnt, 0) ?? 0;
  const totalValor = data?.reduce((s, r) => s + r.total, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando diagnóstico Sin Entidad…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar el diagnóstico Sin Entidad.
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Warning banner */}
      {totalAtenciones > 0 ? (
        <div className="entidades-config-banner" style={{ background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }}>
          <AlertCircle size={14} />
          <span>
            <strong>{totalAtenciones.toLocaleString('es-CO')} atenciones</strong> por{' '}
            <strong>{COP.format(totalValor)}</strong> no tienen entidad asignada. Estos registros no se
            clasifican correctamente en el Mix Pagador.
          </span>
        </div>
      ) : (
        <div className="entidades-config-banner" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>
          <AlertCircle size={14} />
          <span>
            No hay registros sin entidad para el mes actual. ¡Todo está bien clasificado!
          </span>
        </div>
      )}

      {data.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>
          No hay atenciones sin entidad este mes.
        </p>
      ) : (
        <>
          <div className="tabla-entidades-wrapper">
            <table className="tabla-entidades-table">
              <thead>
                <tr>
                  <th className="tabla-entidades-th">NOMBRE EN EL SHEET</th>
                  <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>ATENCIONES</th>
                  <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>VALOR BRUTO</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row: SinEntidadRow, idx: number) => (
                  <tr key={idx} className="tabla-entidades-tr">
                    <td className="tabla-entidades-td tabla-entidades-nombre">
                      {row.nombre_raw === '(vacío)' || row.nombre_raw === null ? (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                          (vacío — sin valor en columna de entidad)
                        </span>
                      ) : (
                        row.nombre_raw
                      )}
                    </td>
                    <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>
                      {row.cnt.toLocaleString('es-CO')}
                    </td>
                    <td className="tabla-entidades-td" style={{ textAlign: 'right', fontWeight: 500, color: '#9a3412' }}>
                      {COP.format(row.total)}
                    </td>
                  </tr>
                ))}
                {/* Total row */}
                <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 600 }}>
                  <td className="tabla-entidades-td">TOTAL SIN ENTIDAD</td>
                  <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>
                    {totalAtenciones.toLocaleString('es-CO')}
                  </td>
                  <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#9a3412' }}>
                    {COP.format(totalValor)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '1rem', lineHeight: 1.5 }}>
            Después de la próxima sincronización verás los nombres exactos de las entidades que no
            pudieron ser identificadas. Agrega los nombres faltantes al catálogo en la pestaña{' '}
            <strong>Entidades</strong> para que aparezcan correctamente en el Mix Pagador.
          </p>
        </>
      )}
    </div>
  );
}
