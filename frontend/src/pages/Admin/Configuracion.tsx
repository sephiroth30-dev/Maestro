import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, AlertCircle, Settings, Database, Building2, BarChart3, ShieldCheck, Stethoscope, UserCog, Users, Settings2, Sliders } from 'lucide-react';
import { usePresupuestos, useUpsertPresupuesto, useSinEntidadDiagnostico } from '../../api/reportes.js';
import type { Presupuesto } from '../../api/reportes.js';
import TabEntidades from './TabEntidades.js';
import TabDiagnostico from './TabDiagnostico.js';
import TabSinEntidad from './TabSinEntidad.js';
import TabServicios from './TabServicios.js';
import TabProfesionales from './TabProfesionales.js';
import Conectores from './Conectores.js';
import Usuarios from './Usuarios.js';
import CapacidadConfig from './CapacidadConfig.js';
import ReglaHonorarios from './ReglaHonorarios.js';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type ConfigTab =
  | 'entidades' | 'profesionales' | 'servicios' | 'presupuestos'
  | 'diagnostico' | 'sin-entidad'
  | 'usuarios' | 'honorarios'
  | 'capacidad' | 'fuentes';

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

// ─── Month Row ────────────────────────────────────────────────────────────────

interface MonthCardProps {
  mes: number;
  anio: number;
  current: Presupuesto | undefined;
}

function MonthRow({ mes, anio, current }: MonthCardProps): React.ReactElement {
  const upsert = useUpsertPresupuesto();
  const [monto, setMonto] = useState(current ? String(current.monto) : '');
  const [notas, setNotas] = useState(current?.notas ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setMonto(current ? String(current.monto) : '');
    setNotas(current?.notas ?? '');
  }, [current?.monto, current?.notas]);

  async function save(): Promise<void> {
    const montoNum = parseInt(monto.replace(/\D/g, ''), 10) || 0;
    const notasTrimmed = notas.trim();
    if (montoNum === (current?.monto ?? 0) && notasTrimmed === (current?.notas ?? '')) return;
    setStatus('saving');
    try {
      await upsert.mutateAsync({ anio, mes, monto: montoNum, notas: notasTrimmed || undefined });
      setStatus('saved');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    }
  }

  const montoNum = parseInt(monto.replace(/\D/g, ''), 10) || 0;
  const isSet = montoNum > 0 || (current?.monto ?? 0) > 0;

  return (
    <tr className="presup-row">
      <td className={`presup-mes${isSet ? '' : ' presup-mes--unset'}`}>{MESES_ES[mes]}</td>
      <td className="presup-monto-cell">
        <input
          type="number"
          className="presup-input"
          value={monto}
          min={0}
          step={100000}
          placeholder="0"
          onChange={(e) => { setStatus('idle'); setMonto(e.target.value); }}
          onBlur={() => void save()}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </td>
      <td className="presup-notas-cell">
        <input
          type="text"
          className="presup-input presup-input--notas"
          value={notas}
          maxLength={100}
          placeholder="Notas opcionales…"
          onChange={(e) => { setStatus('idle'); setNotas(e.target.value); }}
          onBlur={() => void save()}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </td>
      <td className="presup-status-cell">
        {status === 'saving' && <Loader2 size={13} className="spin" style={{ color: '#3b82f6' }} />}
        {status === 'saved'  && <CheckCircle size={13} style={{ color: '#10b981' }} />}
        {status === 'error'  && <AlertCircle size={13} style={{ color: '#ef4444' }} />}
        {status === 'idle' && isSet && <CheckCircle size={13} style={{ color: '#10b981', opacity: 0.4 }} />}
      </td>
    </tr>
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

  const totalPresupuestado = Array.from({ length: 12 }, (_, i) => i + 1)
    .reduce((sum, mes) => sum + (byMonthKey.get(`${selectedYear}-${mes}`)?.monto ?? 0), 0);

  if (isError) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        Error al cargar los presupuestos. Reintente recargando la página.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={32} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b' }}>Cargando presupuestos…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="presup-header">
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
        {totalPresupuestado > 0 && (
          <span className="presup-total-badge">
            Total {selectedYear}: <strong>{fmtCOP(totalPresupuestado)}</strong>
          </span>
        )}
      </div>

      <table className="presup-table">
        <thead>
          <tr>
            <th>Mes</th>
            <th>Presupuesto (COP)</th>
            <th>Notas</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((mes) => (
            <MonthRow
              key={`${selectedYear}-${mes}`}
              mes={mes}
              anio={selectedYear}
              current={byMonthKey.get(`${selectedYear}-${mes}`)}
            />
          ))}
        </tbody>
        {totalPresupuestado > 0 && (
          <tfoot>
            <tr className="presup-row presup-row--total">
              <td className="presup-total-label">Total</td>
              <td className="presup-monto-cell">
                <input readOnly className="presup-input presup-input--total" value={fmtCOP(totalPresupuestado)} />
              </td>
              <td /><td />
            </tr>
          </tfoot>
        )}
      </table>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
        Tab o Enter para pasar al siguiente campo · Los cambios se guardan automáticamente al salir del campo
      </p>
    </div>
  );
}

