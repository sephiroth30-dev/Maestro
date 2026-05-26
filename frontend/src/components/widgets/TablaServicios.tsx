import { AlertTriangle } from 'lucide-react';
import type { ServiciosResult } from '../../api/reportes.js';

interface Props {
  result: ServiciosResult;
}

function fmt(v: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
}

export default function TablaServicios({ result }: Props) {
  const { rows, sin_clasificar, valor_sin_clasificar, alerta_emg_neuro, emg_count, neuro_count } = result;

  const total = rows.reduce((s, r) => s + r.valor_bruto, 0) + valor_sin_clasificar;

  return (
    <div className="tabla-servicios">
      {alerta_emg_neuro && (
        <div className="tabla-servicios__alerta">
          <AlertTriangle size={15} />
          <span>
            Verificar registros: EMG ({emg_count}) ≠ Neuroconducción ({neuro_count}) — normalmente deben coincidir.
          </span>
        </div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Procedimiento</th>
            <th style={{ textAlign: 'right' }}>Cantidad</th>
            <th style={{ textAlign: 'right' }}>Sesiones</th>
            <th style={{ textAlign: 'right' }}>Valor Total</th>
            <th style={{ textAlign: 'right' }}>% Part.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = total > 0 ? (r.valor_bruto / total) * 100 : 0;
            const isEmgNeuroAlert =
              alerta_emg_neuro &&
              (r.nombre.toUpperCase().includes('ELECTROMIOGRAFIA') ||
               r.nombre.toUpperCase().includes('NEUROCONDUCCION'));

            return (
              <tr key={r.id} className={isEmgNeuroAlert ? 'tabla-servicios__row--alerta' : undefined}>
                <td>
                  {isEmgNeuroAlert && (
                    <AlertTriangle size={12} className="tabla-servicios__row-icon" />
                  )}
                  {r.nombre}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {r.tipo_conteo === 'sesion' ? (
                    <span title={`${r.horas ?? 0} registros totales`}>
                      {r.cantidad} ses.
                    </span>
                  ) : (
                    r.cantidad
                  )}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                  {r.tipo_conteo === 'sesion' ? `${r.horas ?? 0} reg.` : '—'}
                </td>
                <td style={{ textAlign: 'right' }}>{fmt(r.valor_bruto)}</td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                  {pct.toFixed(1)}%
                </td>
              </tr>
            );
          })}

          {sin_clasificar > 0 && (
            <tr className="tabla-servicios__row--sin-clasificar">
              <td style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                Sin clasificar
              </td>
              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                {sin_clasificar}
              </td>
              <td />
              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                {fmt(valor_sin_clasificar)}
              </td>
              <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>
                {total > 0 ? ((valor_sin_clasificar / total) * 100).toFixed(1) : '0.0'}%
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ fontWeight: 600, paddingTop: '0.5rem' }}>
              Total
            </td>
            <td style={{ textAlign: 'right', fontWeight: 600, paddingTop: '0.5rem' }}>
              {fmt(total)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>

      <p className="tabla-servicios__nota">
        Los procedimientos de <strong>telemetría EEG</strong> y <strong>polisomnografía</strong>{' '}
        se muestran en sesiones (registros agrupados por fecha + paciente).
      </p>
    </div>
  );
}
