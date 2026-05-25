import React, { useMemo } from 'react';
import { Loader2, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDiagnostico } from '../../api/reportes.js';
import type { DiagnosticoRow } from '../../api/reportes.js';

const MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function StatusIcon({ row }: { row: DiagnosticoRow }): React.ReactElement {
  const badRate = row.sin_entidad / row.atenciones > 0.1 || row.sin_valor / row.atenciones > 0.05;
  if (badRate) return <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />;
  return <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />;
}

export default function TabDiagnostico(): React.ReactElement {
  const { data, isLoading, isError, refetch } = useDiagnostico();

  const grouped = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { anio: number; mes: number; rows: DiagnosticoRow[] }>();
    for (const r of data) {
      const key = `${r.anio}-${r.mes_idx}`;
      if (!map.has(key)) map.set(key, { anio: r.anio, mes: r.mes_idx, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  }, [data]);

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: '8px' }}>Calculando diagnóstico…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar el diagnóstico.
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="entidades-config-banner" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534' }}>
        <CheckCircle size={14} />
        <span>
          Validación directa desde la base de datos — sin depender de ningún archivo externo.
          Compara estas cifras con tu Excel para verificar que la importación es correcta.
        </span>
      </div>

      {grouped.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>No hay datos importados aún.</p>
      ) : (
        grouped.map(({ anio, mes, rows }) => {
          const totalAtenciones = rows.reduce((s, r) => s + r.atenciones, 0);
          const totalValor = rows.reduce((s, r) => s + r.valor_bruto, 0);
          const totalSinEntidad = rows.reduce((s, r) => s + r.sin_entidad, 0);
          const totalSinValor = rows.reduce((s, r) => s + r.sin_valor, 0);

          return (
            <div key={`${anio}-${mes}`} className="diag-month-block">
              <div className="diag-month-header">
                <span className="diag-month-label">{MESES[mes]} {anio}</span>
                <span className="diag-month-totals">
                  {totalAtenciones.toLocaleString('es-CO')} atenciones · {COP.format(totalValor)}
                  {totalSinEntidad > 0 && (
                    <span className="diag-badge diag-badge--warn">
                      <AlertTriangle size={11} />
                      {totalSinEntidad} sin entidad ({pct(totalSinEntidad, totalAtenciones)})
                    </span>
                  )}
                </span>
              </div>

              <div className="tabla-entidades-wrapper">
                <table className="tabla-entidades-table">
                  <thead>
                    <tr>
                      <th className="tabla-entidades-th">Fuente</th>
                      <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Atenciones</th>
                      <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Valor Bruto</th>
                      <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Sin entidad</th>
                      <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Sin valor</th>
                      <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.conector_id} className="tabla-entidades-tr">
                        <td className="tabla-entidades-td tabla-entidades-nombre">{r.conector_nombre}</td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>
                          {r.atenciones.toLocaleString('es-CO')}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right', fontWeight: 500 }}>
                          {COP.format(r.valor_bruto)}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right', color: r.sin_entidad > 0 ? '#f59e0b' : '#94a3b8' }}>
                          {r.sin_entidad > 0 ? `${r.sin_entidad} (${pct(r.sin_entidad, r.atenciones)})` : '—'}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right', color: r.sin_valor > 0 ? '#ef4444' : '#94a3b8' }}>
                          {r.sin_valor > 0 ? `${r.sin_valor} (${pct(r.sin_valor, r.atenciones)})` : '—'}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
                          <StatusIcon row={r} />
                        </td>
                      </tr>
                    ))}
                    {/* Month total row */}
                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 600 }}>
                      <td className="tabla-entidades-td">TOTAL {MESES[mes]} {anio}</td>
                      <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>
                        {totalAtenciones.toLocaleString('es-CO')}
                      </td>
                      <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#1e40af' }}>
                        {COP.format(totalValor)}
                      </td>
                      <td className="tabla-entidades-td" style={{ textAlign: 'right', color: totalSinEntidad > 0 ? '#f59e0b' : '#94a3b8' }}>
                        {totalSinEntidad > 0 ? totalSinEntidad : '—'}
                      </td>
                      <td className="tabla-entidades-td" style={{ textAlign: 'right', color: totalSinValor > 0 ? '#ef4444' : '#94a3b8' }}>
                        {totalSinValor > 0 ? totalSinValor : '—'}
                      </td>
                      <td className="tabla-entidades-td" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
