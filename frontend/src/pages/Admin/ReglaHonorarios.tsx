import React, { useState } from 'react';
import { Pencil, X, Check, Trash2, AlertCircle } from 'lucide-react';
import {
  useReglasHonorarios,
  useUpsertRegla,
  useDeleteRegla,
  useUpdateReglaEspecial,
  type ReglaHonorariosRow,
  type ReglaEspecialRow,
} from '../../api/reglasHonorarios.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFESIONALES = [
  'PERLAZA', 'LAVERDE', 'ESCOBAR', 'TERAN',
  'MONTAÑO', 'PARADA', 'YOLIMA', 'CRUZ', 'CONCHA',
];

const CATEGORIAS: { key: string; label: string }[] = [
  { key: 'consulta',       label: 'Consulta' },
  { key: 'emg_vcn',        label: 'EMG/VCN' },
  { key: 'infiltracion',   label: 'Infiltración' },
  { key: 'ecografia',      label: 'Ecografía' },
  { key: 'terapia_choque', label: 'T. Choque' },
  { key: 'junta',          label: 'Junta' },
  { key: 'eeg',            label: 'EEG' },
  { key: 'psg_lms',        label: 'PSG/LMS' },
  { key: 'tlm',            label: 'Telemetría' },
  { key: 'pe',             label: 'PE' },
];

