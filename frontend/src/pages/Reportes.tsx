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

  const kpisQ = useKpis(selected.mes, selected.anio);
  const entidadesQ = useEntidades(selected.mes, selected.anio);
  const cumplimientoQ = useCumplimientoSemanal(selected.mes, selected.anio);
  const diasQ = useDiasSemana(selected.mes, selected.anio);

  const isLoading = kpisQ.isLoading || entidadesQ.isLoading;
  const hasError = kpisQ.isError || entidadesQ.isError;

  function handleRefresh(): void {
    void kpisQ.refetch();
    void entidadesQ.refetch();
    void cumplimientoQ.refetch();
    void diasQ.refetch();
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

      {/* KPI Row 2 — 3 cards */}
      <div className="kpi-grid kpi-grid--3">
        {kpisQ.isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : kpisQ.data ? (
          <>
            <KpiCard
              titulo="Proyección de Cierre"
              valor={kpisQ.data.proyeccion_cierre}
              formato="currency"
              meta={kpisQ.data.presupuesto}
              metaLabel="Meta"
              icon={<TrendingUp size={16} />}
              color="blue"
            />
            <KpiCard
              titulo="Facturación Hoy"
              valor={kpisQ.data.facturacion_hoy}
              formato="currency"
              icon={<Calendar size={16} />}
              color="green"
            />
            <KpiCard
              titulo="Semanas en Meta"
              valor={kpisQ.data.semanas_en_meta}
              formato="number"
              meta={kpisQ.data.semanas_total}
              metaLabel={`de ${kpisQ.data.semanas_total} semanas`}
              icon={<Award size={16} />}
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
            <ChartMixPagador rows={entidadesQ.data.rows} total={entidadesQ.data.total} />
          ) : null}
        </div>
      </div>

      {/* Charts Row 2: Días de semana + Tabla entidades */}
      <div className="charts-row">
        <div className="chart-card chart-card--1-2">
          <h2 className="chart-title">Promedio por Día de Semana</h2>
          {diasQ.isLoading ? (
            <ChartSkeleton />
          ) : diasQ.isError ? (
            <ErrorState onRetry={() => void diasQ.refetch()} />
          ) : diasQ.data ? (
            <ChartDiasSemana rows={diasQ.data} />
          ) : null}
        </div>

        <div className="chart-card chart-card--1-2">
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
