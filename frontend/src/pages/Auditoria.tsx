import { useState } from 'react';
import type { ReactElement } from 'react';
import { ClipboardList, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuditoria, useAuditoriaAcciones } from '../api/auditoria.js';
import type { AuditLog } from '../types/index.js';

// ─── Action display config ────────────────────────────────────────────────────

const ACCION_LABELS: Record<string, string> = {
  LOGIN:                 'Inicio de sesión',
  LOGIN_FALLIDO:         'Inicio fallido',
  LOGOUT:                'Cierre de sesión',
  CAMBIO_PASSWORD:       'Cambio de contraseña',
  RESET_PASSWORD:        'Restablecimiento de contraseña',
  USUARIO_CREADO:        'Usuario creado',
  USUARIO_ACTUALIZADO:   'Usuario actualizado',
  USUARIO_ELIMINADO:     'Usuario eliminado',
  AJUSTE_CREADO:         'Ajuste creado',
  AJUSTE_AUTORIZADO:     'Ajuste autorizado',
  AJUSTE_RECHAZADO:      'Ajuste rechazado',
  AJUSTE_ELIMINADO:      'Ajuste eliminado',
  LIQUIDACION_GENERADA:  'Liquidación generada',
  LIQUIDACION_APROBADA:  'Liquidación aprobada',
  LIQUIDACION_PAGADA:    'Liquidación pagada',
  LIQUIDACION_REVERTIDA: 'Liquidación revertida',
  CONECTOR_CREADO:       'Conector creado',
  CONECTOR_ACTUALIZADO:  'Conector actualizado',
  CONECTOR_ELIMINADO:    'Conector eliminado',
  SYNC_INICIADO:         'Sincronización iniciada',
  DATOS_ELIMINADOS:      'Datos eliminados',
};

