import React, { useState } from 'react';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useHonorarios } from '../api/honorarios.js';
import type { HonorariosProfesionalRow, HonorariosCeldas } from '../api/honorarios.js';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef {
  key: keyof Omit<HonorariosProfesionalRow, 'profesional_id' | 'nombre' | 'total' | 'sin_regla'>;
  label: string;
  sublabel: string;
}

const COLS: ColDef[] = [
  { key: 'consulta',        label: 'Consulta',        sublabel: 'Tarifa fija' },
  { key: 'emg_vcn',         label: 'EMG / VCN',       sublabel: 'EMG · VCN · Reflejos · Est. Repetitiva' },
  { key: 'infiltracion',    label: 'Infiltración',     sublabel: 'Infiltración art. · Toxina botulínica' },
  { key: 'ecografia',       label: 'Ecografía',        sublabel: 'Como guía para procedimiento' },
  { key: 'terapia_choque',  label: 'Ondas Choque',     sublabel: 'Terapia extracorpórea' },
  { key: 'junta',           label: 'Junta',            sublabel: 'Junta médica interdisciplinaria' },
  { key: 'eeg',             label: 'EEG',              sublabel: 'EEG ambulatorio · UCI · Portátil' },
  { key: 'psg_lms',         label: 'PSG / MSLT',       sublabel: 'Polisomnografía · Latencia múltiple' },
  { key: 'tlm',             label: 'Telemetría',       sublabel: 'Monitorización EEG / Video-EEG' },
  { key: 'pe',              label: 'Potenciales Evoc.', sublabel: 'PEA · PEV · PESS · Motor' },
];

// ─── Celda ────────────────────────────────────────────────────────────────────

function Celda({ c, highlight = false }: { c: HonorariosCeldas; highlight?: boolean }): React.ReactElement {
  if (c.monto === 0) return <td className="hon-td hon-td--empty">—</td>;
  return (
    <td className={`hon-td ${highlight ? 'hon-td--total' : ''}`}>
      <span className="hon-monto">{fmtCOP(c.monto)}</span>
      <span className="hon-cnt">{fmtNum(c.cnt)}</span>
    </td>
  );
}

// ─── Fila de profesional ──────────────────────────────────────────────────────

function FilaProfesional({ row }: { row: HonorariosProfesionalRow }): React.ReactElement {
  return (
    <tr className="hon-tr">
      <td className="hon-td hon-td--nombre">{row.nombre}</td>
      {COLS.map((col) => (
        <Celda key={col.key} c={row[col.key] as HonorariosCeldas} />
      ))}
      <td className="hon-td hon-td--grand-total">{fmtCOP(row.total)}</td>
      {row.sin_regla.monto > 0 && (
        <td className="hon-td hon-td--sin-regla" title="Valor facturado de servicios sin regla de liquidación definida">
          {fmtCOP(row.sin_regla.monto)}
          <span className="hon-cnt">{fmtNum(row.sin_regla.cnt)}</span>
        </td>
      )}
      {row.sin_regla.monto === 0 && <td className="hon-td hon-td--empty">—</td>}
    </tr>
  );
}

// ─── Selector de período ──────────────────────────────────────────────────────

interface PeriodPickerProps {
  mes: number;
  anio: number;
  onChange: (mes: number, anio: number) => void;
}

