import React, { useState } from 'react';
import { RefreshCw, DollarSign, BarChart2, Users, Target, Award, X, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, Cell, ReferenceLine, CartesianGrid,
} from 'recharts';
import { useKpis, useEntidades, useCumplimientoSemanal, useDiasSemana, useTendencia, useServicios } from '../api/reportes.js';
import type { DiaSemanaRow, EntidadRow, SemanaRow, TendenciaRow } from '../api/reportes.js';
import KpiCard from '../components/widgets/KpiCard.js';
import ChartCumplimiento from '../components/widgets/ChartCumplimiento.js';
import ChartMixPagador from '../components/widgets/ChartMixPagador.js';
import TablaEntidades from '../components/widgets/TablaEntidades.js';
import TablaServicios from '../components/widgets/TablaServicios.js';

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

const TIPO_DISPLAY_LABEL: Record<string, string> = {
  EPS:             'EPS',
  CONVENIO:        'Convenio (cobro)',
  CONVENIO__CAJA:  'Convenio (directo)',
  ARL:             'ARL',
  PARTICULAR:      'Particular',
  OTRO:            'Otro',
  OTRO__CAJA:      'Otro (caja)',
};

function tipoLabel(tipo: string): string {
  return TIPO_DISPLAY_LABEL[tipo] ?? tipo.replace('__CAJA', ' (caja)');
}

