import React, { useState, useMemo } from 'react';
import { BarChart2, Loader2, AlertCircle } from 'lucide-react';
import { useUtilizacion } from '../api/capacidad.js';
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

function GrupoCard({ g }: { g: UtilizacionGrupo }) {
  const status = getStatus(g.pctOcupacion);
  const pct = g.pctOcupacion ?? 0;
  const barWidth = Math.min(pct, 100);

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
        <span>
          <strong style={{ color: '#1e293b' }}>{g.sesiones}</strong> sesiones
        </span>
        {g.capacidad !== null && (
          <span>
            cap. <strong style={{ color: '#1e293b' }}>{g.capacidad}</strong>
          </span>
        )}
        {g.disponible !== null && (
          <span>
            disp. <strong style={{ color: '#1e293b' }}>{g.disponible}</strong>
          </span>
        )}
      </div>
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

  const { data: grupos = [], isLoading, isError } = useUtilizacion(anio, mes);

  const kpis = useMemo(() => {
    const totalSesiones = grupos.reduce((s, g) => s + g.sesiones, 0);
    const gruposConCap = grupos.filter((g) => g.capacidad !== null && g.capacidad > 0);
    const totalCapacidad = gruposConCap.reduce((s, g) => s + (g.capacidad ?? 0), 0);
    const pctGlobal =
      totalCapacidad > 0 ? Math.round((totalSesiones / totalCapacidad) * 100) : null;
    return { totalSesiones, totalCapacidad, pctGlobal, gruposConCap: gruposConCap.length };
  }, [grupos]);

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
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <KpiChip
          label="Total sesiones"
          value={kpis.totalSesiones.toLocaleString('es-CO')}
          sub={`${MESES[mes]} ${anio}`}
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

      {/* Footer note */}
      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '20px' }}>
        La ocupación se calcula como sesiones únicas (paciente + fecha) vs. capacidad mensual
        configurada por grupo de servicio. Configura la capacidad en{' '}
        <strong>Admin › Cap. Instalada</strong>.
      </p>
    </div>
  );
}
