import React, { useState, useMemo } from 'react';
import { BarChart2, Loader2, AlertCircle, CalendarRange } from 'lucide-react';
import { useUtilizacion, useUtilizacionRango } from '../api/capacidad.js';
import { ExportButton } from '../export/index.js';
import { HelpButton } from '../help/HelpButton.js';
import { buildCapacidadDoc } from '../export/docs/capacidadDoc.js';
import type { UtilizacionGrupo } from '../types/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const ANIOS = Array.from({ length: 7 }, (_, i) => 2023 + i);

// ─── Status helpers ───────────────────────────────────────────────────────────

interface StatusCfg {
  label: string;
  badgeCls: string;
  color: string;
  bgColor: string;
}

function getStatus(pct: number | null): StatusCfg {
  if (pct === null) {
    return {
      label: 'Sin configurar',
      badgeCls: 'badge badge--gray',
      color: '#94a3b8',
      bgColor: '#e2e8f0',
    };
  }
  if (pct < 30) {
    return {
      label: 'Baja ocupación',
      badgeCls: 'badge badge--blue',
      color: '#3b82f6',
      bgColor: '#dbeafe',
    };
  }
  if (pct < 60) {
    return {
      label: 'Moderada',
      badgeCls: 'badge badge--yellow',
      color: '#f59e0b',
      bgColor: '#fef3c7',
    };
  }
  if (pct < 90) {
    return {
      label: 'Óptima',
      badgeCls: 'badge badge--emerald',
      color: '#10b981',
      bgColor: '#d1fae5',
    };
  }
  return {
    label: 'Máxima capacidad',
    badgeCls: 'badge badge--red',
    color: '#ef4444',
    bgColor: '#fee2e2',
  };
}

// ─── Service group card ───────────────────────────────────────────────────────

/**
 * Sustantivo de cada base. La tarjeta tiene que decir *qué* está contando: la
 * versión anterior mostraba un número escueto rotulado «sesiones», y como en
 * Potenciales Evocados eso eran visitas (56) mientras el área reportaba estudios
 * (151), las dos cifras parecían contradecirse sin que nada explicara por qué.
 */
const SUSTANTIVO: Record<UtilizacionGrupo['base'], string> = {
  pacientes: 'visitas',
  estudios: 'estudios',
};

