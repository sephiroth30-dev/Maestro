import React, { useState } from 'react';
import { RefreshCw, DollarSign, BarChart2, Users, Target, TrendingUp, Calendar, Award } from 'lucide-react';
import { useKpis, useEntidades, useCumplimientoSemanal, useDiasSemana } from '../api/reportes.js';
import KpiCard from '../components/widgets/KpiCard.js';
import ChartCumplimiento from '../components/widgets/ChartCumplimiento.js';
import ChartMixPagador from '../components/widgets/ChartMixPagador.js';
import ChartDiasSemana from '../components/widgets/ChartDiasSemana.js';
import TablaEntidades from '../components/widgets/TablaEntidades.js';

// ─── Month selector helper ────────────────────────────────────────────────────

const MESES_ES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface MesAnio {
  mes: number;
  anio: number;
  label: string;
}

function getLast6Months(): MesAnio[] {
  const now = new Date();
  const list: MesAnio[] = [];

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mes = d.getMonth() + 1;
    const anio = d.getFullYear();
    list.push({ mes, anio, label: `${MESES_ES[mes]} ${anio}` });
  }

  return list;
}

// ─── Filter types & helpers ───────────────────────────────────────────────────

type FilterMode = 'mes' | 'rango';

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPreset(preset: string): { start: string; end: string } {
  const today = new Date();

  switch (preset) {
    case 'hoy':
      return { start: fmt(today), end: fmt(today) };
    case 'ayer': {
      const ayer = new Date(today);
      ayer.setDate(today.getDate() - 1);
      return { start: fmt(ayer), end: fmt(ayer) };
    }
    case 'semana': {
      const dow = today.getDay(); // 0=Sun
      const mon = new Date(today);
      mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: fmt(mon), end: fmt(sun) };
    }
    case 'semana_pasada': {
      const dow = today.getDay(); // 0=Sun
      // Go back to last Monday
      const daysToLastMon = (dow === 0 ? 6 : dow - 1) + 7;
      const lastMon = new Date(today);
      lastMon.setDate(today.getDate() - daysToLastMon);
      const lastSun = new Date(lastMon);
      lastSun.setDate(lastMon.getDate() + 6);
      return { start: fmt(lastMon), end: fmt(lastSun) };
    }
    case '7dias': {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { start: fmt(start), end: fmt(today) };
    }
    case '30dias': {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      return { start: fmt(start), end: fmt(today) };
    }
    case 'anio': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { start: fmt(start), end: fmt(today) };
    }
    default:
      return { start: '', end: '' };
  }
}

function getCurrentMonthRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function KpiSkeleton(): React.ReactElement {
  return (
    <div className="kpi-card kpi-card--blue animate-pulse">
      <div className="kpi-skeleton-title" />
      <div className="kpi-skeleton-value" />
      <div className="kpi-skeleton-bar" />
    </div>
  );
}