// ─── Nav section structure ────────────────────────────────────────────────────

interface NavSection {
  label: string;
  items: Array<{
    id: ConfigTab;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
    danger?: boolean;
  }>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Configuracion(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ConfigTab>('entidades');

  const now = new Date();
  const { data: sinEntidadData } = useSinEntidadDiagnostico(now.getMonth() + 1, now.getFullYear());
  const hasSinEntidad = (sinEntidadData?.length ?? 0) > 0;

  const NAV_SECTIONS: NavSection[] = [
    {
      label: 'Datos',
      items: [
        { id: 'entidades',     label: 'Entidades',       icon: <Building2 size={14} /> },
        { id: 'profesionales', label: 'Profesionales',    icon: <UserCog size={14} /> },
        { id: 'servicios',     label: 'Procedimientos',   icon: <Stethoscope size={14} /> },
        { id: 'presupuestos',  label: 'Presupuestos',     icon: <BarChart3 size={14} /> },
      ],
    },
    {
      label: 'Calidad',
      items: [
        { id: 'diagnostico',  label: 'Diagnóstico',  icon: <ShieldCheck size={14} /> },
        {
          id: 'sin-entidad',
          label: 'Sin Entidad',
          icon: <AlertCircle size={14} />,
          badge: hasSinEntidad ? (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', display: 'inline-block', marginLeft: 2 }} />
          ) : undefined,
        },
      ],
    },
    {
      label: 'Administración',
      items: [
        { id: 'usuarios',   label: 'Usuarios',           icon: <Users size={14} /> },
        { id: 'honorarios', label: 'Reglas Honorarios',  icon: <Sliders size={14} /> },
      ],
    },
    {
      label: 'Sistema',
      items: [
        { id: 'capacidad', label: 'Cap. Instalada', icon: <Settings2 size={14} /> },
        { id: 'fuentes',   label: 'Fuentes de datos', icon: <Database size={14} />, danger: true },
      ],
    },
  ];

  return (
    <div className="page">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={22} />
            Configuración
          </h1>
          <p className="page-subtitle">Parámetros del sistema · Datos · Usuarios · Fuentes</p>
        </div>
      </div>

      <div className="config-layout">
        {/* ── Left navigation ─────────────────────────────────────────────── */}
        <nav className="config-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="config-nav-section-label">{section.label}</div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={[
                    'config-nav-item',
                    activeTab === item.id ? 'config-nav-item--active' : '',
                    item.danger ? 'config-nav-item--danger' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setActiveTab(item.id)}
                >
                  {item.icon}
                  {item.label}
                  {item.badge}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="config-main">
          {activeTab === 'entidades'     && <TabEntidades />}
          {activeTab === 'profesionales' && <TabProfesionales />}
          {activeTab === 'servicios'     && <TabServicios />}
          {activeTab === 'presupuestos'  && <TabPresupuestos />}
          {activeTab === 'diagnostico'   && <TabDiagnostico />}
          {activeTab === 'sin-entidad'   && <TabSinEntidad />}
          {activeTab === 'usuarios'      && <Usuarios />}
          {activeTab === 'honorarios'    && <ReglaHonorarios />}
          {activeTab === 'capacidad'     && <CapacidadConfig />}
          {activeTab === 'fuentes'       && <Conectores />}
        </div>
      </div>
    </div>
  );
}
