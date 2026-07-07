import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, X, Check, Trash2, AlertCircle, Copy, Plus, ChevronDown } from 'lucide-react';
import {
  useReglasHonorarios,
  useUpsertRegla,
  useDeleteRegla,
  useUpdateReglaEspecial,
  useDuplicarReglas,
  type ReglaHonorariosRow,
  type ReglaEspecialRow,
} from '../../api/reglasHonorarios.js';
import { useProfesionales } from '../../api/profesionales.js';

// ─── Constants ────────────────────────────────────────────────────────────────

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

function fmtCOP(v: number): string {
  return '$' + Math.round(v).toLocaleString('es-CO');
}

function fmtPct(v: number): string {
  return (v * 100).toFixed(0) + '%';
}

function fmtCell(r: ReglaHonorariosRow): string {
  if (r.tipo === 'fijo') {
    return r.valor_entidad === r.valor_particular
      ? fmtCOP(r.valor_entidad)
      : `${fmtCOP(r.valor_entidad)} / ${fmtCOP(r.valor_particular)}`;
  }
  return r.valor_entidad === r.valor_particular
    ? fmtPct(r.valor_entidad)
    : `${fmtPct(r.valor_entidad)} / ${fmtPct(r.valor_particular)}`;
}

function fmtEspecial(row: ReglaEspecialRow): string {
  return row.tipo_regla === 'override_global_pct' ? fmtPct(row.valor) : fmtCOP(row.valor);
}