function GrupoCard({ g }: { g: UtilizacionGrupo }) {
  const status = getStatus(g.pctOcupacion);
  const pct = g.pctOcupacion ?? 0;
  const barWidth = Math.min(pct, 100);

  const esEstudios = g.base === 'estudios';
  const otra = esEstudios ? g.pacientes : g.estudios;
  const nombreOtra = esEstudios ? SUSTANTIVO.pacientes : SUSTANTIVO.estudios;
  // Con una sola atención por visita las dos cifras coinciden y repetirla solo
  // añade ruido.
  const mostrarOtra = otra !== g.sesiones;

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b', lineHeight: 1.3 }}>
          {g.nombre}
        </span>
        <span className={status.badgeCls} style={{ flexShrink: 0, fontSize: '11px' }}>
          {status.label}
        </span>
      </div>

      {/* Large percentage */}
      <div style={{ fontSize: '28px', fontWeight: 700, color: status.color, lineHeight: 1 }}>
        {g.pctOcupacion !== null ? `${g.pctOcupacion}%` : '—'}
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: '8px',
          borderRadius: '4px',
          background: '#f1f5f9',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${barWidth}%`,
            borderRadius: '4px',
            background: g.pctOcupacion !== null
              ? `linear-gradient(90deg, ${status.bgColor}, ${status.color})`
              : '#e2e8f0',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b' }}>
        <span title={`Este grupo mide su ocupación en ${SUSTANTIVO[g.base]}`}>
          <strong style={{ color: '#1e293b' }}>{g.sesiones.toLocaleString('es-CO')}</strong>{' '}
          {SUSTANTIVO[g.base]}
        </span>
        {g.capacidad !== null && (
          <span>
            cap. <strong style={{ color: '#1e293b' }}>{g.capacidad.toLocaleString('es-CO')}</strong>
          </span>
        )}
        {g.disponible !== null && (
          <span>
            disp. <strong style={{ color: '#1e293b' }}>{g.disponible.toLocaleString('es-CO')}</strong>
          </span>
        )}
      </div>

      {/* La otra cifra, para poder conciliar con Mix por Servicio sin salir de aquí */}
      {(mostrarOtra || g.sinPaciente > 0) && (
        <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {mostrarOtra && (
            <span title="Cifra informativa: no interviene en el porcentaje de ocupación">
              {otra.toLocaleString('es-CO')} {nombreOtra}
            </span>
          )}
          {g.sinPaciente > 0 && (
            <span
              style={{ color: '#b45309' }}
              title={
                `${g.sinPaciente} registros llegaron sin nombre ni documento de paciente. ` +
                'Sin identificación no se pueden agrupar por visita, así que cada uno cuenta ' +
                'como una visita propia y el conteo de visitas queda por encima del real.'
              }
            >
              <AlertCircle size={11} style={{ verticalAlign: '-1px' }} />{' '}
              {g.sinPaciente.toLocaleString('es-CO')} sin identificar
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KPI chip ─────────────────────────────────────────────────────────────────

function KpiChip({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '12px 18px',
        minWidth: '120px',
        flex: '1',
      }}
    >
      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500, marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Capacidad(): React.ReactElement {
  const now = new Date();
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  // Modo rango: para ver y exportar varios meses de una vez. Las tarjetas
  // siguen mostrando el mes final del rango, que es el estado actual; el
  // histórico va en la tabla y en el archivo exportado.
  const [modoRango, setModoRango] = useState(false);
  const [desdeAnio, setDesdeAnio] = useState(now.getFullYear());
  const [desdeMes, setDesdeMes] = useState(1);

  const { data: grupos = [], isLoading, isError } = useUtilizacion(anio, mes);
  const { data: historico = [], isLoading: cargandoRango } = useUtilizacionRango(
    desdeAnio, desdeMes, anio, mes, modoRango,
  );

  const kpis = useMemo(() => {
    // `sesiones` ya viene en la base de cada grupo, así que la suma es
    // comparable contra la capacidad total aunque los grupos midan distinto.
    const totalSesiones = grupos.reduce((s, g) => s + g.sesiones, 0);
    const totalVisitas = grupos.reduce((s, g) => s + g.pacientes, 0);
    const totalEstudios = grupos.reduce((s, g) => s + g.estudios, 0);
    const totalSinPaciente = grupos.reduce((s, g) => s + g.sinPaciente, 0);
    const gruposPorEstudios = grupos.filter((g) => g.base === 'estudios').length;
    const gruposConCap = grupos.filter((g) => g.capacidad !== null && g.capacidad > 0);
    const totalCapacidad = gruposConCap.reduce((s, g) => s + (g.capacidad ?? 0), 0);
    const pctGlobal =
      totalCapacidad > 0 ? Math.round((totalSesiones / totalCapacidad) * 100) : null;
    return {
      totalSesiones, totalVisitas, totalEstudios, totalSinPaciente,
      gruposPorEstudios, totalCapacidad, pctGlobal, gruposConCap: gruposConCap.length,
    };
  }, [grupos]);

  const etiquetaPeriodo = modoRango
    ? `${MESES[desdeMes]} ${desdeAnio} — ${MESES[mes]} ${anio}`
    : `${MESES[mes]} ${anio}`;

  const buildExportDoc = useMemo(() => () => buildCapacidadDoc({
    periodLabel: etiquetaPeriodo,
    filters: [{ label: 'Período', value: etiquetaPeriodo }],
    grupos,
    kpis,
    estadoDe: (pct) => getStatus(pct).label,
    ...(modoRango && { historico, nombreMes: (m: number) => MESES[m] ?? String(m) }),
  }), [etiquetaPeriodo, grupos, kpis, modoRango, historico]);

  return (
    <div className="page">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={22} style={{ color: '#3b82f6' }} />
            Capacidad Instalada
          </h1>
          <p className="page-subtitle">
            Utilización de servicios vs. capacidad instalada
          </p>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {modoRango && (
            <>
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-input"
                  value={desdeMes}
                  onChange={(e) => setDesdeMes(Number(e.target.value))}
                  aria-label="Mes inicial"
                  style={{ minWidth: '130px' }}
                >
                  {MESES.slice(1).map((nombre, i) => (
                    <option key={i + 1} value={i + 1}>{nombre}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-input"
                  value={desdeAnio}
                  onChange={(e) => setDesdeAnio(Number(e.target.value))}
                  aria-label="Año inicial"
                  style={{ minWidth: '90px' }}
                >
                  {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <span style={{ color: '#94a3b8' }}>—</span>
            </>
          )}
          <div className="form-group" style={{ margin: 0 }}>
            <select
              className="form-input"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              style={{ minWidth: '130px' }}
            >
              {MESES.slice(1).map((nombre, i) => (
                <option key={i + 1} value={i + 1}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <select
              className="form-input"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              style={{ minWidth: '90px' }}
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={`preset-btn${modoRango ? ' preset-btn--active' : ''}`}
            onClick={() => setModoRango((v) => !v)}
            title="Ver y exportar varios meses a la vez"
          >
            <CalendarRange size={13} /> {modoRango ? 'Un solo mes' : 'Rango de meses'}
          </button>
          <HelpButton articulo="capacidad" />
          <ExportButton
            buildDoc={buildExportDoc}
            disabled={isLoading || (modoRango && cargandoRango)}
          />
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <KpiChip
          label="Demanda total"
          value={kpis.totalSesiones.toLocaleString('es-CO')}
          sub={
            kpis.totalVisitas === kpis.totalEstudios
              ? `${MESES[mes]} ${anio}`
              : `${kpis.totalVisitas.toLocaleString('es-CO')} visitas · ` +
                `${kpis.totalEstudios.toLocaleString('es-CO')} estudios`
          }
        />
        <KpiChip
          label="Capacidad total"
          value={kpis.totalCapacidad > 0 ? kpis.totalCapacidad.toLocaleString('es-CO') : '—'}
          sub={kpis.gruposConCap > 0 ? `${kpis.gruposConCap} grupos configurados` : 'Sin configurar'}
        />
        <KpiChip
          label="Ocupación global"
          value={kpis.pctGlobal !== null ? `${kpis.pctGlobal}%` : '—'}
          sub={kpis.pctGlobal !== null ? getStatus(kpis.pctGlobal).label : 'Configura capacidad'}
        />
      </div>

      {/* ── States ──────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="page-loading">
          <Loader2 size={24} className="spin" style={{ color: '#3b82f6' }} />
          <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando datos de utilización…</p>
        </div>
      )}
      {isError && (
        <div className="reportes-error">
          <AlertCircle size={16} />
          Error al cargar los datos de utilización.
        </div>
      )}

      {/* ── Grid of cards ───────────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '16px',
          }}
        >
          {grupos.map((g) => (
            <GrupoCard key={g.grupo} g={g} />
          ))}
        </div>
      )}

      {/* ── Histórico mes a mes (modo rango) ──────────────────────────────── */}
      {modoRango && (
        <div className="chart-card" style={{ marginTop: '24px' }}>
          <h2 className="chart-title">Utilización mes a mes</h2>
          <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 10px' }}>
            {etiquetaPeriodo}. Solo aparecen los meses con actividad o con capacidad
            configurada. Las tarjetas de arriba siguen mostrando {MESES[mes]} {anio}.
          </p>
          {cargandoRango ? (
            <div className="page-loading" style={{ padding: '2rem 0' }}>
              <Loader2 size={22} className="spin" style={{ color: '#3b82f6' }} />
            </div>
          ) : historico.length === 0 ? (
            <p style={{ color: '#94a3b8', padding: '1rem 0' }}>
              No hay datos en el rango seleccionado.
            </p>
          ) : (
            <div className="tabla-entidades-wrapper">
              <table className="tabla-entidades-table">
                <thead>
                  <tr>
                    <th className="tabla-entidades-th">PERÍODO</th>
                    <th className="tabla-entidades-th">SERVICIO</th>
                    <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>CAPACIDAD</th>
                    <th className="tabla-entidades-th" style={{ textAlign: 'center' }}>BASE</th>
                    <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>DEMANDA</th>
                    <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>VISITAS</th>
                    <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>ESTUDIOS</th>
                    <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>OCUPACIÓN</th>
                    <th className="tabla-entidades-th" style={{ textAlign: 'center' }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((r) => {
                    const st = getStatus(r.pctOcupacion);
                    return (
                      <tr key={`${r.anio}-${r.mesIdx}-${r.grupo}`} className="tabla-entidades-tr">
                        <td className="tabla-entidades-td" style={{ whiteSpace: 'nowrap' }}>
                          {MESES[r.mesIdx]} {r.anio}
                        </td>
                        <td className="tabla-entidades-td tabla-entidades-nombre">{r.nombre}</td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
                          {r.capacidad !== null ? r.capacidad.toLocaleString('es-CO') : '—'}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'center', color: '#64748b' }}>
                          {SUSTANTIVO[r.base]}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {r.sesiones.toLocaleString('es-CO')}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
                          {r.pacientes.toLocaleString('es-CO')}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>
                          {r.estudios.toLocaleString('es-CO')}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>
                          {r.pctOcupacion !== null ? `${r.pctOcupacion}%` : '—'}
                        </td>
                        <td className="tabla-entidades-td" style={{ textAlign: 'center' }}>
                          <span className={st.badgeCls}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '20px', maxWidth: '70ch', lineHeight: 1.55 }}>
        Cada grupo compara su capacidad mensual contra una de dos cifras, según dónde esté su
        cuello de botella: <strong>visitas</strong> (paciente + fecha, de modo que EMG y VCN en la
        misma cita cuentan como un solo hueco de agenda) o <strong>estudios</strong> (registros
        facturados, porque en Potenciales Evocados una visita cubre varias modalidades y cada una
        consume equipo y lectura por separado). La tarjeta rotula la que usa y muestra la otra
        debajo, para poder conciliarla con <strong>Reportes › Mix por Servicio</strong>.
        {kpis.gruposPorEstudios > 0 && ` Hoy ${kpis.gruposPorEstudios === 1 ? 'un grupo mide' : `${kpis.gruposPorEstudios} grupos miden`} en estudios.`}
        {kpis.totalSinPaciente > 0 && (
          <>
            {' '}Atención: {kpis.totalSinPaciente.toLocaleString('es-CO')} registros del período
            llegaron sin identificación de paciente y no se pueden agrupar por visita.
          </>
        )}
        {' '}La capacidad se configura en <strong>Admin › Cap. Instalada</strong>.
      </p>
    </div>
  );
}