// Use LOCAL calendar date — toISOString() converts to UTC and shifts the day
// when the client is in a negative-offset timezone (Colombia = UTC-5).
function fmt(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// dia_num (1=Mon…5=Fri) → MySQL DAYOFWEEK (2=Mon…6=Fri)
function toMysqlDow(diaNum: number): number {
  return diaNum + 1;
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

function countWorkingDaysInRange(start: string, end: string): number {
  let count = 0;
  const cur = new Date(start + 'T00:00:00Z');
  const endDate = new Date(end + 'T00:00:00Z');
  while (cur <= endDate) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
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

// ─── Facturado por mes (annual view) ─────────────────────────────────────────

interface FacturadoPorMesProps {
  rows: TendenciaRow[];
}

function FacturadoPorMes({ rows }: FacturadoPorMesProps): React.ReactElement {
  const maxVal = Math.max(...rows.map((r) => r.total), 1);
  const fmtShort = (n: number): string =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

  return (
    <div className="kpi-card kpi-card--blue" style={{ cursor: 'default' }}>
      <div className="kpi-card-header">
        <span className="kpi-card-title">Facturado por mes</span>
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="20%">
          <XAxis
            dataKey="mes"
            tickFormatter={(v: string) => v.split(' ')[0] ?? v}
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
              <Cell
                key={`${r.anio}-${r.mesIdx}`}
                fill={r.presupuesto > 0 && r.total >= r.presupuesto ? '#16a34a' : '#3b82f6'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p style={{ fontSize: '0.62rem', color: '#94a3b8', textAlign: 'center', marginTop: 2 }}>
        Verde = meta cumplida · Azul = en progreso / sin meta
      </p>
    </div>
  );
}

// ─── Cumplimiento mensual chart (annual view) ─────────────────────────────────

function ChartCumplimientoMensual({ rows }: { rows: TendenciaRow[] }): React.ReactElement {
  const fmtShort = (n: number): string =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

  const data = rows.map((r) => ({
    mes: (r.mes.split(' ')[0] ?? r.mes),
    venta: r.total,
    estimado: r.presupuesto,
    pct: r.presupuesto > 0 ? Math.round((r.total / r.presupuesto) * 1000) / 10 : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barCategoryGap="25%" barGap={2}>
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickFormatter={fmtShort}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <RechartTooltip
          formatter={(val: number, name: string) => [
            fmtShort(val),
            name === 'venta' ? 'Facturado' : 'Presupuesto',
          ]}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <ReferenceLine y={0} stroke="#e2e8f0" />
        <Bar dataKey="estimado" fill="#e2e8f0" radius={[2, 2, 0, 0]} name="estimado" />
        <Bar dataKey="venta" radius={[2, 2, 0, 0]} name="venta">
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.pct >= 100 ? '#16a34a' : d.pct >= 80 ? '#f59e0b' : '#3b82f6'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Cumplimiento diario (range mode) ────────────────────────────────────────

interface DiaCumpData { dia: string; total: number; pct: number }

function ChartCumplimientoDiario({
  rows,
  dailyTarget,
}: {
  rows: DiaSemanaRow[];
  dailyTarget: number;
}): React.ReactElement {
  const fmtMoney = (n: number): string =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`;

  const data: DiaCumpData[] = rows.map((r) => ({
    dia:   r.dia.substring(0, 3),
    total: r.total,
    pct:   dailyTarget > 0 ? Math.round((r.total / dailyTarget) * 1000) / 10 : 0,
  }));

  function barColor(pct: number): string {
    if (!dailyTarget) return '#3b82f6';
    if (pct >= 100)   return '#22c55e';
    if (pct >= 80)    return '#f59e0b';
    return '#ef4444';
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis
          tickFormatter={fmtMoney}
          tick={{ fontSize: 11, fill: '#64748b' }}
          width={54}
          domain={[0, 'auto']}
        />
        {dailyTarget > 0 && (
          <ReferenceLine
            y={dailyTarget}
            stroke="#6366f1"
            strokeDasharray="6 3"
            strokeWidth={2}
            label={{ value: `Meta ${fmtMoney(dailyTarget)}`, position: 'insideTopRight', fontSize: 10, fill: '#6366f1', dy: -4 }}
          />
        )}
        <RechartTooltip
          formatter={(val: number) => [fmtMoney(val), 'Facturado']}
          labelFormatter={(label: string) => {
            const row = data.find((d) => d.dia === label);
            return row && dailyTarget > 0
              ? `${label} · ${row.pct.toFixed(1)}% de meta`
              : label;
          }}
          contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
        />
        <Bar dataKey="total" maxBarSize={64} name="Facturado">
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={barColor(entry.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
  const { user } = useAuth();
  const isAdmisiones = user?.rol === 'ADMISIONES';

  const meses = getLast6Months();
  const [selectedIdx, setSelectedIdx] = useState(0);
  // ADMISIONES is locked to current month (index 0 = most recent in getLast6Months)
  const effectiveIdx = isAdmisiones ? 0 : selectedIdx;
  const selected = meses[effectiveIdx]!;

  const [filterMode, setFilterMode] = useState<FilterMode>('mes');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd,   setRangeEnd]   = useState<string>('');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const isAnioMode = activePreset === 'anio';

  // Day-of-week click filter (dia_num: 1=Mon…5=Fri, null=off)
  const [selectedDia, setSelectedDia] = useState<number | null>(null);

  // Tipo click filter (client-side, only affects entity table)
  const [selectedTipo, setSelectedTipo] = useState<string | null>(null);

  // Group filter from Mix Pagador summary cards (caja / cobro)
  const [selectedGroup, setSelectedGroup] = useState<'caja' | 'cobro' | null>(null);

  // Entity row click filter (changes KPIs via backend entidad_id)
  const [selectedEntidadId,   setSelectedEntidadId]   = useState<string | null>(null);
  const [selectedEntidadName, setSelectedEntidadName] = useState<string | null>(null);

  // Full period dates (never overridden by day filter)
  const periodStart = filterMode === 'rango' && rangeStart ? rangeStart : undefined;
  const periodEnd   = filterMode === 'rango' && rangeEnd   ? rangeEnd   : undefined;

  // dia_semana: MySQL DAYOFWEEK (2=Lun … 6=Vie), undefined when no day selected
  const diaSemana = selectedDia !== null ? toMysqlDow(selectedDia) : undefined;

  // Period dates are never changed — dia_semana is an additive filter on the same period
  const kpisQ         = useKpis(selected.mes, selected.anio, selectedEntidadId ?? undefined, periodStart, periodEnd, diaSemana);
  const entidadesQ    = useEntidades(selected.mes, selected.anio, periodStart, periodEnd, diaSemana);
  const cumplimientoQ = useCumplimientoSemanal(selected.mes, selected.anio, periodStart, periodEnd);
  // diasQ always uses full period so bars stay stable while filtering
  const diasQ = useDiasSemana(selected.mes, selected.anio, periodStart, periodEnd);
  const tendenciaQ  = useTendencia(12);
  const serviciosQ  = useServicios(selected.mes, selected.anio, periodStart, periodEnd, selectedEntidadId, diaSemana ?? null);

  // Annual mode: filter tendencia to current year, ordered chronologically
  const currentYear = new Date().getFullYear();
  const tendenciaAnio = (tendenciaQ.data ?? [])
    .filter((r) => r.anio === currentYear)
    .slice()
    .sort((a, b) => a.mesIdx - b.mesIdx); // Ene=1 → Dic=12
  const mesesEnMeta = tendenciaAnio.filter((r) => r.presupuesto > 0 && r.total >= r.presupuesto).length;

  const isLoading = kpisQ.isLoading || entidadesQ.isLoading;
  const hasError  = kpisQ.isError  || entidadesQ.isError;

  const isRangoMode = filterMode === 'rango' && !isAnioMode;
  const workingDays = isRangoMode && periodStart && periodEnd
    ? countWorkingDaysInRange(periodStart, periodEnd) : 0;
  const dailyTarget = workingDays > 0 ? (kpisQ.data?.presupuesto ?? 0) / workingDays : 0;
  const diasEnMeta = (diasQ.data ?? []).filter((d) => dailyTarget > 0 && d.total >= dailyTarget).length;

  // Context flags — drive adaptive layout
  const isDayFilter    = selectedDia !== null;
  const isEntityFilter = selectedEntidadId !== null;
  const isCompactMode  = isDayFilter || isEntityFilter;

  // Filtered rows for entity table — tipo, group and entity filters are client-side
  const allRows = entidadesQ.data?.rows ?? [];
  const tableRows: EntidadRow[] = selectedTipo
    ? allRows.filter((r) => {
        if (selectedTipo.endsWith('__CAJA')) {
          const base = selectedTipo.replace('__CAJA', '');
          return r.tipo === base && r.es_grupo;
        }
        return r.tipo === selectedTipo && !r.es_grupo;
      })
    : selectedEntidadId
    ? allRows.filter((r) => r.id === selectedEntidadId)
    : selectedGroup
    ? allRows.filter((r) =>
        selectedGroup === 'caja'
          ? r.es_grupo || r.tipo === 'PARTICULAR'
          : !r.es_grupo && r.tipo !== 'PARTICULAR'
      )
    : allRows;

  function clearDayFilter(): void { setSelectedDia(null); }
  function clearTipoFilter(): void { setSelectedTipo(null); }
  function clearGroupFilter(): void { setSelectedGroup(null); }
  function clearEntityFilter(): void { setSelectedEntidadId(null); setSelectedEntidadName(null); }

  function handleDayClick(diaNum: number): void {
    setSelectedDia((prev) => (prev === diaNum ? null : diaNum));
  }

  function handleWeekClick(semana: SemanaRow): void {
    setFilterMode('rango');
    setRangeStart(semana.fecha_ini);
    setRangeEnd(semana.fecha_fin);
    setSelectedDia(null);
    setSelectedTipo(null);
    setSelectedGroup(null);
    setSelectedEntidadId(null);
    setSelectedEntidadName(null);
  }

  function handleTipoClick(tipo: string): void {
    setSelectedTipo((prev) => (prev === tipo ? null : tipo));
    setSelectedGroup(null);
    setSelectedEntidadId(null);
    setSelectedEntidadName(null);
  }

  function handleGroupClick(group: 'caja' | 'cobro'): void {
    setSelectedGroup((prev) => (prev === group ? null : group));
    setSelectedTipo(null);
    setSelectedEntidadId(null);
    setSelectedEntidadName(null);
  }

  function handleEntityClick(row: EntidadRow): void {
    if (!row.id) return;
    if (selectedEntidadId === row.id) {
      setSelectedEntidadId(null);
      setSelectedEntidadName(null);
    } else {
      setSelectedEntidadId(row.id);
      setSelectedEntidadName(row.entidad);
      setSelectedTipo(null);
      setSelectedGroup(null);
    }
  }

  function handleRefresh(): void {
    void kpisQ.refetch();
    void entidadesQ.refetch();
    if (!isCompactMode) void cumplimientoQ.refetch();
    void diasQ.refetch();
  }

  function handleModeSwitch(mode: FilterMode): void {
    setFilterMode(mode);
    setSelectedDia(null);
    setSelectedTipo(null);
    setSelectedEntidadId(null);
    setSelectedEntidadName(null);
    setActivePreset(null);
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
    setFilterMode('rango');
    setSelectedDia(null);
    setActivePreset(preset);
  }

  const diaLabel      = isDayFilter ? (DIA_NOMBRES[selectedDia!] ?? null) : null;
  const groupLabel    = selectedGroup === 'caja' ? 'Flujo de caja' : selectedGroup === 'cobro' ? 'Cobro a entidades' : null;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header reportes-header">
        <div>
          <h1 className="page-title">Reportes de Facturación</h1>
          <p className="page-subtitle">Clínica Neurofic — Indicadores del período seleccionado</p>
        </div>
        <div className="reportes-header-controls">
          {isAdmisiones ? (
            <span className="reportes-period-locked">
              <Lock size={13} /> Solo mes actual
            </span>
          ) : (
            <>
              <div className="filter-mode-tabs">
                <button type="button"
                  className={`filter-mode-tab${filterMode === 'mes' ? ' filter-mode-tab--active' : ''}`}
                  onClick={() => handleModeSwitch('mes')}>Mes</button>
                <button type="button"
                  className={`filter-mode-tab${filterMode === 'rango' ? ' filter-mode-tab--active' : ''}`}
                  onClick={() => handleModeSwitch('rango')}>Rango</button>
              </div>

              {filterMode === 'mes' && (
                <select className="reportes-month-select" value={selectedIdx}
                  onChange={(e) => { setSelectedIdx(Number(e.target.value)); setSelectedDia(null); }}>
                  {meses.map((m, i) => <option key={i} value={i}>{m.label}</option>)}
                </select>
              )}

              {filterMode === 'rango' && (
                <div className="filter-bar">
                  <div className="preset-btns">
                    <button type="button" className="preset-btn" onClick={() => applyPreset('hoy')}>Hoy</button>
                    <button type="button" className="preset-btn" onClick={() => applyPreset('ayer')}>Ayer</button>
                    <button type="button" className="preset-btn" onClick={() => applyPreset('semana')}>Esta semana</button>
                    <button type="button" className="preset-btn" onClick={() => applyPreset('semana_pasada')}>Sem. pasada</button>
                    <button
                      type="button"
                      className={`preset-btn preset-btn--accent${activePreset === 'anio' ? ' preset-btn--active' : ''}`}
                      onClick={() => applyPreset('anio')}
                    >
                      Año
                    </button>
                  </div>
                  <div className="date-range-group">
                    <input type="date" className="date-input" value={rangeStart}
                      onChange={(e) => { setRangeStart(e.target.value); setSelectedDia(null); setActivePreset(null); }} aria-label="Fecha inicio" />
                    <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>—</span>
                    <input type="date" className="date-input" value={rangeEnd}
                      onChange={(e) => { setRangeEnd(e.target.value); setSelectedDia(null); setActivePreset(null); }} aria-label="Fecha fin" />
                  </div>
                </div>
              )}
            </>
          )}

          <button type="button" className="btn btn--secondary btn--icon"
            onClick={handleRefresh} disabled={isLoading}
            title="Actualizar vista desde la base de datos local (no importa datos nuevos desde las fuentes — para eso ve a Configuración → Fuentes)">
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Active filter badges */}
      {(diaLabel || selectedTipo || selectedEntidadName || groupLabel) && (
        <div className="filter-badges-row">
          {diaLabel && (
            <div className="dia-filter-badge">
              <span>Día: <strong>{diaLabel}</strong></span>
              <button type="button" onClick={clearDayFilter} className="dia-filter-clear" title="Quitar filtro">
                <X size={13} />
              </button>
            </div>
          )}
          {groupLabel && (
            <div className={`dia-filter-badge dia-filter-badge--${selectedGroup === 'caja' ? 'green' : 'blue'}`}>
              <span>Grupo: <strong>{groupLabel}</strong></span>
              <button type="button" onClick={clearGroupFilter} className="dia-filter-clear" title="Quitar filtro">
                <X size={13} />
              </button>
            </div>
          )}
          {selectedTipo && (
            <div className="dia-filter-badge dia-filter-badge--purple">
              <span>Tipo: <strong>{tipoLabel(selectedTipo)}</strong></span>
              <button type="button" onClick={clearTipoFilter} className="dia-filter-clear" title="Quitar filtro">
                <X size={13} />
              </button>
            </div>
          )}
          {selectedEntidadName && (
            <div className="dia-filter-badge dia-filter-badge--green">
              <span>Entidad: <strong>{selectedEntidadName}</strong></span>
              <button type="button" onClick={clearEntityFilter} className="dia-filter-clear" title="Quitar filtro">
                <X size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {hasError && <ErrorState onRetry={handleRefresh} />}

      {/* ── MODO COMPACTO: día o entidad activos → solo lo relevante ── */}
      {isCompactMode ? (
        <>
          {/* KPI Row: Bruta + Atenciones + Ticket (sin Cumplimiento — no aplica) */}
          <div className="kpi-grid kpi-grid--3">
            {kpisQ.isLoading ? (
              <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
            ) : kpisQ.data ? (
              <>
                <KpiCard titulo="Facturación Bruta" valor={kpisQ.data.facturacion_bruta} formato="currency"
                  icon={<DollarSign size={16} />} color="blue" />
                <KpiCard titulo="Atenciones" valor={kpisQ.data.atenciones} formato="number"
                  icon={<Users size={16} />} color="purple" />
                <KpiCard titulo="Ticket Promedio" valor={kpisQ.data.ticket_promedio} formato="currency"
                  icon={<BarChart2 size={16} />} color="amber" />
              </>
            ) : null}
          </div>

          {/* Bar chart + Mix Pagador lado a lado */}
          <div className="charts-row charts-row--dias-entidades" style={{ marginBottom: 'var(--space-6)' }}>
            {diasQ.data && diasQ.data.length > 0 && (
              <DiasSemanaMini rows={diasQ.data} selectedDia={selectedDia} onDayClick={handleDayClick} />
            )}
            <div className="chart-card" style={{ flex: 2 }}>
              <h2 className="chart-title">
                Mix Pagador
                {diaLabel && <span className="chart-title-badge">{diaLabel}</span>}
                {selectedEntidadName && <span className="chart-title-badge chart-title-badge--green">{selectedEntidadName}</span>}
              </h2>
              {entidadesQ.isLoading ? <ChartSkeleton height={200} /> :
               entidadesQ.isError   ? <ErrorState onRetry={() => void entidadesQ.refetch()} /> :
               entidadesQ.data      ? (
                 <ChartMixPagador
                   rows={entidadesQ.data.rows}
                   selectedTipo={selectedTipo}
                   onTipoClick={handleTipoClick}
                   selectedGroup={selectedGroup}
                   onGroupClick={handleGroupClick}
                 />
               ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── MODO NORMAL: layout completo ── */}

          {/* KPI Row 1 — 4 cards */}
          <div className="kpi-grid kpi-grid--4">
            {kpisQ.isLoading ? (
              <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></>
            ) : kpisQ.data ? (
              <>
                <KpiCard titulo="Facturación Bruta" valor={kpisQ.data.facturacion_bruta} formato="currency"
                  meta={kpisQ.data.presupuesto} metaLabel="Meta" icon={<DollarSign size={16} />} color="blue"
                  showShortfall />
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

          {/* KPI Row 2 — annual: monthly bars + Meses en Meta | normal: day bars + Semanas en Meta */}
          <div className="kpi-grid kpi-grid--2 kpi-grid--sm">
            {isAnioMode ? (
              tendenciaQ.isLoading ? (
                <><KpiSkeleton /><KpiSkeleton /></>
              ) : (
                <>
                  {tendenciaAnio.length > 0 ? (
                    <FacturadoPorMes rows={tendenciaAnio} />
                  ) : <div />}
                  <KpiCard
                    titulo="Meses en Meta"
                    valor={mesesEnMeta}
                    formato="number"
                    meta={tendenciaAnio.length}
                    metaLabel={`de ${tendenciaAnio.length} mes.`}
                    icon={<Award size={14} />}
                    color="purple"
                  />
                </>
              )
            ) : (
              kpisQ.isLoading || diasQ.isLoading ? (
                <><KpiSkeleton /><KpiSkeleton /></>
              ) : (
                <>
                  {diasQ.data && diasQ.data.length > 0 ? (
                    <DiasSemanaMini rows={diasQ.data} selectedDia={selectedDia} onDayClick={handleDayClick} />
                  ) : <div />}
                  {isRangoMode ? (
                    <KpiCard
                      titulo="Días en Meta"
                      valor={diasEnMeta}
                      formato="number"
                      meta={workingDays || diasQ.data?.length || 0}
                      metaLabel={`de ${workingDays || diasQ.data?.length || 0} días`}
                      icon={<Award size={14} />}
                      color={diasEnMeta > 0 ? 'green' : 'rose'}
                    />
                  ) : (
                    <KpiCard titulo="Semanas en Meta" valor={kpisQ.data?.semanas_en_meta ?? 0}
                      formato="number" meta={kpisQ.data?.semanas_total}
                      metaLabel={`de ${kpisQ.data?.semanas_total ?? 0} sem.`}
                      icon={<Award size={14} />} color="purple" />
                  )}
                </>
              )
            )}
          </div>

          {/* Charts Row: Cumplimiento (diario/semanal/mensual) + Mix Pagador */}
          <div className="charts-row">
            <div className="chart-card chart-card--2-3">
              <h2 className="chart-title">
                {isAnioMode ? 'Cumplimiento Mensual' : isRangoMode ? 'Cumplimiento Diario' : 'Cumplimiento Semanal'}
              </h2>
              {isAnioMode ? (
                tendenciaQ.isLoading ? <ChartSkeleton /> :
                tendenciaAnio.length > 0 ? (
                  <ChartCumplimientoMensual rows={tendenciaAnio} />
                ) : null
              ) : isRangoMode ? (
                diasQ.isLoading ? <ChartSkeleton /> :
                diasQ.data && diasQ.data.length > 0 ? (
                  <ChartCumplimientoDiario rows={diasQ.data} dailyTarget={dailyTarget} />
                ) : <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>Sin datos para el período</p>
              ) : (
                cumplimientoQ.isLoading ? <ChartSkeleton /> :
                cumplimientoQ.isError   ? <ErrorState onRetry={() => void cumplimientoQ.refetch()} /> :
                cumplimientoQ.data      ? (
                  <ChartCumplimiento
                    semanas={cumplimientoQ.data.semanas}
                    onWeekClick={handleWeekClick}
                  />
                ) : null
              )}
            </div>
            <div className="chart-card chart-card--1-3">
              <h2 className="chart-title">Mix Pagador</h2>
              {entidadesQ.isLoading ? <ChartSkeleton /> :
               entidadesQ.isError   ? <ErrorState onRetry={() => void entidadesQ.refetch()} /> :
               entidadesQ.data      ? (
                 <ChartMixPagador
                   rows={entidadesQ.data.rows}
                   selectedTipo={selectedTipo}
                   onTipoClick={handleTipoClick}
                   selectedGroup={selectedGroup}
                   onGroupClick={handleGroupClick}
                 />
               ) : null}
            </div>
          </div>
        </>
      )}

      {/* Facturación por Entidad — ancho completo, siempre visible */}
      <div className="chart-card">
        <h2 className="chart-title">
          Facturación por Entidad
          {diaLabel && <span className="chart-title-badge">{diaLabel}</span>}
          {groupLabel && <span className={`chart-title-badge chart-title-badge--${selectedGroup === 'caja' ? 'green' : 'blue'}`}>{groupLabel}</span>}
          {selectedTipo && <span className="chart-title-badge chart-title-badge--purple">{tipoLabel(selectedTipo)}</span>}
          {selectedEntidadName && <span className="chart-title-badge chart-title-badge--green">{selectedEntidadName}</span>}
        </h2>
        {entidadesQ.isLoading ? <ChartSkeleton /> :
         entidadesQ.isError   ? <ErrorState onRetry={() => void entidadesQ.refetch()} /> :
         entidadesQ.data      ? (
           <TablaEntidades
             rows={tableRows}
             onEntityClick={handleEntityClick}
             selectedEntidadId={selectedEntidadId}
           />
         ) : null}
      </div>

      {/* Mix por Servicio — análisis de volumen y rentabilidad */}
      <div className="chart-card">
        <h2 className="chart-title">
          Mix por Servicio
          {diaLabel && <span className="chart-title-badge">{diaLabel}</span>}
          {selectedEntidadName && <span className="chart-title-badge chart-title-badge--green">{selectedEntidadName}</span>}
        </h2>
        {serviciosQ.isLoading ? <ChartSkeleton /> :
         serviciosQ.isError   ? <ErrorState onRetry={() => void serviciosQ.refetch()} /> :
         serviciosQ.data      ? (
           <TablaServicios result={serviciosQ.data} entidadNombre={selectedEntidadName} />
         ) : null}
      </div>
    </div>
  );
}