// ─── Edit Modal (standard rule) ───────────────────────────────────────────────

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
  const [error, setError] = useState('');
  const upsert = useUpsertRegla();
  const del = useDeleteRegla();
  const isBusy = upsert.isPending || del.isPending;

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
      profesional_nombre: prof, categoria: cat, tipo,
      valor_entidad: ve * factor, valor_particular: vp * factor,
      notas: notas.trim() || null,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--sm" role="dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">{existing ? 'Editar' : 'Nueva'} regla</div>
            <div className="modal-subtitle">{prof} — {catLabel}</div>
          </div>
          <button className="prof-name-edit" style={{ opacity: 1, marginLeft: 'auto' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#dc2626', fontSize: 13 }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div>
            <label className="prof-modal-label">Tipo</label>
            <select className="prof-modal-input" value={tipo} onChange={(e) => setTipo(e.target.value as 'fijo' | 'pct')}>
              <option value="fijo">Fijo (COP)</option>
              <option value="pct">Porcentaje (%)</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="prof-modal-label">Entidad {tipo === 'pct' ? '(%)' : '(COP)'}</label>
              <input
                className="prof-modal-input"
                type="number"
                step={tipo === 'pct' ? '1' : '1000'}
                placeholder={tipo === 'pct' ? 'ej: 70' : 'ej: 38000'}
                value={entidad}
                onChange={(e) => setEntidad(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="prof-modal-label">Particular {tipo === 'pct' ? '(%)' : '(COP)'}</label>
              <input
                className="prof-modal-input"
                type="number"
                step={tipo === 'pct' ? '1' : '1000'}
                placeholder={tipo === 'pct' ? 'ej: 70' : 'ej: 106000'}
                value={particular}
                onChange={(e) => setParticular(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="prof-modal-label">Notas (opcional)</label>
            <input className="prof-modal-input" type="text" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          {existing && (
            <button className="btn btn--danger-ghost" onClick={() => { void del.mutateAsync(existing.id).then(onClose); }} disabled={isBusy}>
              <Trash2 size={13} /> Eliminar
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn--ghost" onClick={onClose} disabled={isBusy}>Cancelar</button>
            <button className="btn btn--primary" onClick={() => { void handleSave(); }} disabled={isBusy}>
              <Check size={13} /> Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Duplicate rules modal ────────────────────────────────────────────────────

interface DuplicarModalProps {
  from: string;
  fromLabel: string;
  reglaCount: number;
  candidates: Array<{ nombre: string; label: string }>;
  onClose: () => void;
}

function DuplicarModal({ from, fromLabel, reglaCount, candidates, onClose }: DuplicarModalProps) {
  const [to, setTo] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const duplicar = useDuplicarReglas();

  const targetLabel = candidates.find((c) => c.nombre === to)?.label ?? to;
  const targetHasRules = to !== '';

  async function handleDuplicar() {
    if (!to) return;
    const result = await duplicar.mutateAsync({ from, to });
    setDone(result.copiadas);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--sm" role="dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">Duplicar reglas</div>
            <div className="modal-subtitle">Copiar las {reglaCount} reglas de {fromLabel}</div>
          </div>
          <button className="prof-name-edit" style={{ opacity: 1, marginLeft: 'auto' }} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {done !== null ? (
            <div className="dup-done">
              <Check size={20} style={{ color: '#16a34a' }} />
              <div>
                <strong>{done} reglas</strong> copiadas a <strong>{targetLabel}</strong>.
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Las reglas existentes del destino se actualizaron con los valores de {fromLabel}.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="prof-modal-label">Profesional destino</label>
                <select
                  className="prof-modal-input"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  autoFocus
                >
                  <option value="">— Seleccionar —</option>
                  {candidates.map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.label}</option>
                  ))}
                </select>
              </div>
              {targetHasRules && (
                <p style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, margin: 0 }}>
                  Las reglas existentes de {targetLabel} en las mismas categorías serán reemplazadas por los valores de {fromLabel}.
                </p>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn--ghost" onClick={onClose}>
            {done !== null ? 'Cerrar' : 'Cancelar'}
          </button>
          {done === null && (
            <button
              className="btn btn--primary"
              onClick={() => { void handleDuplicar(); }}
              disabled={!to || duplicar.isPending}
            >
              <Copy size={13} />
              {duplicar.isPending ? 'Copiando…' : `Duplicar ${reglaCount} reglas`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Special rule inline edit ─────────────────────────────────────────────────

function EspecialEdit({ row }: { row: ReglaEspecialRow }) {
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
        {fmtEspecial(row)} <Pencil size={11} style={{ opacity: 0.4 }} />
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
        onKeyDown={(e) => { if (e.key === 'Enter') { void handleSave(); } if (e.key === 'Escape') setEditing(false); }}
      />
      <button type="button" onClick={() => { void handleSave(); }} disabled={update.isPending}
        style={{ color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
        <Check size={14} />
      </button>
      <button type="button" onClick={() => setEditing(false)}
        style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
        <X size={14} />
      </button>
    </span>
  );
}

// ─── Add-professional picker ──────────────────────────────────────────────────

interface AddProfPickerProps {
  candidates: Array<{ nombre: string; label: string }>;
  onAdd: (nombre: string) => void;
  onClose: () => void;
}

function AddProfPicker({ candidates, onAdd, onClose }: AddProfPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = candidates.filter((c) =>
    c.label.toUpperCase().includes(q.toUpperCase())
  );

  return (
    <div ref={ref} className="add-prof-picker">
      <input
        className="prof-modal-input"
        style={{ margin: '8px 8px 4px', width: 'calc(100% - 16px)', boxSizing: 'border-box' }}
        placeholder="Buscar profesional…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      <div className="add-prof-list">
        {filtered.length === 0 ? (
          <div style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 12 }}>Sin resultados</div>
        ) : filtered.map((c) => (
          <button key={c.nombre} className="add-prof-item" onClick={() => { onAdd(c.nombre); onClose(); }}>
            {c.label}
            {c.nombre !== c.label && <span style={{ color: '#94a3b8', fontSize: 10, marginLeft: 6 }}>{c.nombre}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReglaHonorarios(): React.ReactElement {
  const { data, isLoading, isError } = useReglasHonorarios();
  const { data: catalog } = useProfesionales();

  const [extraProfs, setExtraProfs] = useState<string[]>([]);
  const [editCell, setEditCell] = useState<{ prof: string; cat: string; catLabel: string } | null>(null);
  const [duplicarFrom, setDuplicarFrom] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);

  // Build lookup name → display label from profesionales catalog
  const nameToLabel = useMemo(() => {
    const map = new Map<string, string>();
    (catalog ?? []).forEach((p) => map.set(p.nombre, p.nombre_completo ?? p.nombre));
    return map;
  }, [catalog]);

  function profLabel(nombre: string): string {
    return nameToLabel.get(nombre) ?? nombre;
  }

  // Dynamic professional list: those with any rule in DB + manually added
  const profList = useMemo(() => {
    const fromDb = [...new Set(data?.reglas.map((r) => r.profesional_nombre) ?? [])];
    const all = [...new Set([...fromDb, ...extraProfs])];
    return all.sort((a, b) => profLabel(a).localeCompare(profLabel(b)));
  }, [data, extraProfs, nameToLabel]);

  // Candidates to add (catalog entries not already in matrix)
  const addCandidates = useMemo(() => {
    const inMatrix = new Set(profList);
    return (catalog ?? [])
      .filter((p) => !inMatrix.has(p.nombre))
      .map((p) => ({ nombre: p.nombre, label: p.nombre_completo ?? p.nombre }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [catalog, profList]);

  // Build rule lookup
  const reglaMap = useMemo(() => {
    const map = new Map<string, ReglaHonorariosRow>();
    data?.reglas.forEach((r) => map.set(`${r.profesional_nombre}::${r.categoria}`, r));
    return map;
  }, [data]);

  // Duplicate modal: candidates = all catalog entries except the source
  const dupCandidates = useMemo(() => {
    if (!duplicarFrom) return [];
    return (catalog ?? [])
      .filter((p) => p.nombre !== duplicarFrom)
      .map((p) => ({ nombre: p.nombre, label: p.nombre_completo ?? p.nombre }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [catalog, duplicarFrom]);

  const editingRegla = editCell
    ? (reglaMap.get(`${editCell.prof}::${editCell.cat}`) ?? null)
    : null;

  if (isLoading) {
    return <div className="page-container"><div className="loading-spinner" /></div>;
  }
  if (isError) {
    return (
      <div className="page-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626', padding: 16 }}>
          <AlertCircle size={16} /> Error al cargar las reglas de honorarios.
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reglas de Honorarios</h1>
          <p className="page-subtitle">
            Clic en una celda para editar · Azul = fijo COP · Verde = porcentaje del bruto
          </p>
        </div>
      </div>

      {/* ── Matriz principal ─────────────────────────────────────────────── */}
      <div className="card" style={{ overflowX: 'auto', marginBottom: 24 }}>
        <div className="card-header">
          <h2 className="card-title">Matriz de tarifas</h2>
        </div>
        <table className="data-table rh-matrix" style={{ minWidth: 900, fontSize: 12 }}>
          <thead>
            <tr>
              <th className="rh-prof-col">Profesional</th>
              {CATEGORIAS.map((c) => (
                <th key={c.key} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{c.label}</th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {profList.map((prof) => {
              const ruleCount = CATEGORIAS.filter((c) => reglaMap.has(`${prof}::${c.key}`)).length;
              return (
                <tr key={prof} className="rh-prof-row">
                  <td className="rh-prof-col rh-prof-name">
                    <div className="rh-prof-name-inner">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>{profLabel(prof)}</div>
                        {profLabel(prof) !== prof && (
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{prof}</div>
                        )}
                      </div>
                      <span className="rh-rule-count">{ruleCount}/{CATEGORIAS.length}</span>
                    </div>
                  </td>
                  {CATEGORIAS.map((c) => {
                    const regla = reglaMap.get(`${prof}::${c.key}`);
                    return (
                      <td
                        key={c.key}
                        className="rh-cell"
                        title={regla ? 'Clic para editar' : 'Sin regla — clic para agregar'}
                        onClick={() => setEditCell({ prof, cat: c.key, catLabel: c.label })}
                      >
                        {regla ? (
                          <span className={`rh-badge rh-badge--${regla.tipo}`}>
                            {fmtCell(regla)}
                          </span>
                        ) : (
                          <span className="rh-empty">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                    <button
                      className="rh-dup-btn"
                      title={`Duplicar reglas de ${profLabel(prof)}`}
                      onClick={() => setDuplicarFrom(prof)}
                      disabled={ruleCount === 0}
                    >
                      <Copy size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add professional row */}
        <div className="rh-add-row" style={{ position: 'relative' }}>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setShowAddPicker((v) => !v)}
            disabled={addCandidates.length === 0}
          >
            <Plus size={13} />
            Agregar profesional
            <ChevronDown size={12} style={{ opacity: 0.6 }} />
          </button>
          {showAddPicker && (
            <AddProfPicker
              candidates={addCandidates}
              onAdd={(nombre) => setExtraProfs((prev) => [...new Set([...prev, nombre])])}
              onClose={() => setShowAddPicker(false)}
            />
          )}
          {addCandidates.length === 0 && catalog && catalog.length > 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>
              Todos los profesionales del catálogo ya están en la matriz.
            </span>
          )}
        </div>
      </div>

      {/* ── Reglas especiales ─────────────────────────────────────────────── */}
      {data && data.especiales.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Reglas especiales</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Condiciones por entidad o servicio. Clic en el valor para editarlo.
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
                    <span className="rh-tipo-badge">{TIPO_REGLA_LABELS[esp.tipo_regla] ?? esp.tipo_regla}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {profLabel(esp.profesional_nombre)}
                    {profLabel(esp.profesional_nombre) !== esp.profesional_nombre && (
                      <div style={{ fontSize: 10, color: '#94a3b8' }}>{esp.profesional_nombre}</div>
                    )}
                  </td>
                  <td style={{ color: '#475569', fontSize: 11 }}>{esp.condicion ?? '—'}</td>
                  <td style={{ textAlign: 'center' }}><EspecialEdit row={esp} /></td>
                  <td style={{ color: '#64748b', fontSize: 11 }}>{esp.descripcion ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {editCell && (
        <EditModal
          prof={editCell.prof}
          cat={editCell.cat}
          catLabel={editCell.catLabel}
          existing={editingRegla}
          onClose={() => setEditCell(null)}
        />
      )}

      {duplicarFrom && (
        <DuplicarModal
          from={duplicarFrom}
          fromLabel={profLabel(duplicarFrom)}
          reglaCount={CATEGORIAS.filter((c) => reglaMap.has(`${duplicarFrom}::${c.key}`)).length}
          candidates={dupCandidates}
          onClose={() => setDuplicarFrom(null)}
        />
      )}
    </div>
  );
}
