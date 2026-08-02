/**
 * Dialogo de exportacion: formato, presets, y checkboxes por seccion y columna.
 *
 * Reutiliza las clases .modal-* que ya existen en index.css.
 */

import React from 'react';
import { X, FileText, FileSpreadsheet, FileDown, Loader2, AlertTriangle, Lock } from 'lucide-react';
import type { ExportDoc, ExportFormat, ExportTableSection } from './types.js';
import { PRESETS } from './presets.js';
import { docTieneValores, useExportSelection } from './useExportSelection.js';

interface Props {
  doc: ExportDoc;
  permitirValores: boolean;
  generating: boolean;
  warnings: string[];
  error: string | null;
  onGenerate: (format: ExportFormat, orientation: 'portrait' | 'landscape', selection: ReturnType<typeof useExportSelection>['selection']) => void;
  onClose: () => void;
}

const FORMATOS: { id: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { id: 'pdf', label: 'PDF', icon: <FileText size={14} /> },
  { id: 'excel', label: 'Excel', icon: <FileSpreadsheet size={14} /> },
  { id: 'csv', label: 'CSV', icon: <FileDown size={14} /> },
];

export function ExportDialog({
  doc, permitirValores, generating, warnings, error, onGenerate, onClose,
}: Props): React.ReactElement {
  const { selection, preset, setFormat, setOrientation, toggleSection, toggleColumn, applyPreset } =
    useExportSelection(doc, permitirValores);

  const hayValores = docTieneValores(doc);
  const presets = PRESETS.filter((p) => p.id !== 'sin-valores' || (hayValores && permitirValores));

  const resumen = React.useMemo(() => {
    let secciones = 0;
    let filas = 0;
    for (const s of doc.sections) {
      if (selection.sections[s.id] === false) continue;
      secciones += 1;
      if (s.kind === 'table') filas += s.rows.length;
      else if (s.kind === 'chart' && s.fallbackTable) filas += s.fallbackTable.rows.length;
    }
    return { secciones, filas };
  }, [doc, selection]);

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Exportar reporte" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Exportar reporte</h2>
            <p className="modal-subtitle">{doc.title} — {doc.periodLabel}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar" disabled={generating}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!permitirValores && (
            <div className="entidades-config-banner" style={{ background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }}>
              <Lock size={14} style={{ flexShrink: 0 }} />
              <span>Tu rol no tiene acceso a informacion financiera: la exportacion incluira unicamente cantidades.</span>
            </div>
          )}

          {doc.filters.length > 0 && (
            <div>
              <p className="modal-section-label">Filtros aplicados</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {doc.filters.map((f) => (
                  <span key={f.label} className="dia-filter-badge" style={{ fontSize: '0.75rem' }}>
                    {f.label}: <strong>{f.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="modal-section-label">Formato</p>
            <div className="filter-mode-tabs">
              {FORMATOS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`filter-mode-tab${selection.format === f.id ? ' filter-mode-tab--active' : ''}`}
                  onClick={() => setFormat(f.id)}
                  disabled={generating}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  {f.icon} {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="modal-section-label">Presets</p>
            <div className="preset-btns">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`preset-btn${preset === p.id ? ' preset-btn--active' : ''}`}
                  onClick={() => applyPreset(p.id)}
                  title={p.hint}
                  disabled={generating}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="modal-section-label">Contenido</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
              {doc.sections.map((s) => {
                const table: ExportTableSection | null =
                  s.kind === 'table' ? s : s.kind === 'chart' ? (s.fallbackTable ?? null) : null;
                // Una grafica no montada y sin tabla equivalente no se puede
                // exportar; applySelection tambien la descarta, esto solo lo
                // hace visible.
                const chartMissing = s.kind === 'chart' && s.getEl() === null && !s.fallbackTable;
                const on = selection.sections[s.id] !== false;

                return (
                  <div key={s.id} className="export-section-block">
                    <label className="export-check">
                      <input
                        type="checkbox"
                        checked={on && !chartMissing}
                        disabled={generating || chartMissing}
                        onChange={() => toggleSection(s.id)}
                      />
                      <span style={{ fontWeight: 600 }}>{s.title}</span>
                      <span className="export-check__meta">
                        {chartMissing
                          ? 'grafica no visible en la vista actual'
                          : s.kind === 'table'
                            ? `${s.rows.length} filas`
                            : s.kind === 'kpis'
                              ? `${s.items.length} indicadores`
                              : 'grafica'}
                      </span>
                    </label>

                    {on && table && table.columns.length > 0 && (
                      <div className="export-cols">
                        {table.columns.map((c) => {
                          const bloqueada = !permitirValores && c.money;
                          return (
                            <label
                              key={c.key}
                              className={`export-check export-check--col${bloqueada ? ' export-check--locked' : ''}`}
                              title={bloqueada ? 'Restringida por tu rol' : undefined}
                            >
                              <input
                                type="checkbox"
                                checked={!bloqueada && selection.columns[s.id]?.[c.key] !== false}
                                disabled={generating || bloqueada}
                                onChange={() => toggleColumn(s.id, c.key)}
                              />
                              <span>{c.header}</span>
                              {c.money && <span className="export-money-dot" title="Columna monetaria">$</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selection.format === 'pdf' && (
            <label className="export-check">
              <input
                type="checkbox"
                checked={selection.orientation === 'landscape'}
                disabled={generating}
                onChange={(e) => setOrientation(e.target.checked ? 'landscape' : 'portrait')}
              />
              <span>Orientacion horizontal</span>
              <span className="export-check__meta">recomendada con muchas columnas</span>
            </label>
          )}

          {warnings.length > 0 && (
            <div className="entidades-config-banner" style={{ background: '#fff7ed', borderColor: '#fdba74', color: '#9a3412' }}>
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              <span>{warnings.join(' ')}</span>
            </div>
          )}

          {error && (
            <div className="reportes-error">
              <AlertTriangle size={16} /> {error}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {resumen.secciones} {resumen.secciones === 1 ? 'seccion' : 'secciones'} · {resumen.filas.toLocaleString('es-CO')} filas
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={generating}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={generating || resumen.secciones === 0}
              onClick={() => onGenerate(selection.format, selection.orientation, selection)}
            >
              {generating ? (<><Loader2 size={14} className="spin" /> Generando…</>) : 'Generar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
