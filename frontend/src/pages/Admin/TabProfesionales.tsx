import React, { useState, useMemo, useRef } from 'react';
import { Loader2, AlertCircle, Info, Check, Pencil, Plus, X } from 'lucide-react';
import { ColFilter, useColSort } from '../../components/ColFilter.js';
import { useProfesionales, useUpdateProfesional, useCreateProfesional } from '../../api/profesionales.js';
import type { ProfesionalRow, Especialidad } from '../../api/profesionales.js';

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

const ESP_LABELS: Record<string, string> = {
  NEUROLOGIA: 'Neurología',
  FISIATRIA:  'Fisiatría',
  OTRO:       'Otra',
};

const ESP_COLORS: Record<string, string> = {
  NEUROLOGIA: '#3b82f6',
  FISIATRIA:  '#8b5cf6',
  OTRO:       '#64748b',
};

function ProfRow({ p }: { p: ProfesionalRow }): React.ReactElement {
  const update = useUpdateProfesional();
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(p.nombre_completo ?? '');

  function setEsp(val: string): void {
    const esp: Especialidad = val === '' ? null : (val as Especialidad);
    void update.mutateAsync({ id: p.id, especialidad: esp });
  }

  function saveName(): void {
    const trimmed = nameVal.trim();
    if (trimmed === (p.nombre_completo ?? '')) { setEditingName(false); return; }
    void update.mutateAsync({ id: p.id, nombre_completo: trimmed || null }).then(() => setEditingName(false));
  }

  const current = p.especialidad ?? '';
  const color = current ? ESP_COLORS[current] : '#9ca3af';

  return (
    <tr className="tabla-entidades-tr">
      <td className="tabla-entidades-td" style={{ minWidth: 200 }}>
        {editingName ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input
              className="prof-name-input"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
              autoFocus
              placeholder="Nombre completo…"
            />
            <button className="prof-name-save" onClick={saveName} disabled={update.isPending}>
              {update.isPending ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div>
              {p.nombre_completo
                ? <span style={{ fontWeight: 600 }}>{p.nombre_completo}</span>
                : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{p.nombre}</span>
              }
              {p.nombre_completo && (
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.nombre}</div>
              )}
            </div>
            <button className="prof-name-edit" onClick={() => { setNameVal(p.nombre_completo ?? ''); setEditingName(true); }} title="Editar nombre">
              <Pencil size={11} />
            </button>
          </div>
        )}
      </td>
      <td className="tabla-entidades-td">
        <div className="svc-kws-list">
          {p.nombres_raw.map((n) => (
            <span key={n} className="svc-kw-tag">{n}</span>
          ))}
        </div>
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
        <select
          className="prof-esp-select"
          value={current}
          onChange={(e) => setEsp(e.target.value)}
          disabled={update.isPending}
          style={{ borderColor: color, color }}
        >
          <option value="">— sin asignar —</option>
          <option value="NEUROLOGIA">Neurología</option>
          <option value="FISIATRIA">Fisiatría</option>
          <option value="OTRO">Otra especialidad</option>
        </select>
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
        {fmtNum(p.total_atenciones)}
      </td>
    </tr>
  );
}

