import React, { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle, AlertCircle, Settings, Database, Building2, BarChart3, ShieldCheck, Stethoscope } from 'lucide-react';
import { usePresupuestos, useUpsertPresupuesto, useSinEntidadDiagnostico } from '../../api/reportes.js';
import type { Presupuesto } from '../../api/reportes.js';
import TabEntidades from './TabEntidades.js';
import TabDiagnostico from './TabDiagnostico.js';
import TabSinEntidad from './TabSinEntidad.js';
import TabServicios from './TabServicios.js';
import Conectores from './Conectores.js';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ConfigTab = 'fuentes' | 'entidades' | 'presupuestos' | 'diagnostico' | 'sin-entidad' | 'servicios';

// ─── Presupuestos helpers ─────────────────────────────────────────────────────

const MESES_ES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const COP_FMT = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function fmtCOP(value: number): string {
  return COP_FMT.format(value);
}

function getYearOptions(): number[] {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current, current + 1, current + 2];
}

// ─── Month Card ───────────────────────────────────────────────────────────────

interface MonthCardProps {
  mes: number;
  anio: number;
  current: Presupuesto | undefined;
}

function MonthCard({ mes, anio, current }: MonthCardProps): React.ReactElement {
  const [monto, setMonto] = useState<string>(current ? String(current.monto) : '0');
  const [notas, setNotas] = useState<string>(current?.notas ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const upsert = useUpsertPresupuesto();

  useEffect(() => {
    setMonto(current ? String(current.monto) : '0');
    setNotas(current?.notas ?? '');
    setStatus('idle');
  }, [current, mes, anio]);

  const montoNum = parseInt(monto.replace(/\D/g, ''), 10) || 0;
  const isSet = montoNum > 0;

  async function handleSave(): Promise<void> {
    setStatus('saving');
    setErrorMsg('');
    try {
      await upsert.mutateAsync({ anio, mes, monto: montoNum, notas: notas.trim() || undefined });
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  return (
    <div className={`config-month-card ${isSet ? 'config-month-card--set' : 'config-month-card--unset'}`}>
      <div className="config-month-header">
        <span className="config-month-name">{MESES_ES[mes]}</span>
        {isSet ? (
          <CheckCircle size={14} className="config-month-icon config-month-icon--ok" />
        ) : (
          <AlertCircle size={14} className="config-month-icon config-month-icon--warn" />
        )}
      </div>

      <div className="config-month-display">
        {isSet ? fmtCOP(montoNum) : 'Sin presupuesto'}
      </div>

      <div className="config-month-form">
        <div className="form-group">
          <label className="form-label" htmlFor={`monto-${anio}-${mes}`}>Monto (COP)</label>
          <input
            id={`monto-${anio}-${mes}`}
            type="number"
            className="form-input config-month-input"
            value={monto}
            min={0}
            step={1000}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`notas-${anio}-${mes}`}>
            Notas <span className="config-optional">(opcional)</span>
          </label>
          <input
            id={`notas-${anio}-${mes}`}
            type="text"
            className="form-input config-month-input"
            value={notas}
            maxLength={100}
            placeholder="Ej: Incluye campañas especiales"
            onChange={(e) => setNotas(e.target.value)}
          />
        </div>
      </div>

      <div className="config-month-actions">
        <button
          type="button"
          className={`btn btn--sm ${status === 'success' ? 'btn--ghost config-btn-success' : 'btn--primary'}`}
          onClick={() => void handleSave()}
          disabled={status === 'saving'}
        >
          {status === 'saving' ? (
            <><Loader2 size={13} className="spin" /> Guardando…</>
          ) : status === 'success' ? (
            <><CheckCircle size={13} /> Guardado</>
          ) : (
            <><Save size={13} /> Guardar</>
          )}
        </button>
      </div>

      {status === 'error' && (
        <div className="config-month-error">
          <AlertCircle size={12} />
          {errorMsg}
        </div>
      )}
    </div>
  );
}

// ─── Presupuestos tab ─────────────────────────────────────────────────────────

function TabPresupuestos(): React.ReactElement {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const yearOptions = getYearOptions();
  const { data: presupuestos, isLoading, isError } = usePresupuestos();

  const byMonthKey = React.useMemo(() => {
    const map = new Map<string, Presupuesto>();
    if (presupuestos) {
      for (const p of presupuestos) map.set(`${p.anio}-${p.mes}`, p);
    }
    return map;
  }, [presupuestos]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
        <div className="config-year-selector">
          <label className="form-label" htmlFor="year-select">Año</label>
          <select
            id="year-select"
            className="form-input form-select config-year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isError && (
        <div className="reportes-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={16} />
          Error al cargar los presupuestos. Reintente recargando la página.
        </div>
      )}

      {isLoading ? (
        <div className="page-loading">
          <Loader2 size={32} className="spin" style={{ color: '#3b82f6' }} />
          <p style={{ color: '#64748b' }}>Cargando presupuestos…</p>
        </div>
      ) : (
        <div className="config-months-grid">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
            <MonthCard
              key={`${selectedYear}-${mes}`}
              mes={mes}
              anio={selectedYear}
              current={byMonthKey.get(`${selectedYear}-${mes}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Configuracion(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ConfigTab>('fuentes');

  // Used to show a red icon on the Sin Entidad tab when there are unmatched records
  const now = new Date();
  const { data: sinEntidadData } = useSinEntidadDiagnostico(now.getMonth() + 1, now.getFullYear());
  const hasSinEntidad = (sinEntidadData?.length ?? 0) > 0;

  const TABS: { id: ConfigTab; label: string; icon: React.ReactNode }[] = [
    { id: 'fuentes',      label: 'Fuentes de datos', icon: <Database size={15} /> },
    { id: 'entidades',    label: 'Entidades',         icon: <Building2 size={15} /> },
    { id: 'servicios',    label: 'Procedimientos',    icon: <Stethoscope size={15} /> },
    { id: 'presupuestos', label: 'Presupuestos',      icon: <BarChart3 size={15} /> },
    { id: 'diagnostico',  label: 'Diagnóstico',       icon: <ShieldCheck size={15} /> },
    {
      id: 'sin-entidad',
      label: 'Sin Entidad',
      icon: <AlertCircle size={15} style={{ color: hasSinEntidad ? '#dc2626' : '#94a3b8' }} />,
    },
  ];

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={24} />
            Configuración
          </h1>
          <p className="page-subtitle">Parámetros del sistema · Fuentes de datos · Entidades · Presupuestos</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="config-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`config-tab ${activeTab === tab.id ? 'config-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="config-tab-content">
        {activeTab === 'fuentes'      && <Conectores />}
        {activeTab === 'entidades'    && <TabEntidades />}
        {activeTab === 'servicios'    && <TabServicios />}
        {activeTab === 'presupuestos' && <TabPresupuestos />}
        {activeTab === 'diagnostico'  && <TabDiagnostico />}
        {activeTab === 'sin-entidad'  && <TabSinEntidad />}
      </div>
    </div>
  );
}