function PeriodPicker({ mes, anio, onChange }: PeriodPickerProps): React.ReactElement {
  const prev = () => {
    if (mes === 1) onChange(12, anio - 1);
    else onChange(mes - 1, anio);
  };
  const next = () => {
    const now = new Date();
    if (anio > now.getFullYear() || (anio === now.getFullYear() && mes >= now.getMonth() + 1)) return;
    if (mes === 12) onChange(1, anio + 1);
    else onChange(mes + 1, anio);
  };

  return (
    <div className="hon-period-picker">
      <button type="button" className="hon-period-btn" onClick={prev} title="Mes anterior">
        <ChevronLeft size={16} />
      </button>
      <span className="hon-period-label">
        {MESES[mes]} {anio}
      </span>
      <button type="button" className="hon-period-btn" onClick={next} title="Mes siguiente">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Honorarios(): React.ReactElement {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const { data, isLoading, isError } = useHonorarios(mes, anio);

  return (
    <div className="page-container">
      <div className="hon-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="page-title">Honorarios Médicos</h1>
            <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 6px', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
              v{__APP_VERSION__}
            </span>
          </div>
          <p className="page-subtitle">
            Liquidación calculada desde los registros de facturación del período seleccionado
          </p>
        </div>
        <PeriodPicker mes={mes} anio={anio} onChange={(m, a) => { setMes(m); setAnio(a); }} />
      </div>

      <div className="entidades-config-banner" style={{ marginBottom: '16px' }}>
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          Los valores se calculan aplicando las <strong>reglas de liquidación</strong> vigentes a cada registro del período.
          {' '}Las consultas usan tarifa fija por tipo de pago (entidad / particular);
          {' '}los procedimientos usan el porcentaje acordado sobre el valor facturado.
          {' '}<strong>Aguja monopolar y Derechos de sala</strong> están excluidos por acuerdo.
        </span>
      </div>

      {isLoading && (
        <div className="page-loading">
          <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
          <p style={{ color: '#64748b', marginTop: '8px' }}>Calculando honorarios…</p>
        </div>
      )}

      {isError && (
        <div className="reportes-error">
          <AlertCircle size={16} />
          Error al calcular los honorarios. Verifica que haya datos para el período seleccionado.
        </div>
      )}

      {data && !isLoading && (
        <>
          {/* Resumen totales */}
          <div className="hon-resumen">
            <div className="hon-resumen-item">
              <span className="hon-resumen-label">Total del período</span>
              <span className="hon-resumen-value">{fmtCOP(data.totales.total)}</span>
            </div>
            <div className="hon-resumen-item">
              <span className="hon-resumen-label">Profesionales</span>
              <span className="hon-resumen-value">{data.rows.length}</span>
            </div>
            {data.totales.sin_regla.monto > 0 && (
              <div className="hon-resumen-item hon-resumen-item--warn">
                <span className="hon-resumen-label">Sin regla</span>
                <span className="hon-resumen-value">{fmtCOP(data.totales.sin_regla.monto)}</span>
              </div>
            )}
          </div>

          {data.rows.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '24px' }}>
              Sin registros para {MESES[mes]} {anio}.
            </p>
          ) : (
            <div className="hon-table-scroll">
              <table className="hon-table">
                <thead>
                  <tr>
                    <th className="hon-th hon-th--nombre" rowSpan={2}>Profesional</th>
                    {COLS.map((col) => (
                      <th key={col.key} className="hon-th" title={col.sublabel}>
                        {col.label}
                      </th>
                    ))}
                    <th className="hon-th hon-th--grand-total" rowSpan={2}>Total</th>
                    <th className="hon-th hon-th--sin-regla" rowSpan={2} title="Valor facturado de registros sin regla de liquidación definida para ese profesional">
                      Sin regla
                    </th>
                  </tr>
                  <tr>
                    {COLS.map((col) => (
                      <th key={col.key} className="hon-th hon-th--sub">{col.sublabel}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {data.rows.map((row) => (
                    <FilaProfesional key={row.profesional_id} row={row} />
                  ))}
                </tbody>

                <tfoot>
                  <tr className="hon-tr--totales">
                    <td className="hon-td hon-td--nombre"><strong>TOTAL</strong></td>
                    {COLS.map((col) => {
                      const c = data.totales[col.key] as HonorariosCeldas;
                      return c.monto > 0 ? (
                        <td key={col.key} className="hon-td hon-td--total">
                          <span className="hon-monto">{fmtCOP(c.monto)}</span>
                          <span className="hon-cnt">{fmtNum(c.cnt)}</span>
                        </td>
                      ) : (
                        <td key={col.key} className="hon-td hon-td--empty">—</td>
                      );
                    })}
                    <td className="hon-td hon-td--grand-total">{fmtCOP(data.totales.total)}</td>
                    <td className="hon-td hon-td--sin-regla">
                      {data.totales.sin_regla.monto > 0 ? fmtCOP(data.totales.sin_regla.monto) : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px' }}>
            Para registros en modo Sesión (Telemetría, PSG) el conteo refleja sesiones únicas (paciente + fecha), no filas individuales.
            {' '}Nueva EPS y Viva 1A aplican tarifa reducida de consulta ($36.000) para los doctores con ese acuerdo contractual.
          </p>
        </>
      )}
    </div>
  );
}
