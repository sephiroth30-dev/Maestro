import React, { useState, useMemo } from 'react';
import {
  Loader2, AlertCircle, Info, Repeat2, Hash, ChevronDown, ChevronRight,
  RefreshCw, X, Pencil, Check, Eye,
} from 'lucide-react';
import { ColFilter, useColSort } from '../../components/ColFilter.js';
import {
  useServiciosCatalog, useUpdateServicio, useReclasificarServicios,
  useServicioAgrupaciones,
} from '../../api/servicios.js';
import { useSinServicioDiagnostico } from '../../api/reportes.js';
import type { ServicioCatalogRow, ReclasificarResult, ServicioAgrupacion } from '../../api/servicios.js';

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);
const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// ─── Catalog row ──────────────────────────────────────────────────────────────

interface ServicioRowProps {
  s: ServicioCatalogRow;
  agrupacion: ServicioAgrupacion | undefined;
}

function ServicioRow({ s, agrupacion }: ServicioRowProps): React.ReactElement {
  const update = useUpdateServicio();
  const [optimistic, setOptimistic] = useState<'unidad' | 'sesion' | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(s.nombre_display ?? '');
  const [expanded, setExpanded] = useState(false);
  const current = optimistic ?? s.tipo_conteo;

  async function toggleConteo(): Promise<void> {
    const next: 'unidad' | 'sesion' = current === 'sesion' ? 'unidad' : 'sesion';
    setOptimistic(next);
    try { await update.mutateAsync({ id: s.id, tipo_conteo: next }); }
    catch { setOptimistic(null); return; }
    setOptimistic(null);
  }

  function saveName(): void {
    const trimmed = nameVal.trim();
    if (trimmed === (s.nombre_display ?? '')) { setEditingName(false); return; }
    void update.mutateAsync({ id: s.id, nombre_display: trimmed || null }).then(() => setEditingName(false));
  }

  const isSesion = current === 'sesion';
  const displayName = s.nombre_display ?? s.nombre;

  return (
    <>
      <tr className="tabla-entidades-tr">
        {/* Nombre / nombre editable */}
        <td className="tabla-entidades-td" style={{ minWidth: 200 }}>
          {editingName ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                className="prof-name-input"
                value={nameVal}
                onChange={(e) => setNameVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                autoFocus
                placeholder={s.nombre}
              />
              <button className="prof-name-save" onClick={saveName} disabled={update.isPending}>
                {update.isPending ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
              </button>
              <button className="prof-name-save" style={{ background: '#94a3b8' }} onClick={() => setEditingName(false)}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div>
                <span style={{ fontWeight: 500 }}>{displayName}</span>
                {s.nombre_display && (
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: 1 }}>{s.nombre}</div>
                )}
              </div>
              <button
                className="prof-name-edit"
                onClick={() => { setNameVal(s.nombre_display ?? ''); setEditingName(true); }}
                title="Editar nombre en reportes"
              >
                <Pencil size={10} />
              </button>
            </div>
          )}
        </td>

        {/* Tipo conteo */}
        <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
          <button
            type="button"
            className={`svc-conteo-toggle ${isSesion ? 'svc-conteo-toggle--sesion' : 'svc-conteo-toggle--unidad'}`}
            onClick={() => void toggleConteo()}
            disabled={update.isPending}
            title={isSesion
              ? 'Sesión: agrupa registros del mismo paciente en la misma fecha como 1 cita'
              : 'Unidad: cada registro cuenta por separado'}
          >
            {update.isPending ? <Loader2 size={11} className="spin" /> : isSesion ? <><Repeat2 size={11} /> Sesión</> : <><Hash size={11} /> Unidad</>}
          </button>
        </td>

        {/* Palabras clave */}
        <td className="tabla-entidades-td svc-kws-cell">
          {s.palabras_clave.length === 0 ? (
            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Sin palabras clave</span>
          ) : (
            <div className="svc-kws-list">
              {s.palabras_clave.map((kw) => <span key={kw} className="svc-kw-tag">{kw}</span>)}
            </div>
          )}
        </td>

        {/* Registros + ver agrupaciones */}
        <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b', whiteSpace: 'nowrap' }}>
          {fmtNum(s.total_atenciones)}
          {agrupacion && agrupacion.items.length > 0 && (
            <button
              className="svc-agrup-toggle"
              onClick={() => setExpanded((p) => !p)}
              title="Ver descripciones del Sheet agrupadas aquí"
            >
              <Eye size={11} />
              {agrupacion.items.length}
            </button>
          )}
        </td>
      </tr>

      {/* Panel de agrupaciones */}
      {expanded && agrupacion && (
        <tr className="svc-agrup-row">
          <td colSpan={4} className="svc-agrup-cell">
            <div className="svc-agrup-header">
              <strong>{displayName}</strong>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                — {agrupacion.items.length} descripciones distintas del Sheet agrupadas aquí
              </span>
            </div>
            <table className="svc-agrup-table">
              <thead>
                <tr>
                  <th>Descripción literal en el Sheet</th>
                  <th style={{ textAlign: 'right', width: 70 }}>Registros</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Valor total</th>
                </tr>
              </thead>
              <tbody>
                {agrupacion.items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.77rem', color: '#334155' }}>
                      {item.descripcion_raw ?? '(vacío)'}
                    </td>
                    <td style={{ textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>{fmtNum(item.cnt)}</td>
                    <td style={{ textAlign: 'right', color: '#64748b', fontSize: '0.8rem' }}>{fmtCOP(item.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Sin clasificar section ───────────────────────────────────────────────────

function SinClasificarSection(): React.ReactElement {
  const { data, isLoading } = useSinServicioDiagnostico();
  const [expanded, setExpanded] = useState(false);

  if (isLoading || !data || data.length === 0) return <></>;

  const totalCnt = data.reduce((s, r) => s + r.cnt, 0);
  const totalVal = data.reduce((s, r) => s + r.total, 0);

  return (
    <div className="sin-clasificar-section" style={{ marginTop: '24px' }}>
      <button
        type="button"
        className="sin-clasificar-toggle"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>
          <strong>{fmtNum(totalCnt)}</strong> registros sin clasificar
          {' · '}
          <span style={{ color: '#f59e0b' }}>{fmtCOP(totalVal)}</span>
        </span>
        <span className="sin-clasificar-hint">
          — ver descripciones para agregar palabras clave al catálogo
        </span>
      </button>

      {expanded && (
        <div className="tabla-entidades-wrapper" style={{ marginTop: '8px' }}>
          <table className="tabla-entidades-table">
            <thead>
              <tr>
                <th className="tabla-entidades-th">Descripción en el Sheet</th>
                <th className="tabla-entidades-th" style={{ textAlign: 'right', width: '90px' }}>Registros</th>
                <th className="tabla-entidades-th" style={{ textAlign: 'right', width: '130px' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r, i) => (
                <tr key={i} className="tabla-entidades-tr">
                  <td className="tabla-entidades-td" style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    {r.descripcion_raw ?? '(vacío)'}
                  </td>
                  <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
                    {fmtNum(r.cnt)}
                  </td>
                  <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
                    {fmtCOP(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reclassify button ────────────────────────────────────────────────────────

function ReclasificarBtn(): React.ReactElement {
  const reclasificar = useReclasificarServicios();
  const [result, setResult] = useState<ReclasificarResult | null>(null);

  async function handle(): Promise<void> {
    setResult(null);
    const res = await reclasificar.mutateAsync();
    setResult(res);
  }

  return (
    <div className="reclasificar-wrap">
      <button
        type="button"
        className="reclasificar-btn"
        onClick={() => void handle()}
        disabled={reclasificar.isPending}
        title="Re-aplica las palabras clave del catálogo a todos los registros históricos"
      >
        {reclasificar.isPending ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
        {reclasificar.isPending ? 'Reclasificando…' : 'Reclasificar registros'}
      </button>
      {result && (
        <span className="reclasificar-result">
          {fmtNum(result.updated)} actualizados de {fmtNum(result.total)}
          {' · '}
          {fmtNum(result.sin_clasificar)} sin clasificar
        </span>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function TabServicios(): React.ReactElement {
  const { data, isLoading, isError } = useServiciosCatalog();
  const { data: agrupaciones } = useServicioAgrupaciones();
  const [search, setSearch] = useState('');

  const agrupMap = useMemo(() => {
    const m = new Map<string, ServicioAgrupacion>();
    agrupaciones?.forEach((a) => m.set(a.servicio_id, a));
    return m;
  }, [agrupaciones]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.trim().toUpperCase();
    return data.filter((s) =>
      s.nombre.toUpperCase().includes(q) ||
      (s.nombre_display ?? '').toUpperCase().includes(q)
    );
  }, [data, search]);

  const { sorted: displayed, sortField, sortDir, onSort } = useColSort(filtered, (row, field) => {
    if (field === 'nombre') return (row.nombre_display ?? row.nombre);
    if (field === 'registros') return row.total_atenciones;
    return row.nombre;
  });

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando procedimientos…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar el catálogo de procedimientos.
      </div>
    );
  }

  const sesionCount = data.filter((s) => s.tipo_conteo === 'sesion').length;

  return (
    <div>
      {/* Banner */}
      <div className="entidades-config-banner">
        <Info size={14} style={{ flexShrink: 0 }} />
        <span>
          <strong>Nombre en reportes</strong>: haz clic en el lápiz para cambiar cómo se llama el procedimiento en el Mix por Servicio — sin afectar las palabras clave de matching.
          {' '}
          <strong>Ojo</strong> <Eye size={11} style={{ verticalAlign: 'middle' }} />: muestra qué descripciones del Sheet caen en ese grupo.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <p className="entidades-stats" style={{ margin: 0 }}>
          {data.length} procedimientos en catálogo
          {' · '}
          <strong style={{ color: '#8b5cf6' }}>{sesionCount}</strong> en modo Sesión
          {' · '}
          <strong style={{ color: '#3b82f6' }}>{data.length - sesionCount}</strong> en modo Unidad
        </p>
        <ReclasificarBtn />
      </div>

      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <ColFilter
                label="Nombre en reportes"
                field="nombre"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                searchValue={search}
                onSearch={setSearch}
                searchPlaceholder="Buscar procedimiento…"
              />
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '110px' }}>Modo conteo</th>
              <th className="tabla-entidades-th">Palabras clave (matching)</th>
              <ColFilter
                label="Registros"
                field="registros"
                sortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                align="right"
                sortLabels={['Menor → Mayor', 'Mayor → Menor']}
                width="110px"
              />
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={4} className="table-no-results">Sin resultados para "{search}"</td></tr>
            ) : displayed.map((s) => (
              <ServicioRow key={s.id} s={s} agrupacion={agrupMap.get(s.id)} />
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        El modo de conteo y el nombre en reportes persisten entre reinicios. Las palabras clave se actualizan automáticamente en cada reinicio.
      </p>

      <SinClasificarSection />
    </div>
  );
}
