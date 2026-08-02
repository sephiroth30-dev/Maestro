/**
 * Analítica de pacientes.
 *
 * Lo que la base permite responder hoy con los dos únicos campos de paciente
 * que existen (`paciente_nombre`, `paciente_documento`): cuántas personas
 * distintas se atienden, cuántas son nuevas y con qué frecuencia vuelven.
 *
 * NO es demografía poblacional: no hay edad, sexo ni ciudad en ninguna parte
 * del sistema. La única segmentación real es por tipo de pagador.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Users, Loader2, AlertCircle, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { usePacientes } from '../api/pacientes.js';
import type { DimensionRow } from '../api/pacientes.js';
import { useAuth } from '../hooks/useAuth.js';
import { ExportButton } from '../export/index.js';
import { buildPacientesDoc } from '../export/docs/pacientesDoc.js';

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);
const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

// ─── Cards ────────────────────────────────────────────────────────────────────

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }): React.ReactElement {
  return (
    <div className="pac-kpi">
      <span className="pac-kpi__label">{label}</span>
      <strong className="pac-kpi__value">{value}</strong>
      {sub && <span className="pac-kpi__sub">{sub}</span>}
    </div>
  );
}

function DimTable({ rows, primeraCol }: { rows: DimensionRow[]; primeraCol: string }): React.ReactElement {
  return (
    <div className="tabla-entidades-wrapper">
      <table className="tabla-entidades-table">
        <thead>
          <tr>
            <th className="tabla-entidades-th">{primeraCol}</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Pacientes</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Atenciones</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Valor bruto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.clave ?? idx} className="tabla-entidades-tr">
              <td className="tabla-entidades-td tabla-entidades-nombre">{r.nombre}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtNum(r.pacientes)}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>{fmtNum(r.atenciones)}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right', color: '#64748b' }}>{fmtCOP(r.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Pacientes(): React.ReactElement {
  const { user } = useAuth();
  const isAdmisiones = user?.rol === 'ADMISIONES';

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [verFuentes, setVerFuentes] = useState(false);

  const mesEfectivo = isAdmisiones ? now.getMonth() + 1 : mes;
  const anioEfectivo = isAdmisiones ? now.getFullYear() : anio;

  const { data, isLoading, isError, refetch } = usePacientes(mesEfectivo, anioEfectivo);

  const refFrecuencia = useRef<HTMLDivElement>(null);
  const refRetencion = useRef<HTMLDivElement>(null);

  const periodLabel = `${MESES[mesEfectivo]} ${anioEfectivo}`;

  const buildExportDoc = useMemo(() => () => {
    if (!data) throw new Error('Aún no hay datos para exportar.');
    return buildPacientesDoc({
      periodLabel,
      filters: [{ label: 'Periodo', value: periodLabel }],
      data,
      getChartFrecuencia: () => refFrecuencia.current,
      getChartRetencion: () => refRetencion.current,
    });
  }, [data, periodLabel]);

  if (isLoading) {
    return (
      <div className="page-loading">
        <Loader2 size={28} className="spin" style={{ color: '#3b82f6' }} />
        <p style={{ color: '#64748b', marginTop: 8 }}>Calculando analítica de pacientes…</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} />
        No se pudo calcular la analítica de pacientes.
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  const { cobertura, resumen } = data;
  const severidad = cobertura.cobertura_pct >= 90 ? 'green' : cobertura.cobertura_pct >= 60 ? 'amber' : 'red';

  return (
    <div className="page">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} style={{ color: '#0e7490' }} />
            Analítica de Pacientes
          </h1>
          <p className="page-subtitle">
            Personas distintas atendidas, pacientes nuevos y frecuencia de retorno
          </p>
        </div>

        <div className="pac-filtros">
          {!isAdmisiones && (
            <>
              <select className="form-input" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                {MESES.slice(1).map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
              </select>
              <select className="form-input" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {Array.from({ length: 7 }, (_, i) => 2023 + i).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </>
          )}
          <ExportButton buildDoc={buildExportDoc} />
        </div>
      </div>

      {/* ── Cobertura: siempre visible, antes que cualquier cifra ──────────── */}
      <div className={`alerta-kpi alerta-kpi--${severidad}`}>
        <div className="alerta-kpi__icon">
          {severidad === 'green' ? <CheckCircle size={17} /> : <AlertTriangle size={17} />}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {fmtNum(cobertura.filas_con_paciente)} de {fmtNum(cobertura.filas)} registros
            {' '}({cobertura.cobertura_pct}%) traen identificación de paciente.
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
            Todas las cifras de esta página se calculan solo sobre esos registros.
            {cobertura.valor_sin_paciente > 0 && (
              <> Quedan por fuera {fmtCOP(cobertura.valor_sin_paciente)} sin identificar.</>
            )}
          </p>
          <button
            type="button"
            onClick={() => setVerFuentes((v) => !v)}
            style={{
              background: 'none', border: 'none', padding: '4px 0 0', cursor: 'pointer',
              color: 'inherit', fontSize: '0.78rem', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            Ver por fuente {verFuentes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {verFuentes && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.78rem' }}>
              {cobertura.por_conector.map((c) => (
                <li key={c.conector_id ?? c.conector_nombre}>
                  <strong>{c.conector_nombre}</strong>: {c.cobertura_pct}%
                  {' '}({fmtNum(c.filas_con_paciente)} de {fmtNum(c.filas)})
                  {c.cobertura_pct === 0 && ' — esta fuente no trae columna de paciente'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="pac-kpi-row">
        <Kpi label="Pacientes únicos" value={fmtNum(resumen.pacientes_unicos)} sub={`sobre el ${cobertura.cobertura_pct}% de los datos`} />
        <Kpi label="Nuevos" value={fmtNum(resumen.nuevos)} sub={`${resumen.nuevos_pct}% del total`} />
        <Kpi label="Recurrentes" value={fmtNum(resumen.recurrentes)} sub="con registros previos" />
        <Kpi label="Visitas por paciente" value={String(resumen.promedio_visitas)} sub={`${resumen.promedio_atenciones} atenciones c/u`} />
      </div>

      <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '0 0 20px', lineHeight: 1.5 }}>
        {resumen.historia_desde
          ? <>«Nuevo» significa sin registros anteriores desde el {resumen.historia_desde}, no que nunca se haya atendido en la clínica.</>
          : <>«Nuevo» significa sin registros anteriores en los datos disponibles.</>}
        {' '}Una visita es una fecha distinta: un EMG y un VCN el mismo día son dos atenciones pero una sola visita.
      </p>

      {/* ── Gráficas ───────────────────────────────────────────────────────── */}
      <div className="charts-row">
        <div className="chart-card" ref={refFrecuencia}>
          <h2 className="chart-title">Distribución de frecuencia</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.frecuencia} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <RechartTooltip formatter={(v: number) => [fmtNum(v), 'Pacientes']} />
              <Bar dataKey="pacientes" radius={[4, 4, 0, 0]}>
                {data.frecuencia.map((_, i) => (
                  <Cell key={i} fill={['#93c5fd', '#60a5fa', '#3b82f6', '#1e40af'][i] ?? '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
            Visitas realizadas en el período por cada paciente.
          </p>
        </div>

        <div className="chart-card" ref={refRetencion}>
          <h2 className="chart-title">Retención mes a mes</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.retencion} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} unit="%" />
              <RechartTooltip formatter={(v: number) => [`${v}%`, 'Vuelven al mes siguiente']} />
              <Line type="monotone" dataKey="retencion_pct" stroke="#0e7490" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>
            Porcentaje de pacientes de cada mes que regresa al mes siguiente. El último mes
            queda vacío porque su mes siguiente aún no termina.
          </p>
        </div>
      </div>

      {/* ── Por pagador ────────────────────────────────────────────────────── */}
      <div className="chart-card">
        <h2 className="chart-title">Pacientes por tipo de pagador</h2>
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 10px' }}>
          Un paciente atendido por dos pagadores se cuenta en ambos, así que estas cifras
          <strong> no suman</strong> el total de pacientes únicos.
          {data.pacientes_multi_pagador > 0 && (
            <> En este período, <strong>{fmtNum(data.pacientes_multi_pagador)}</strong> pacientes
              se atendieron con más de un pagador.</>
          )}
        </p>
        <DimTable rows={data.por_pagador} primeraCol="TIPO DE PAGADOR" />
      </div>

      {/* ── Por servicio ───────────────────────────────────────────────────── */}
      <div className="chart-card">
        <h2 className="chart-title">Pacientes por servicio</h2>
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 10px' }}>
          Mismo criterio: un paciente con dos servicios aparece en ambos.
        </p>
        <DimTable rows={data.por_servicio} primeraCol="SERVICIO" />
      </div>

      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: 16 }}>
        El sistema no almacena edad, sexo, ciudad ni régimen del paciente: el Sheet de origen
        solo aporta nombre y documento. Para segmentar por esos criterios habría que agregarlos
        primero en la fuente.
      </p>
    </div>
  );
}