function NuevoProfesionalModal({ onClose }: { onClose: () => void }): React.ReactElement {
  const create = useCreateProfesional();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [especialidad, setEspecialidad] = useState<Especialidad>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    const nombres_raw = rawInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);
    if (nombres_raw.length === 0) {
      setError('Escribe al menos un nombre tal como aparece en el Sheet.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    void create.mutateAsync({
      nombres_raw,
      nombre_completo: nombreCompleto.trim() || null,
      especialidad,
    }).then(onClose);
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal--sm" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <div className="modal-title">Nuevo profesional</div>
            <div className="modal-subtitle">El profesional estará disponible en la próxima sincronización.</div>
          </div>
          <button className="prof-name-edit" onClick={onClose} aria-label="Cerrar" style={{ marginLeft: 'auto', opacity: 1 }}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="prof-modal-label" htmlFor="pm-raw">
                Nombre en el Sheet <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                id="pm-raw"
                ref={inputRef}
                className="prof-modal-input"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Ej: DR GARCIA, DR. GARCIA LOPEZ"
                autoFocus
              />
              <p className="prof-modal-hint">
                Escribe el nombre exactamente como aparece en el Sheet. Si tiene variantes, sepáralas con coma.
              </p>
              {error && <p style={{ color: '#ef4444', fontSize: '12px', marginTop: 4 }}>{error}</p>}
            </div>

            <div>
              <label className="prof-modal-label" htmlFor="pm-nombre">
                Nombre completo (para reportes)
              </label>
              <input
                id="pm-nombre"
                className="prof-modal-input"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                placeholder="Ej: Dr. Juan García López"
              />
            </div>

            <div>
              <label className="prof-modal-label" htmlFor="pm-esp">
                Especialidad
              </label>
              <select
                id="pm-esp"
                className="prof-esp-select"
                value={especialidad ?? ''}
                onChange={(e) => setEspecialidad((e.target.value || null) as Especialidad)}
                style={{ width: '100%', borderColor: '#e2e8f0', color: '#334155' }}
              >
                <option value="">— sin asignar —</option>
                <option value="NEUROLOGIA">Neurología</option>
                <option value="FISIATRIA">Fisiatría</option>
                <option value="OTRO">Otra especialidad</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={create.isPending}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={create.isPending}>
              {create.isPending ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
              Crear profesional
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TabProfesionales(): React.ReactElement {
  const { data, isLoading, isError } = useProfesionales();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.trim().toUpperCase();
    return data.filter((p) =>
      p.nombre.toUpperCase().includes(q) ||
      (p.nombre_completo ?? '').toUpperCase().includes(q)
    );
  }, [data, search]);

  const { sorted: displayed, sortField, sortDir, onSort } = useColSort(filtered, (row, field) => {
    if (field === 'nombre') return (row.nombre_completo ?? row.nombre);
    if (field === 'registros') return row.total_atenciones;
    return row.nombre;
  });

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando profesionales…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar el catálogo de profesionales.
      </div>
    );
  }

  const tagged = data.filter((p) => p.especialidad).length;
  const byEsp = Object.entries(ESP_LABELS).map(([k, label]) => ({
    key: k, label, count: data.filter((p) => p.especialidad === k).length,
  }));

  return (
    <div>
      {showModal && <NuevoProfesionalModal onClose={() => setShowModal(false)} />}

      <div className="entidades-config-banner">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          Registra el nombre completo de cada profesional para los reportes de honorarios.
          También asigna la especialidad para que las consultas genéricas se clasifiquen correctamente.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
        <p className="entidades-stats" style={{ margin: 0 }}>
          {data.length} profesionales
          {' · '}
          <strong style={{ color: '#16a34a' }}>{tagged}</strong> etiquetados
          {' · '}
          {byEsp.map(({ key, label, count }) => count > 0 && (
            <span key={key} style={{ marginRight: 8 }}>
              <strong style={{ color: ESP_COLORS[key] }}>{count}</strong> {label}
            </span>
          ))}
        </p>
        <button className="btn btn--primary btn--sm" onClick={() => setShowModal(true)}>
          <Plus size={14} />
          Nuevo profesional
        </button>
      </div>

      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <ColFilter
                label="Nombre completo"
                field="nombre"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                searchValue={search}
                onSearch={setSearch}
                searchPlaceholder="Buscar profesional…"
              />
              <th className="tabla-entidades-th">Nombres en el Sheet</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '180px' }}>Especialidad</th>
              <ColFilter
                label="Registros"
                field="registros"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
                sortLabels={['Menor → Mayor', 'Mayor → Menor']}
                width="90px"
              />
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={4} className="table-no-results">Sin resultados para "{search}"</td></tr>
            ) : displayed.map((p) => <ProfRow key={p.id} p={p} />)}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        La especialidad solo afecta la clasificación de consultas genéricas. Los demás procedimientos
        se clasifican siempre por descripción.
      </p>
    </div>
  );
}
