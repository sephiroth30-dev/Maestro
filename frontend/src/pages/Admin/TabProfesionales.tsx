import React, { useState, useMemo } from 'react';
import { Loader2, AlertCircle, Info, Check, Pencil } from 'lucide-react';
import { ColFilter, useColSort } from '../../components/ColFilter.js';
import { useProfesionales, useUpdateProfesional } from '../../api/profesionales.js';
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

export default function TabProfesionales(): React.ReactElement {
  const { data, isLoading, isError } = useProfesionales();
  const [search, setSearch] = useState('');

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
      <div className="entidades-config-banner">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          Registra el nombre completo de cada profesional para los reportes de honorarios.
          También asigna la especialidad para que las consultas genéricas se clasifiquen correctamente.
        </span>
      </div>

      <p className="entidades-stats" style={{ marginTop: '8px' }}>
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