function ChartSkeleton({ height = 300 }: { height?: number }): React.ReactElement {
  return (
    <div
      className="animate-pulse bg-gray-200 rounded"
      style={{ height }}
    />
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div className="reportes-error">
      <p>Error al cargar los datos.</p>
      <button type="button" className="btn btn--secondary" onClick={onRetry}>
        <RefreshCw size={14} />
        Reintentar
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Reportes(): React.ReactElement {
  const meses = getLast6Months();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const selected = meses[selectedIdx]!;

  // Filter mode state
  const [filterMode, setFilterMode] = useState<FilterMode>('mes');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');

  // Computed dates for API
  const apiStartDate = filterMode === 'rango' && rangeStart ? rangeStart : undefined;
  const apiEndDate = filterMode === 'rango' && rangeEnd ? rangeEnd : undefined;

  const kpisQ = useKpis(selected.mes, selected.anio, undefined, apiStartDate, apiEndDate);
  const entidadesQ = useEntidades(selected.mes, selected.anio, apiStartDate, apiEndDate);
  const cumplimientoQ = useCumplimientoSemanal(selected.mes, selected.anio, apiStartDate, apiEndDate);
  const diasQ = useDiasSemana(selected.mes, selected.anio);

  const isLoading = kpisQ.isLoading || entidadesQ.isLoading;
  const hasError = kpisQ.isError || entidadesQ.isError;

  function handleRefresh(): void {
    void kpisQ.refetch();
    void entidadesQ.refetch();
    void cumplimientoQ.refetch();
    void diasQ.refetch();
  }

  function handleModeSwitch(mode: FilterMode): void {
    setFilterMode(mode);
    if (mode === 'rango' && !rangeStart && !rangeEnd) {
      const { start, end } = getCurrentMonthRange();
      setRangeStart(start);
      setRangeEnd(end);
    }
  }

  function applyPreset(preset: string): void {
    const { start, end } = getPreset(preset);
    setRangeStart(start);
    setRangeEnd(end);
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header reportes-header">
        <div>
          <h1 className="page-title">Reportes de Facturación</h1>
          <p className="page-subtitle">Clínica Neurofic — Indicadores del período seleccionado</p>
        </div>
        <div className="reportes-header-controls">
          {/* Mode tabs */}
          <div className="filter-mode-tabs">
            <button
              type="button"
              className={`filter-mode-tab${filterMode === 'mes' ? ' filter-mode-tab--active' : ''}`}
              onClick={() => handleModeSwitch('mes')}
            >
              Mes
            </button>
            <button
              type="button"
              className={`filter-mode-tab${filterMode === 'rango' ? ' filter-mode-tab--active' : ''}`}
              onClick={() => handleModeSwitch('rango')}
            >
              Rango
            </button>
          </div>

          {/* Mes mode: month dropdown */}
          {filterMode === 'mes' && (
            <select
              className="reportes-month-select"
              value={selectedIdx}
              onChange={(e) => setSelectedIdx(Number(e.target.value))}
            >
              {meses.map((m, i) => (
                <option key={i} value={i}>
                  {m.label}
                </option>
              ))}
            </select>
          )}

          {/* Rango mode: presets + date inputs */}
          {filterMode === 'rango' && (
            <div className="filter-bar">
              <div className="preset-btns">
                <button type="button" className="preset-btn" onClick={() => applyPreset('hoy')}>
                  Hoy
                </button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('ayer')}>
                  Ayer
                </button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('semana')}>
                  Esta semana
                </button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('semana_pasada')}>
                  Sem. pasada
                </button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('7dias')}>
                  Últimos 7 días
                </button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('30dias')}>
                  Últimos 30 días
                </button>
                <button type="button" className="preset-btn preset-btn--accent" onClick={() => applyPreset('anio')}>
                  {new Date().getFullYear()}
                </button>
              </div>
              <div className="date-range-group">
                <input
                  type="date"
                  className="date-input"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  aria-label="Fecha inicio"
                />
                <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>—</span>
                <input
                  type="date"
                  className="date-input"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  aria-label="Fecha fin"
                />
              </div>
            </div>
          )}

          <button
            type="button"
            className="btn btn--secondary btn--icon"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Actualizar datos"
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {hasError && <ErrorState onRetry={handleRefresh} />}

      {/* KPI Row 1 — 4 cards */}
      <div className="kpi-grid kpi-grid--4">
        {kpisQ.isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : kpisQ.data ? (
          <>
            <KpiCard
              titulo="Facturación Bruta"
              valor={kpisQ.data.facturacion_bruta}
              formato="currency"
              meta={kpisQ.data.presupuesto}
              metaLabel="Meta"
              icon={<DollarSign size={16} />}
              color="blue"
            />
            <KpiCard
              titulo="Cumplimiento"
              valor={kpisQ.data.cumplimiento_pct}
              formato="percent"
              meta={100}
              metaLabel="Objetivo"
              icon={<Target size={16} />}
              color={kpisQ.data.cumplimiento_pct >= 100 ? 'green' : kpisQ.data.cumplimiento_pct >= 80 ? 'amber' : 'rose'}
            />
            <KpiCard
              titulo="Atenciones"
              valor={kpisQ.data.atenciones}
              formato="number"
              icon={<Users size={16} />}
              color="purple"
            />
            <KpiCard
              titulo="Ticket Promedio"
              valor={kpisQ.data.ticket_promedio}
              formato="currency"
              icon={<BarChart2 size={16} />}
              color="amber"
            />
          </>
        ) : null}
      </div>

      {/* KPI Row 2 — secondary stats (compact) */}
      <div className="kpi-grid kpi-grid--3 kpi-grid--sm">
        {kpisQ.isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : kpisQ.data ? (
          <>
            <KpiCard
              titulo="Cierre Proyectado"
              valor={kpisQ.data.proyeccion_cierre}
              formato="currency"
              meta={kpisQ.data.presupuesto}
              metaLabel="Meta"
              icon={<TrendingUp size={14} />}
              color="blue"
            />
            <KpiCard
              titulo="Facturación Hoy"
              valor={kpisQ.data.facturacion_hoy}
              formato="currency"
              icon={<Calendar size={14} />}
              color="green"
            />
            <KpiCard
              titulo="Semanas en Meta"
              valor={kpisQ.data.semanas_en_meta}
              formato="number"
              meta={kpisQ.data.semanas_total}
              metaLabel={`de ${kpisQ.data.semanas_total} sem.`}
              icon={<Award size={14} />}
              color="purple"
            />
          </>
        ) : null}
      </div>

      {/* Charts Row 1: Cumplimiento semanal + Mix pagador */}
      <div className="charts-row">
        <div className="chart-card chart-card--2-3">
          <h2 className="chart-title">Cumplimiento Semanal</h2>
          {cumplimientoQ.isLoading ? (
            <ChartSkeleton />
          ) : cumplimientoQ.isError ? (
            <ErrorState onRetry={() => void cumplimientoQ.refetch()} />
          ) : cumplimientoQ.data ? (
            <ChartCumplimiento semanas={cumplimientoQ.data.semanas} />
          ) : null}
        </div>

        <div className="chart-card chart-card--1-3">
          <h2 className="chart-title">Mix Pagador</h2>
          {entidadesQ.isLoading ? (
            <ChartSkeleton />
          ) : entidadesQ.isError ? (
            <ErrorState onRetry={() => void entidadesQ.refetch()} />
          ) : entidadesQ.data ? (
            <ChartMixPagador rows={entidadesQ.data.rows} />
          ) : null}
        </div>
      </div>

      {/* Charts Row 2: Días de semana (smaller) + Tabla entidades (wider) */}
      <div className="charts-row charts-row--dias-entidades">
        <div className="chart-card">
          <h2 className="chart-title">Promedio por Día de Semana</h2>
          {diasQ.isLoading ? (
            <ChartSkeleton height={200} />
          ) : diasQ.isError ? (
            <ErrorState onRetry={() => void diasQ.refetch()} />
          ) : diasQ.data ? (
            <ChartDiasSemana rows={diasQ.data} />
          ) : null}
        </div>

        <div className="chart-card">
          <h2 className="chart-title">Facturación por Entidad</h2>
          {entidadesQ.isLoading ? (
            <ChartSkeleton />
          ) : entidadesQ.isError ? (
            <ErrorState onRetry={() => void entidadesQ.refetch()} />
          ) : entidadesQ.data ? (
            <TablaEntidades rows={entidadesQ.data.rows} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
