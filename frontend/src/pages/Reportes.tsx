import React, { useState } from 'react';
import { RefreshCw, DollarSign, BarChart2, Users, Target, Calendar, Award, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { useKpis, useEntidades, useCumplimientoSemanal, useDiasSemana } from '../api/reportes.js';
import type { DiaSemanaRow } from '../api/reportes.js';
import KpiCard from '../components/widgets/KpiCard.js';
import ChartCumplimiento from '../components/widgets/ChartCumplimiento.js';
import ChartMixPagador from '../components/widgets/ChartMixPagador.js';
import TablaEntidades from '../components/widgets/TablaEntidades.js';

// ─── Month selector helper ────────────────────────────────────────────────────

const MESES_ES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIA_NOMBRES: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes',
};

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

// Returns the most recent occurrence of a weekday (0=Sun…6=Sat) within a date range
function getMostRecentWeekday(diaNum: number, periodStart: string, periodEnd: string): string {
  const end   = new Date(periodEnd   + 'T12:00:00Z');
  const start = new Date(periodStart + 'T12:00:00Z');
  const d = new Date(end);
  for (let i = 0; i < 7; i++) {
    if (d.getUTCDay() === diaNum && d >= start) {
      return d.toISOString().slice(0, 10);
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return periodEnd;
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
      const dow = today.getDay();
      const mon = new Date(today);
      mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return { start: fmt(mon), end: fmt(sun) };
    }
    case 'semana_pasada': {
      const dow = today.getDay();
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
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: fmt(firstDay), end: fmt(lastDay) };
}

// ─── Días de semana mini card ─────────────────────────────────────────────────

interface DiasSemanaMiniProps {
  rows: DiaSemanaRow[];
  selectedDia: number | null;
  onDayClick: (diaNum: number) => void;
}

function DiasSemanaMini({ rows, selectedDia, onDayClick }: DiasSemanaMiniProps): React.ReactElement {
  const maxVal = Math.max(...rows.map((r) => r.total), 1);
  const fmtShort = (n: number): string =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

  function getBarColor(r: DiaSemanaRow): string {
    if (selectedDia !== null) {
      return r.dia_num === selectedDia ? '#1d4ed8' : '#bfdbfe';
    }
    const isMax = r.total === maxVal;
    return isMax ? '#2563eb' : '#93c5fd';
  }

  return (
    <div className="kpi-card kpi-card--blue" style={{ cursor: 'default' }}>
      <div className="kpi-card-header" style={{ justifyContent: 'space-between' }}>
        <span className="kpi-card-title">Facturado por día</span>
        {selectedDia !== null && (
          <span style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600 }}>
            {DIA_NOMBRES[selectedDia]}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart
          data={rows}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
          barCategoryGap="20%"
          onClick={(payload) => {
            if (payload?.activePayload?.[0]) {
              const diaNum = (payload.activePayload[0].payload as DiaSemanaRow).dia_num;
              onDayClick(diaNum);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <XAxis
            dataKey="dia"
            tickFormatter={(v: string) => v.slice(0, 3)}
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={[0, maxVal * 1.15]} />
          <RechartTooltip
            formatter={(val: number) => [fmtShort(val), 'Total']}
            contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
            cursor={{ fill: '#f1f5f9' }}
          />
          <Bar dataKey="total" radius={[3, 3, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.dia_num} fill={getBarColor(r)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: '0.62rem', color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>
        Haz clic en un día para filtrar
      </p>
    </div>
  );
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
  return <div className="animate-pulse bg-gray-200 rounded" style={{ height }} />;
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

  const [filterMode, setFilterMode] = useState<FilterMode>('mes');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd,   setRangeEnd]   = useState<string>('');

  // Day-of-week click filter (dia_num: 1=Mon…5=Fri, null=off)
  const [selectedDia, setSelectedDia] = useState<number | null>(null);

  // The full period bounds (used by diasQ — never overridden by day filter)
  const periodStart = filterMode === 'rango' && rangeStart ? rangeStart : undefined;
  const periodEnd   = filterMode === 'rango' && rangeEnd   ? rangeEnd   : undefined;

  // When a day is selected, resolve its most recent date within the period
  function resolveDayDate(): string | null {
    if (selectedDia === null) return null;
    const pStart = periodStart ?? fmt(new Date(selected.anio, selected.mes - 1, 1));
    const pEnd   = periodEnd   ?? fmt(new Date(selected.anio, selected.mes, 0));
    return getMostRecentWeekday(selectedDia, pStart, pEnd);
  }

  const dayDate = resolveDayDate();

  // API dates: overridden by day-click when active
  const apiStartDate = dayDate ?? periodStart;
  const apiEndDate   = dayDate ?? periodEnd;

  const kpisQ       = useKpis(selected.mes, selected.anio, undefined, apiStartDate, apiEndDate);
  const entidadesQ  = useEntidades(selected.mes, selected.anio, apiStartDate, apiEndDate);
  const cumplimientoQ = useCumplimientoSemanal(selected.mes, selected.anio, apiStartDate, apiEndDate);
  // diasQ always uses the full period so bars don't collapse to a single day
  const diasQ = useDiasSemana(selected.mes, selected.anio, periodStart, periodEnd);

  const isLoading = kpisQ.isLoading || entidadesQ.isLoading;
  const hasError  = kpisQ.isError  || entidadesQ.isError;

  function clearDayFilter(): void { setSelectedDia(null); }

  function handleDayClick(diaNum: number): void {
    setSelectedDia((prev) => (prev === diaNum ? null : diaNum));
  }

  function handleRefresh(): void {
    void kpisQ.refetch();
    void entidadesQ.refetch();
    void cumplimientoQ.refetch();
    void diasQ.refetch();
  }

  function handleModeSwitch(mode: FilterMode): void {
    setFilterMode(mode);
    setSelectedDia(null);
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
    setSelectedDia(null);
  }

  // Format the day-filter badge label
  const diaLabel = selectedDia !== null
    ? `${DIA_NOMBRES[selectedDia] ?? ''}${dayDate ? ` — ${dayDate.split('-').reverse().join('/')}` : ''}`
    : null;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header reportes-header">
        <div>
          <h1 className="page-title">Reportes de Facturación</h1>
          <p className="page-subtitle">Clínica Neurofic — Indicadores del período seleccionado</p>
        </div>
        <div className="reportes-header-controls">
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

          {filterMode === 'mes' && (
            <select
              className="reportes-month-select"
              value={selectedIdx}
              onChange={(e) => { setSelectedIdx(Number(e.target.value)); setSelectedDia(null); }}
            >
              {meses.map((m, i) => (
                <option key={i} value={i}>{m.label}</option>
              ))}
            </select>
          )}

          {filterMode === 'rango' && (
            <div className="filter-bar">
              <div className="preset-btns">
                <button type="button" className="preset-btn" onClick={() => applyPreset('hoy')}>Hoy</button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('ayer')}>Ayer</button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('semana')}>Esta semana</button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('semana_pasada')}>Sem. pasada</button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('7dias')}>Últimos 7 días</button>
                <button type="button" className="preset-btn" onClick={() => applyPreset('30dias')}>Últimos 30 días</button>
                <button type="button" className="preset-btn preset-btn--accent" onClick={() => applyPreset('anio')}>
                  {new Date().getFullYear()}
                </button>
              </div>
              <div className="date-range-group">
                <input
                  type="date"
                  className="date-input"
                  value={rangeStart}
                  onChange={(e) => { setRangeStart(e.target.value); setSelectedDia(null); }}
                  aria-label="Fecha inicio"
                />
                <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>—</span>
                <input
                  type="date"
                  className="date-input"
                  value={rangeEnd}
                  onChange={(e) => { setRangeEnd(e.target.value); setSelectedDia(null); }}
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

      {/* Day filter badge */}
      {diaLabel && (
        <div className="dia-filter-badge">
          <span>Filtrando por día: <strong>{diaLabel}</strong></span>
          <button type="button" onClick={clearDayFilter} className="dia-filter-clear" title="Quitar filtro">
            <X size={13} />
          </button>
        </div>
      )}

      {hasError && <ErrorState onRetry={handleRefresh} />}

      {/* KPI Row 1 — 4 cards */}
      <div className="kpi-grid kpi-grid--4">
        {kpisQ.isLoading ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : kpisQ.data ? (
          <>
            <KpiCard titulo="Facturación Bruta" valor={kpisQ.data.facturacion_bruta} formato="currency"
              meta={kpisQ.data.presupuesto} metaLabel="Meta" icon={<DollarSign size={16} />} color="blue" />
            <KpiCard titulo="Cumplimiento" valor={kpisQ.data.cumplimiento_pct} formato="percent"
              meta={100} metaLabel="Objetivo" icon={<Target size={16} />}
              color={kpisQ.data.cumplimiento_pct >= 100 ? 'green' : kpisQ.data.cumplimiento_pct >= 80 ? 'amber' : 'rose'} />
            <KpiCard titulo="Atenciones" valor={kpisQ.data.atenciones} formato="number"
              icon={<Users size={16} />} color="purple" />
            <KpiCard titulo="Ticket Promedio" valor={kpisQ.data.ticket_promedio} formato="currency"
              icon={<BarChart2 size={16} />} color="amber" />
          </>
        ) : null}
      </div>

      {/* KPI Row 2 — compact */}
      <div className="kpi-grid kpi-grid--3 kpi-grid--sm">
        {kpisQ.isLoading || diasQ.isLoading ? (
          <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
        ) : (
          <>
            {diasQ.data && diasQ.data.length > 0 ? (
              <DiasSemanaMini
                rows={diasQ.data}
                selectedDia={selectedDia}
                onDayClick={handleDayClick}
              />
            ) : (
              <KpiCard titulo="Facturación Hoy" valor={kpisQ.data?.facturacion_hoy ?? 0}
                formato="currency" icon={<Calendar size={14} />} color="green" />
            )}
            <KpiCard titulo="Facturación Hoy" valor={kpisQ.data?.facturacion_hoy ?? 0}
              formato="currency" icon={<Calendar size={14} />} color="green" />
            <KpiCard titulo="Semanas en Meta" valor={kpisQ.data?.semanas_en_meta ?? 0}
              formato="number" meta={kpisQ.data?.semanas_total}
              metaLabel={`de ${kpisQ.data?.semanas_total ?? 0} sem.`}
              icon={<Award size={14} />} color="purple" />
          </>
        )}
      </div>

      {/* Charts Row 1: Cumplimiento semanal + Mix pagador */}
      <div className="charts-row">
        <div className="chart-card chart-card--2-3">
          <h2 className="chart-title">Cumplimiento Semanal</h2>
          {cumplimientoQ.isLoading ? <ChartSkeleton /> :
           cumplimientoQ.isError   ? <ErrorState onRetry={() => void cumplimientoQ.refetch()} /> :
           cumplimientoQ.data      ? <ChartCumplimiento semanas={cumplimientoQ.data.semanas} /> : null}
        </div>
        <div className="chart-card chart-card--1-3">
          <h2 className="chart-title">Mix Pagador</h2>
          {entidadesQ.isLoading ? <ChartSkeleton /> :
           entidadesQ.isError   ? <ErrorState onRetry={() => void entidadesQ.refetch()} /> :
           entidadesQ.data      ? <ChartMixPagador rows={entidadesQ.data.rows} /> : null}
        </div>
      </div>

      {/* Facturación por Entidad — ancho completo */}
      <div className="chart-card">
        <h2 className="chart-title">
          Facturación por Entidad
          {diaLabel && <span className="chart-title-badge">{diaLabel}</span>}
        </h2>
        {entidadesQ.isLoading ? <ChartSkeleton /> :
         entidadesQ.isError   ? <ErrorState onRetry={() => void entidadesQ.refetch()} /> :
         entidadesQ.data      ? <TablaEntidades rows={entidadesQ.data.rows} /> : null}
      </div>
    </div>
  );
}