const ACCION_BADGE: Record<string, string> = {
  LOGIN:                 'badge--blue',
  LOGIN_FALLIDO:         'badge--red',
  LOGOUT:                'badge--slate',
  CAMBIO_PASSWORD:       'badge--yellow',
  RESET_PASSWORD:        'badge--yellow',
  USUARIO_CREADO:        'badge--purple',
  USUARIO_ACTUALIZADO:   'badge--purple',
  USUARIO_ELIMINADO:     'badge--red',
  AJUSTE_CREADO:         'badge--yellow',
  AJUSTE_AUTORIZADO:     'badge--emerald',
  AJUSTE_RECHAZADO:      'badge--red',
  AJUSTE_ELIMINADO:      'badge--slate',
  LIQUIDACION_GENERADA:  'badge--blue',
  LIQUIDACION_APROBADA:  'badge--emerald',
  LIQUIDACION_PAGADA:    'badge--emerald',
  LIQUIDACION_REVERTIDA: 'badge--red',
  CONECTOR_CREADO:       'badge--blue',
  CONECTOR_ACTUALIZADO:  'badge--blue',
  CONECTOR_ELIMINADO:    'badge--red',
  SYNC_INICIADO:         'badge--blue',
  DATOS_ELIMINADOS:      'badge--red',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

function initials(nombre: string | null): string {
  if (!nombre) return '?';
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

function DetalleCell({ detalle }: { detalle: Record<string, unknown> | null }): ReactElement {
  if (!detalle || Object.keys(detalle).length === 0) return <span style={{ color: '#94a3b8' }}>—</span>;
  const entries = Object.entries(detalle).slice(0, 3);
  return (
    <span style={{ fontSize: '0.72rem', color: '#475569', fontFamily: 'monospace' }}>
      {entries.map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
      {Object.keys(detalle).length > 3 && ' …'}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function Auditoria(): ReactElement {
  const [page, setPage]         = useState(1);
  const [accion, setAccion]     = useState('');
  const [desde, setDesde]       = useState('');
  const [hasta, setHasta]       = useState('');
  const [searchPending, setSearchPending] = useState(false);

  const [activeFilters, setActiveFilters] = useState<{
    accion: string; desde: string; hasta: string;
  }>({ accion: '', desde: '', hasta: '' });

  const { data, isLoading, error } = useAuditoria({
    page,
    limit: PAGE_SIZE,
    accion:  activeFilters.accion  || undefined,
    desde:   activeFilters.desde   || undefined,
    hasta:   activeFilters.hasta   || undefined,
  });

  const { data: accionesDisponibles } = useAuditoriaAcciones();

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  function applyFilters() {
    setPage(1);
    setActiveFilters({ accion, desde, hasta });
    setSearchPending(false);
  }

  function clearFilters() {
    setAccion('');
    setDesde('');
    setHasta('');
    setPage(1);
    setActiveFilters({ accion: '', desde: '', hasta: '' });
    setSearchPending(false);
  }

  const hasActiveFilters = activeFilters.accion || activeFilters.desde || activeFilters.hasta;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ClipboardList size={22} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: '#6366f1' }} />
            Auditoría
          </h1>
          <p className="page-subtitle">Registro de actividad del sistema</p>
        </div>
        {data && (
          <span style={{ fontSize: '0.8rem', color: '#64748b', alignSelf: 'center' }}>
            {data.total.toLocaleString('es-MX')} registros
          </span>
        )}
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="chart-card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
            <label className="form-label">Acción</label>
            <select
              className="form-input"
              value={accion}
              onChange={(e) => { setAccion(e.target.value); setSearchPending(true); }}
            >
              <option value="">Todas</option>
              {(accionesDisponibles ?? Object.keys(ACCION_LABELS)).map((a) => (
                <option key={a} value={a}>{ACCION_LABELS[a] ?? a}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
            <label className="form-label">Desde</label>
            <input
              className="form-input"
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setSearchPending(true); }}
            />
          </div>

          <div className="form-group" style={{ margin: 0, minWidth: 140 }}>
            <label className="form-label">Hasta</label>
            <input
              className="form-input"
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setSearchPending(true); }}
            />
          </div>

          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={applyFilters}
            style={{ alignSelf: 'flex-end' }}
          >
            <Search size={14} /> Buscar
          </button>

          {(hasActiveFilters || searchPending) && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={clearFilters}
              style={{ alignSelf: 'flex-end' }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center' }}>
          Cargando registros…
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', padding: '1rem', background: '#fef2f2', borderRadius: 8 }}>
          Error al cargar el registro de auditoría
        </div>
      )}

      {data && (
        <>
          <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Fecha / hora</th>
                  <th style={{ width: 200 }}>Usuario</th>
                  <th style={{ width: 190 }}>Acción</th>
                  <th>Entidad</th>
                  <th>Detalle</th>
                  <th style={{ width: 110 }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      No hay registros para los filtros seleccionados
                    </td>
                  </tr>
                )}
                {data.data.map((log: AuditLog) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.75rem', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatDate(log.createdAt)}
                    </td>

                    <td>
                      {log.usuarioNombre ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#e0e7ff', color: '#4f46e5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                          }}>
                            {initials(log.usuarioNombre)}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                              {log.usuarioNombre}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{log.usuarioEmail}</div>
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sistema</span>
                      )}
                    </td>

                    <td>
                      <span className={`badge ${ACCION_BADGE[log.accion] ?? 'badge--slate'}`}>
                        {ACCION_LABELS[log.accion] ?? log.accion}
                      </span>
                    </td>

                    <td style={{ fontSize: '0.75rem', color: '#475569' }}>
                      {log.entidadTipo ? (
                        <span>
                          <span style={{ fontWeight: 500 }}>{log.entidadTipo}</span>
                          {log.entidadId && (
                            <span style={{ color: '#94a3b8', marginLeft: 4, fontFamily: 'monospace', fontSize: '0.68rem' }}>
                              {log.entidadId.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    <td>
                      <DetalleCell detalle={log.detalle} />
                    </td>

                    <td style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {log.ip ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ───────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.5rem', marginTop: '1rem',
            }}>
              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Página {page} de {totalPages}
              </span>

              <button
                type="button"
                className="btn btn--ghost btn--icon btn--sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
