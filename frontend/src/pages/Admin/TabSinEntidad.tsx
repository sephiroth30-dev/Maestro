import React, { useState, useMemo } from 'react';
import { AlertCircle, Loader2, Plus, X } from 'lucide-react';
import { useSinEntidadDiagnostico, useCrearEntidadFromRaw } from '../../api/reportes.js';
import type { SinEntidadRow, CrearEntidadFromRawInput } from '../../api/reportes.js';
import { SortableHeader, useSortState } from '../../components/SortableHeader.js';

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const TIPOS = ['EPS', 'ARL', 'CONVENIO', 'PARTICULAR', 'OTRO'] as const;
type Tipo = typeof TIPOS[number];

// ─── Create Entity Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  nombreRaw: string;
  onClose: () => void;
  onSuccess: (reassigned: number) => void;
}

function CreateModal({ nombreRaw, onClose, onSuccess }: CreateModalProps): React.ReactElement {
  const [nombre, setNombre] = useState(nombreRaw);
  const [tipo, setTipo] = useState<Tipo>('EPS');
  const mutation = useCrearEntidadFromRaw();

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!nombre.trim()) return;
    const input: CrearEntidadFromRawInput = { nombre: nombre.trim(), tipo, nombre_raw: nombreRaw };
    mutation.mutate(input, {
      onSuccess: (data) => {
        onSuccess(data.reassigned);
        onClose();
      },
    });
  }

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal modal--sm" role="dialog" aria-modal="true" aria-label="Crear entidad">
        <div className="modal-header">
          <h2 className="modal-title">Crear entidad</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: 4, display: 'block' }}>
                NOMBRE EN EL SHEET (referencia)
              </label>
              <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.85rem', color: '#475569', wordBreak: 'break-word' }}>
                {nombreRaw}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.78rem', color: '#374151', marginBottom: 4, display: 'block' }}>
                NOMBRE EN CATÁLOGO <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                className="form-input"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoFocus
                placeholder="Ej: NUEVA EPS"
                style={{ width: '100%', textTransform: 'uppercase' }}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '0.78rem', color: '#374151', marginBottom: 4, display: 'block' }}>
                TIPO <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                className="form-select"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as Tipo)}
                style={{ width: '100%' }}
              >
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {mutation.isError && (
              <p style={{ color: '#ef4444', fontSize: '0.82rem' }}>
                Error al crear la entidad. Intenta de nuevo.
              </p>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={mutation.isPending || !nombre.trim()}>
              {mutation.isPending ? (
                <><Loader2 size={14} className="spin" /> Creando…</>
              ) : (
                'Crear y asignar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function TabSinEntidad(): React.ReactElement {
  const now = new Date();
  const mesIdx = now.getMonth() + 1;
  const anio = now.getFullYear();

  const { data, isLoading, isError, refetch } = useSinEntidadDiagnostico(mesIdx, anio);
  const [activeRaw, setActiveRaw] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const { sortField, sortDir, onSort } = useSortState<'nombre' | 'atenciones' | 'valor'>('valor', 'desc');
  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nombre') cmp = (a.nombre_raw ?? '').localeCompare(b.nombre_raw ?? '', 'es');
      else if (sortField === 'atenciones') cmp = a.cnt - b.cnt;
      else cmp = a.total - b.total;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortField, sortDir]);

  const totalAtenciones = data?.reduce((s, r) => s + r.cnt, 0) ?? 0;
  const totalValor = data?.reduce((s, r) => s + r.total, 0) ?? 0;

  function handleSuccess(reassigned: number): void {
    setSuccessMsg(`Entidad creada y ${reassigned.toLocaleString('es-CO')} atencion${reassigned !== 1 ? 'es' : ''} reasignada${reassigned !== 1 ? 's' : ''}.`);
    setTimeout(() => setSuccessMsg(null), 5000);
  }

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
      {/* Success message */}
      {successMsg && (
        <div className="entidades-config-banner" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534', marginBottom: '0.75rem' }}>
          <AlertCircle size={14} />
          <span>{successMsg}</span>
        </div>
      )}

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
                  <SortableHeader field="nombre" label="NOMBRE EN EL SHEET" thClass="tabla-entidades-th" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <SortableHeader field="atenciones" label="ATENCIONES" right thClass="tabla-entidades-th" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <SortableHeader field="valor" label="VALOR BRUTO" right thClass="tabla-entidades-th" sortField={sortField} sortDir={sortDir} onSort={onSort} />
                  <th className="tabla-entidades-th" style={{ textAlign: 'center' }}>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((row: SinEntidadRow, idx: number) => (
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
                    <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
                      {row.nombre_raw && row.nombre_raw !== '(vacío)' ? (
                        <button
                          type="button"
                          className="btn btn--secondary btn--sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
                          onClick={() => setActiveRaw(row.nombre_raw)}
                        >
                          <Plus size={12} /> Crear entidad
                        </button>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                      )}
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
                  <td className="tabla-entidades-td" />
                </tr>
              </tbody>
            </table>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: '1rem', lineHeight: 1.5 }}>
            Usa el botón <strong>Crear entidad</strong> para agregar una nueva entidad al catálogo y
            reasignar automáticamente las atenciones con ese nombre.
          </p>
        </>
      )}

      {/* Create entity modal */}
      {activeRaw !== null && (
        <CreateModal
          nombreRaw={activeRaw}
          onClose={() => setActiveRaw(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
