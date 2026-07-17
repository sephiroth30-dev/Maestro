import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Pencil, X, Check, Trash2, AlertCircle, Copy, Plus } from 'lucide-react';
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
// mode='copy-to'  → fixed is the SOURCE; user picks the DESTINATION
// mode='copy-from' → fixed is the DESTINATION; user picks the SOURCE

interface DuplicarModalProps {
  mode: 'copy-to' | 'copy-from';
  fixed: string;
  fixedLabel: string;
  fixedRuleCount: number;   // used in 'copy-to' mode subtitle
  candidates: Array<{ nombre: string; label: string; ruleCount?: number }>;
  onClose: () => void;
}

function DuplicarModal({ mode, fixed, fixedLabel, fixedRuleCount, candidates, onClose }: DuplicarModalProps) {
  const [selected, setSelected] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const duplicar = useDuplicarReglas();

  const selectedLabel = candidates.find((c) => c.nombre === selected)?.label ?? selected;
  const selectedRuleCount = candidates.find((c) => c.nombre === selected)?.ruleCount ?? 0;

  const isCopyTo   = mode === 'copy-to';
  const sourceLabel = isCopyTo ? fixedLabel : selectedLabel;
  const destLabel   = isCopyTo ? selectedLabel : fixedLabel;
  const ruleCount   = isCopyTo ? fixedRuleCount : selectedRuleCount;

  async function handleDuplicar() {
    if (!selected) return;
    const from = isCopyTo ? fixed : selected;
    const to   = isCopyTo ? selected : fixed;
    const result = await duplicar.mutateAsync({ from, to });
    setDone(result.copiadas);
  }

  const title    = isCopyTo ? `Duplicar reglas de ${fixedLabel}` : `Copiar reglas a ${fixedLabel}`;
  const subtitle = isCopyTo
    ? `Copia las ${fixedRuleCount} reglas de ${fixedLabel} a otro profesional`
    : `Selecciona el profesional del que copiar las reglas`;
  const selectLabel = isCopyTo ? 'Copiar a' : 'Copiar desde';

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--sm" role="dialog">
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            <div className="modal-subtitle">{subtitle}</div>
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
                <strong>{done} reglas</strong> copiadas de <strong>{sourceLabel}</strong> a <strong>{destLabel}</strong>.
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  Las reglas existentes de {destLabel} en las mismas categorías fueron actualizadas.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="prof-modal-label">{selectLabel}</label>
                <select
                  className="prof-modal-input"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  autoFocus
                >
                  <option value="">— Seleccionar —</option>
                  {candidates.map((c) => (
                    <option key={c.nombre} value={c.nombre}>
                      {c.label}{c.ruleCount !== undefined ? ` (${c.ruleCount} reglas)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selected && (
                <p style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 6, margin: 0 }}>
                  {ruleCount} reglas de <strong>{sourceLabel}</strong> serán copiadas a <strong>{destLabel}</strong>.
                  Las categorías que ya existan en el destino serán reemplazadas.
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
              disabled={!selected || duplicar.isPending}
            >
              <Copy size={13} />
              {duplicar.isPending ? 'Copiando…' : `Copiar ${ruleCount} reglas`}
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
  const [copiarDesdeFor, setCopiarDesdeFor] = useState<string | null>(null);
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

  // "Duplicar" (copy-to): candidates = all catalog entries except the source
  const dupCandidates = useMemo(() => {
    if (!duplicarFrom) return [];
    return (catalog ?? [])
      .filter((p) => p.nombre !== duplicarFrom)
      .map((p) => ({ nombre: p.nombre, label: p.nombre_completo ?? p.nombre }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [catalog, duplicarFrom]);

  // "Copiar desde" (copy-from): candidates = professionals in matrix WITH at least 1 rule
  const copiarDesdeCandidates = useMemo(() => {
    if (!copiarDesdeFor) return [];
    return profList
      .filter((p) => p !== copiarDesdeFor)
      .map((p) => ({
        nombre: p,
        label: profLabel(p),
        ruleCount: CATEGORIAS.filter((c) => reglaMap.has(`${p}::${c.key}`)).length,
      }))
      .filter((p) => p.ruleCount > 0)
      .sort((a, b) => b.ruleCount - a.ruleCount || a.label.localeCompare(b.label));
  }, [copiarDesdeFor, profList, reglaMap]);

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
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 className="card-title">Matriz de tarifas</h2>
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Clic en una celda para agregar o editar · <span style={{ color: '#1d4ed8' }}>■</span> Fijo COP · <span style={{ color: '#15803d' }}>■</span> Porcentaje
            </p>
          </div>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => setShowAddPicker((v) => !v)}
              disabled={addCandidates.length === 0}
            >
              <Plus size={13} />
              Agregar profesional
            </button>
            {showAddPicker && (
              <AddProfPicker
                candidates={addCandidates}
                onAdd={(nombre) => setExtraProfs((prev) => [...new Set([...prev, nombre])])}
                onClose={() => setShowAddPicker(false)}
              />
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table rh-matrix" style={{ minWidth: 900, fontSize: 12 }}>
            <thead>
              <tr>
                <th className="rh-prof-col">Profesional</th>
                {CATEGORIAS.map((c) => (
                  <th key={c.key} style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{c.label}</th>
                ))}
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {profList.length === 0 ? (
                <tr>
                  <td colSpan={CATEGORIAS.length + 2} style={{ textAlign: 'center', color: '#94a3b8', padding: '24px', fontSize: 13 }}>
                    Ningún profesional configurado. Usa "Agregar profesional" para comenzar.
                  </td>
                </tr>
              ) : profList.map((prof) => {
                const ruleCount = CATEGORIAS.filter((c) => reglaMap.has(`${prof}::${c.key}`)).length;
                return (
                  <tr key={prof} className="rh-prof-row">
                    <td className="rh-prof-col rh-prof-name">
                      <div className="rh-prof-name-inner">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {profLabel(prof)}
                          </div>
                          {profLabel(prof) !== prof && (
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{prof}</div>
                          )}
                        </div>
                        <span className={`rh-rule-count ${ruleCount === CATEGORIAS.length ? 'rh-rule-count--full' : ''}`}>
                          {ruleCount}/{CATEGORIAS.length}
                        </span>
                      </div>
                    </td>
                    {CATEGORIAS.map((c) => {
                      const regla = reglaMap.get(`${prof}::${c.key}`);
                      return (
                        <td
                          key={c.key}
                          className="rh-cell"
                          title={regla ? `${profLabel(prof)} — ${c.label}: clic para editar` : `${profLabel(prof)} — ${c.label}: sin regla, clic para agregar`}
                          onClick={() => setEditCell({ prof, cat: c.key, catLabel: c.label })}
                        >
                          {regla ? (
                            <span className={`rh-badge rh-badge--${regla.tipo}`}>{fmtCell(regla)}</span>
                          ) : (
                            <span className="rh-empty">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', padding: '4px 6px', whiteSpace: 'nowrap' }}>
                      {ruleCount === 0 ? (
                        <button
                          className="rh-dup-btn rh-dup-btn--from"
                          title="Copiar reglas de otro profesional a este"
                          onClick={() => setCopiarDesdeFor(prof)}
                        >
                          <Copy size={11} /> Copiar desde…
                        </button>
                      ) : (
                        <button
                          className="rh-dup-btn"
                          title={`Copiar reglas de ${profLabel(prof)} a otro profesional`}
                          onClick={() => setDuplicarFrom(prof)}
                          style={{ opacity: 0.5 }}
                        >
                          <Copy size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {addCandidates.length === 0 && catalog && catalog.length > 0 && profList.length > 0 && (
          <p style={{ fontSize: 11, color: '#94a3b8', padding: '8px 16px', margin: 0, borderTop: '1px solid #f1f5f9' }}>
            Todos los profesionales del catálogo están en la matriz.
          </p>
        )}
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
          mode="copy-to"
          fixed={duplicarFrom}
          fixedLabel={profLabel(duplicarFrom)}
          fixedRuleCount={CATEGORIAS.filter((c) => reglaMap.has(`${duplicarFrom}::${c.key}`)).length}
          candidates={dupCandidates}
          onClose={() => setDuplicarFrom(null)}
        />
      )}

      {copiarDesdeFor && (
        <DuplicarModal
          mode="copy-from"
          fixed={copiarDesdeFor}
          fixedLabel={profLabel(copiarDesdeFor)}
          fixedRuleCount={0}
          candidates={copiarDesdeCandidates}
          onClose={() => setCopiarDesdeFor(null)}
        />
      )}
    </div>
  );
}