const TIPO_REGLA_LABELS: Record<string, string> = {
  consulta_reducida:   'Consulta reducida',
  override_global_pct: 'Override global %',
  psg_diferenciado:    'PSG fijo',
  lms_diferenciado:    'LMS fijo',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCOP(v: number): string {
  return '$' + Math.round(v).toLocaleString('es-CO');
}

function formatPct(v: number): string {
  return (v * 100).toFixed(0) + '%';
}

function formatCellValue(regla: ReglaHonorariosRow): string {
  if (regla.tipo === 'fijo') {
    if (regla.valor_entidad === regla.valor_particular) {
      return formatCOP(regla.valor_entidad);
    }
    return `${formatCOP(regla.valor_entidad)} / ${formatCOP(regla.valor_particular)}`;
  }
  if (regla.valor_entidad === regla.valor_particular) {
    return formatPct(regla.valor_entidad);
  }
  return `${formatPct(regla.valor_entidad)} / ${formatPct(regla.valor_particular)}`;
}

function formatEspecialValor(row: ReglaEspecialRow): string {
  if (row.tipo_regla === 'override_global_pct') return formatPct(row.valor);
  return formatCOP(row.valor);
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  prof: string;
  cat: string;
  catLabel: string;
  existing: ReglaHonorariosRow | null;
  onClose: () => void;
}

function EditModal({ prof, cat, catLabel, existing, onClose }: EditModalProps) {
  const [tipo, setTipo] = useState<'fijo' | 'pct'>(existing?.tipo ?? 'fijo');
  const [entidad, setEntidad] = useState(
    existing ? String(existing.tipo === 'pct' ? existing.valor_entidad * 100 : existing.valor_entidad) : ''
  );
  const [particular, setParticular] = useState(
    existing ? String(existing.tipo === 'pct' ? existing.valor_particular * 100 : existing.valor_particular) : ''
  );
  const [notas, setNotas] = useState(existing?.notas ?? '');

  const upsert = useUpsertRegla();
  const deleteRegla = useDeleteRegla();

  const [error, setError] = useState('');

  function parseVal(raw: string): number | null {
    const n = parseFloat(raw.replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  async function handleSave() {
    const ve = parseVal(entidad);
    const vp = parseVal(particular);
    if (ve === null || vp === null) { setError('Ingresa valores numéricos válidos'); return; }

    const factor = tipo === 'pct' ? 0.01 : 1;
    await upsert.mutateAsync({
      profesional_nombre: prof,
      categoria: cat,
      tipo,
      valor_entidad: ve * factor,
      valor_particular: vp * factor,
      notas: notas || null,
    });
    onClose();
  }

  async function handleDelete() {
    if (!existing) return;
    await deleteRegla.mutateAsync(existing.id);
    onClose();
  }

  const isBusy = upsert.isPending || deleteRegla.isPending;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {existing ? 'Editar regla' : 'Nueva regla'}: {prof} — {catLabel}
          </h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div>
            <label className="form-label">Tipo</label>
            <select
              className="form-input"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'fijo' | 'pct')}
            >
              <option value="fijo">Fijo (COP)</option>
              <option value="pct">Porcentaje (%)</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="form-label">
                Valor entidad {tipo === 'pct' ? '(%)' : '(COP)'}
              </label>
              <input
                className="form-input"
                type="number"
                step={tipo === 'pct' ? '1' : '1000'}
                placeholder={tipo === 'pct' ? 'ej: 70' : 'ej: 38000'}
                value={entidad}
                onChange={(e) => setEntidad(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">
                Valor particular {tipo === 'pct' ? '(%)' : '(COP)'}
              </label>
              <input
                className="form-input"
                type="number"
                step={tipo === 'pct' ? '1' : '1000'}
                placeholder={tipo === 'pct' ? 'ej: 70' : 'ej: 106000'}
                value={particular}
                onChange={(e) => setParticular(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Notas (opcional)</label>
            <input
              className="form-input"
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
            {existing ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={isBusy}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={isBusy}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Check size={14} /> Guardar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Special rule inline edit ─────────────────────────────────────────────────

interface EspecialEditProps {
  row: ReglaEspecialRow;
}

function EspecialEdit({ row }: EspecialEditProps) {
  const isPct = row.tipo_regla === 'override_global_pct';
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState(String(isPct ? row.valor * 100 : row.valor));
  const update = useUpdateReglaEspecial();

  async function handleSave() {
    const n = parseFloat(valor.replace(',', '.'));
    if (isNaN(n)) return;
    await update.mutateAsync({ id: row.id, valor: isPct ? n * 0.01 : n, descripcion: row.descripcion });
    setEditing(false);
  }

  if (!editing) {
    return (
      <span
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        onClick={() => setEditing(true)}
        title="Clic para editar"
      >
        {formatEspecialValor(row)}
        <Pencil size={11} style={{ opacity: 0.5 }} />
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        type="number"
        step={isPct ? '1' : '1000'}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        style={{ width: 80, padding: '2px 6px', fontSize: 12, border: '1px solid #6366f1', borderRadius: 4 }}
        autoFocus
      />
      <button type="button" onClick={handleSave} disabled={update.isPending} style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
        <Check size={14} />
      </button>
      <button type="button" onClick={() => setEditing(false)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
        <X size={14} />
      </button>
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReglaHonorarios(): React.ReactElement {
  const { data, isLoading, isError } = useReglasHonorarios();
  const [editCell, setEditCell] = useState<{ prof: string; cat: string; catLabel: string } | null>(null);

  const reglaMap = React.useMemo(() => {
    const map = new Map<string, ReglaHonorariosRow>();
    data?.reglas.forEach((r) => map.set(`${r.profesional_nombre}::${r.categoria}`, r));
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="page-container">
        <div className="alert alert-error">Error al cargar las reglas de honorarios.</div>
      </div>
    );
  }

  const openEdit = (prof: string, cat: string, catLabel: string) => {
    setEditCell({ prof, cat, catLabel });
  };

  const editingRegla = editCell
    ? (reglaMap.get(`${editCell.prof}::${editCell.cat}`) ?? null)
    : null;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reglas de Honorarios</h1>
          <p className="page-subtitle">
            Parametrización de la liquidación de honorarios médicos. Haz clic en cualquier celda para editar.
          </p>
        </div>
      </div>

      {/* ── Matriz principal ────────────────────────────────────────────── */}
      <div className="card" style={{ overflowX: 'auto', marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Matriz de tarifas</h2>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Fijo: entidad / particular (COP) · Porcentaje: % del valor bruto
          </p>
        </div>
        <table className="data-table" style={{ minWidth: 900, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 110, position: 'sticky', left: 0, background: 'var(--surface-elevated, #fff)', zIndex: 1 }}>
                Profesional
              </th>
              {CATEGORIAS.map((c) => (
                <th key={c.key} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROFESIONALES.map((prof) => (
              <tr key={prof}>
                <td style={{
                  fontWeight: 600,
                  position: 'sticky',
                  left: 0,
                  background: 'var(--surface-elevated, #fff)',
                  zIndex: 1,
                  fontSize: 11,
                  color: '#1e293b',
                }}>
                  {prof}
                </td>
                {CATEGORIAS.map((c) => {
                  const regla = reglaMap.get(`${prof}::${c.key}`);
                  return (
                    <td
                      key={c.key}
                      style={{ textAlign: 'center', cursor: 'pointer', padding: '6px 8px' }}
                      title={regla ? `${regla.tipo === 'fijo' ? 'Fijo' : 'Porcentaje'} — clic para editar` : 'Sin regla — clic para agregar'}
                      onClick={() => openEdit(prof, c.key, c.label)}
                    >
                      {regla ? (
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: regla.tipo === 'fijo' ? '#eff6ff' : '#f0fdf4',
                          color: regla.tipo === 'fijo' ? '#1d4ed8' : '#15803d',
                          fontWeight: 500,
                          fontSize: 11,
                          whiteSpace: 'nowrap',
                        }}>
                          {formatCellValue(regla)}
                        </span>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Reglas especiales ───────────────────────────────────────────── */}
      {data && data.especiales.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Reglas especiales</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Condiciones específicas por entidad o tipo de servicio. Haz clic en el valor para editarlo.
            </p>
          </div>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Profesional</th>
                <th>Condición</th>
                <th style={{ textAlign: 'center' }}>Valor</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {data.especiales.map((esp) => (
                <tr key={esp.id}>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: '#f1f5f9',
                      color: '#475569',
                      fontSize: 11,
                      fontWeight: 500,
                    }}>
                      {TIPO_REGLA_LABELS[esp.tipo_regla] ?? esp.tipo_regla}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{esp.profesional_nombre}</td>
                  <td style={{ color: '#475569', fontSize: 11 }}>
                    {esp.condicion ?? '—'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <EspecialEdit row={esp} />
                  </td>
                  <td style={{ color: '#64748b', fontSize: 11 }}>{esp.descripcion ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────── */}
      {editCell && (
        <EditModal
          prof={editCell.prof}
          cat={editCell.cat}
          catLabel={editCell.catLabel}
          existing={editingRegla}
          onClose={() => setEditCell(null)}
        />
      )}
    </div>
  );
}
