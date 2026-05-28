import React, { useState, useMemo } from 'react';
import { Loader2, AlertCircle, Info, Repeat2, Hash, ChevronDown, ChevronRight, RefreshCw, Search, X, ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { useServiciosCatalog, useUpdateServicioTipoConteo, useReclasificarServicios } from '../../api/servicios.js';
import { useSinServicioDiagnostico } from '../../api/reportes.js';
import type { ServicioCatalogRow, ReclasificarResult } from '../../api/servicios.js';

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);
const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// ─── Catalog row ──────────────────────────────────────────────────────────────

function ServicioRow({ s }: { s: ServicioCatalogRow }): React.ReactElement {
  const update = useUpdateServicioTipoConteo();
  const [optimistic, setOptimistic] = useState<'unidad' | 'sesion' | null>(null);
  const current = optimistic ?? s.tipo_conteo;

  async function toggle(): Promise<void> {
    const next: 'unidad' | 'sesion' = current === 'sesion' ? 'unidad' : 'sesion';
    setOptimistic(next);
    try {
      await update.mutateAsync({ id: s.id, tipo_conteo: next });
    } catch {
      setOptimistic(null);
      return;
    }
    setOptimistic(null);
  }

  const isSesion = current === 'sesion';

  return (
    <tr className="tabla-entidades-tr">
      <td className="tabla-entidades-td" style={{ fontWeight: 500 }}>
        {s.nombre}
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
        <button
          type="button"
          className={`svc-conteo-toggle ${isSesion ? 'svc-conteo-toggle--sesion' : 'svc-conteo-toggle--unidad'}`}
          onClick={() => void toggle()}
          disabled={update.isPending}
          title={isSesion
            ? 'Sesión: agrupa registros del mismo paciente en la misma fecha como 1 cita'
            : 'Unidad: cada registro cuenta por separado'}
        >
          {update.isPending ? (
            <Loader2 size={11} className="spin" />
          ) : isSesion ? (
            <><Repeat2 size={11} /> Sesión</>
          ) : (
            <><Hash size={11} /> Unidad</>
          )}
        </button>
      </td>
      <td className="tabla-entidades-td svc-kws-cell">
        {s.palabras_clave.length === 0 ? (
          <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.75rem' }}>Sin palabras clave</span>
        ) : (
          <div className="svc-kws-list">
            {s.palabras_clave.map((kw) => (
              <span key={kw} className="svc-kw-tag">{kw}</span>
            ))}
          </div>
        )}
      </td>
      <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
        {fmtNum(s.total_atenciones)}
      </td>
    </tr>
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
  const [search, setSearch] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);

  const displayed = useMemo(() => {
    if (!data) return [];
    let rows = data;
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      rows = rows.filter((s) => s.nombre.toUpperCase().includes(q));
    }
    if (sortDir) {
      rows = [...rows].sort((a, b) =>
        sortDir === 'asc' ? a.nombre.localeCompare(b.nombre) : b.nombre.localeCompare(a.nombre)
      );
    }
    return rows;
  }, [data, search, sortDir]);

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
          <strong>Unidad</strong>: cada fila del Google Sheet cuenta como 1 atención.
          {' '}
          <strong>Sesión</strong>: los registros del mismo paciente en la misma fecha se agrupan en 1 cita —
          ideal para procedimientos de monitoreo continuo (telemetría, video-EEG, polisomnografía)
          donde el sistema factura una fila por hora.
          El cambio se aplica en la próxima consulta de reportes.
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

      {/* Búsqueda + orden */}
      <div className="table-toolbar" style={{ marginTop: '10px' }}>
        <div className="table-search-wrap">
          <Search size={13} />
          <input
            className="table-search-input"
            placeholder="Buscar procedimiento…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="table-search-clear" onClick={() => setSearch('')}><X size={12} /></button>
          )}
        </div>
        <button
          className={`table-sort-btn${sortDir === 'asc' ? ' table-sort-btn--active' : ''}`}
          onClick={() => setSortDir(sortDir === 'asc' ? null : 'asc')}
        >
          <ArrowDownAZ size={13} /> A → Z
        </button>
        <button
          className={`table-sort-btn${sortDir === 'desc' ? ' table-sort-btn--active' : ''}`}
          onClick={() => setSortDir(sortDir === 'desc' ? null : 'desc')}
        >
          <ArrowUpAZ size={13} /> Z → A
        </button>
      </div>

      <div className="tabla-entidades-wrapper">
        <table className="tabla-entidades-table">
          <thead>
            <tr>
              <th className="tabla-entidades-th">Procedimiento</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'center', width: '110px' }}>Modo conteo</th>
              <th className="tabla-entidades-th">Palabras clave (en el Sheet)</th>
              <th className="tabla-entidades-th" style={{ textAlign: 'right', width: '90px' }}>Registros</th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr><td colSpan={4} className="table-no-results">Sin resultados para "{search}"</td></tr>
            ) : displayed.map((s) => (
              <ServicioRow key={s.id} s={s} />
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        El modo de conteo persiste entre reinicios del servidor. Las palabras clave se actualizan automáticamente en cada reinicio.
      </p>

      <SinClasificarSection />
    </div>
  );
}
