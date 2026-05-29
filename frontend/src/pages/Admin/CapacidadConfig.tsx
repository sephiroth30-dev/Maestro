import React, { useState, useEffect, useMemo } from 'react';
import { Settings2, Loader2, AlertCircle, Save, Trash2 } from 'lucide-react';
import {
  useCapacidadConfig,
  useUpsertCapacidadBulk,
  useDeleteCapacidad,
} from '../../api/capacidad.js';
import type { CapacidadConfig } from '../../types/index.js';

// ─── Fixed group list ─────────────────────────────────────────────────────────

interface GrupoMeta {
  grupo: string;
  nombre: string;
}

const GRUPOS: GrupoMeta[] = [
  { grupo: 'emg_vcn',                       nombre: 'EMG / VCN' },
  { grupo: 'eeg',                            nombre: 'Electroencefalograma' },
  { grupo: 'tlm',                            nombre: 'Videotelemetría (TLM)' },
  { grupo: 'psg_lms',                        nombre: 'Polisomnografía / LMS' },
  { grupo: 'pe',                             nombre: 'Potenciales Evocados' },
  { grupo: 'consulta_fisiatria',             nombre: 'Consulta Medicina Física' },
  { grupo: 'consulta_neurologia',            nombre: 'Consulta Neurología' },
  { grupo: 'consulta_neurologia_pediatrica', nombre: 'Consulta Neurología Pediátrica' },
  { grupo: 'infiltracion',                   nombre: 'Infiltración / Toxina' },
  { grupo: 'junta',                          nombre: 'Junta de Profesionales' },
  { grupo: 'terapia_choque',                 nombre: 'Terapia Ondas de Choque' },
  { grupo: 'ecografia',                      nombre: 'Ecografía como Guía' },
];

const ANIOS = Array.from({ length: 7 }, (_, i) => 2023 + i);
const MESES_IDX = Array.from({ length: 12 }, (_, i) => i + 1);

// ─── Row state for the form ───────────────────────────────────────────────────

interface RowState {
  grupo: string;
  nombre: string;
  capacidad: string; // string for input
  recursos: string;
  editing: boolean;
  saved: CapacidadConfig | null; // existing DB record for this year (any month)
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CapacidadConfig(): React.ReactElement {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());

  const { data: configs = [], isLoading, isError } = useCapacidadConfig(anio);
  const bulkUpsert = useUpsertCapacidadBulk();
  const deleteOne = useDeleteCapacidad();

  // Build local row states — one per group, using mes_idx=1 as the "annual" value
  const [rows, setRows] = useState<RowState[]>([]);

  // Helper: find the saved config for this group (we use mes_idx=1 as representative)
  const savedByGrupo = useMemo(() => {
    const map = new Map<string, CapacidadConfig>();
    // Take any record per group; prefer mes_idx=1 as canonical
    for (const c of configs) {
      const existing = map.get(c.grupo);
      if (!existing || c.mesIdx === 1) {
        map.set(c.grupo, c);
      }
    }
    return map;
  }, [configs]);

  // Re-init rows when configs or anio changes
  useEffect(() => {
    setRows(
      GRUPOS.map((g) => {
        const saved = savedByGrupo.get(g.grupo) ?? null;
        return {
          grupo: g.grupo,
          nombre: g.nombre,
          capacidad: saved ? String(saved.capacidad) : '',
          recursos: saved?.recursos ?? '',
          editing: false,
          saved,
        };
      })
    );
  }, [savedByGrupo]);

  const setRow = (grupo: string, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.grupo === grupo ? { ...r, ...patch } : r)));
  };

  const handleBulkSave = () => {
    const validRows = rows.filter(
      (r) => r.capacidad.trim() !== '' && !isNaN(Number(r.capacidad)) && Number(r.capacidad) >= 0
    );
    if (validRows.length === 0) return;

    const payload = validRows.flatMap((r) =>
      MESES_IDX.map((mesIdx) => ({
        grupo: r.grupo,
        nombre: r.nombre,
        anio,
        mesIdx,
        capacidad: Number(r.capacidad),
        recursos: r.recursos.trim() || null,
      }))
    );

    bulkUpsert.mutate({ rows: payload });
  };

  const handleRowSave = (r: RowState) => {
    if (r.capacidad.trim() === '' || isNaN(Number(r.capacidad))) return;

    const payload = MESES_IDX.map((mesIdx) => ({
      grupo: r.grupo,
      nombre: r.nombre,
      anio,
      mesIdx,
      capacidad: Number(r.capacidad),
      recursos: r.recursos.trim() || null,
    }));

    bulkUpsert.mutate(
      { rows: payload },
      { onSuccess: () => setRow(r.grupo, { editing: false }) }
    );
  };

  const handleRowDelete = (r: RowState) => {
    if (!r.saved) return;
    // Delete all 12 months for this group/year
    MESES_IDX.forEach((mesIdx) => {
      deleteOne.mutate({ grupo: r.grupo, anio, mesIdx });
    });
    setRow(r.grupo, { capacidad: '', recursos: '', editing: false, saved: null });
  };

  return (
    <div className="page">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings2 size={22} style={{ color: '#3b82f6' }} />
          Configuración de Capacidad
        </h1>
        <p className="page-subtitle">
          Define la capacidad mensual (sesiones) por grupo de servicio para el año seleccionado.
          El valor aplica a todos los meses del año.
        </p>
      </div>

      {/* ── Year selector ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Año:</label>
        <select
          className="form-input"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          style={{ width: '110px' }}
        >
          {ANIOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* ── States ──────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="page-loading">
          <Loader2 size={22} className="spin" style={{ color: '#3b82f6' }} />
          <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando configuración…</p>
        </div>
      )}
      {isError && (
        <div className="reportes-error">
          <AlertCircle size={16} />
          Error al cargar la configuración.
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <>
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th className="data-table-th" style={{ minWidth: '200px' }}>Servicio</th>
                  <th className="data-table-th" style={{ width: '140px' }}>Capacidad mensual</th>
                  <th className="data-table-th">Descripción / Recursos</th>
                  <th className="data-table-th" style={{ width: '160px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.grupo} className="data-table-tr">
                    {/* Servicio */}
                    <td className="data-table-td">
                      <span style={{ fontWeight: 500, fontSize: '13px' }}>{r.nombre}</span>
                      <br />
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>{r.grupo}</span>
                    </td>

                    {/* Capacidad */}
                    <td className="data-table-td">
                      {r.editing ? (
                        <input
                          type="number"
                          className="form-input"
                          min={0}
                          max={32767}
                          value={r.capacidad}
                          onChange={(e) => setRow(r.grupo, { capacidad: e.target.value })}
                          style={{ width: '100px' }}
                          autoFocus
                        />
                      ) : (
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: '15px',
                            color: r.saved ? '#1e293b' : '#94a3b8',
                          }}
                        >
                          {r.saved ? r.capacidad : '—'}
                        </span>
                      )}
                    </td>

                    {/* Recursos */}
                    <td className="data-table-td">
                      {r.editing ? (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ej: 2 equipos, sala A"
                          value={r.recursos}
                          onChange={(e) => setRow(r.grupo, { recursos: e.target.value })}
                          style={{ width: '100%', minWidth: '180px' }}
                        />
                      ) : (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {r.recursos || '—'}
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="data-table-td">
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {r.editing ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--primary"
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                              disabled={
                                bulkUpsert.isPending ||
                                r.capacidad.trim() === '' ||
                                isNaN(Number(r.capacidad))
                              }
                              onClick={() => handleRowSave(r)}
                            >
                              {bulkUpsert.isPending ? (
                                <Loader2 size={12} className="spin" />
                              ) : (
                                <Save size={12} />
                              )}{' '}
                              Guardar
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                              onClick={() =>
                                setRow(r.grupo, {
                                  editing: false,
                                  capacidad: r.saved ? String(r.saved.capacidad) : '',
                                  recursos: r.saved?.recursos ?? '',
                                })
                              }
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                              onClick={() => setRow(r.grupo, { editing: true })}
                            >
                              Editar
                            </button>
                            {r.saved && (
                              <button
                                type="button"
                                className="btn"
                                style={{
                                  fontSize: '12px',
                                  padding: '4px 10px',
                                  background: '#fee2e2',
                                  color: '#ef4444',
                                  border: '1px solid #fecaca',
                                }}
                                onClick={() => handleRowDelete(r)}
                                title="Eliminar configuración de este grupo para el año"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Bulk save button ──────────────────────────────────────────────── */}
          <div
            style={{
              marginTop: '20px',
              padding: '16px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <p style={{ fontWeight: 500, fontSize: '13px', color: '#374151', margin: 0 }}>
                Guardar configuración completa
              </p>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>
                Guarda todos los grupos con capacidad definida — aplica el mismo valor a los 12 meses
                del año {anio}.
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              disabled={
                bulkUpsert.isPending ||
                rows.every((r) => r.capacidad.trim() === '')
              }
              onClick={handleBulkSave}
            >
              {bulkUpsert.isPending ? (
                <><Loader2 size={14} className="spin" /> Guardando…</>
              ) : (
                <><Save size={14} /> Guardar configuración completa</>
              )}
            </button>
          </div>

          {bulkUpsert.isError && (
            <div className="reportes-error" style={{ marginTop: '12px' }}>
              <AlertCircle size={14} />
              Error al guardar. Verifica los datos e intenta nuevamente.
            </div>
          )}

          {bulkUpsert.isSuccess && (
            <div
              style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: '#d1fae5',
                border: '1px solid #6ee7b7',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#065f46',
              }}
            >
              Configuración guardada correctamente.
            </div>
          )}
        </>
      )}

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '20px' }}>
        Los valores se aplican a todos los meses del año seleccionado. Para valores mensuales
        diferentes, edita cada mes individualmente desde la vista de utilización.
      </p>
    </div>
  );
}
