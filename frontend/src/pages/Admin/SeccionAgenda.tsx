import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, AlertTriangle, CheckCircle, RefreshCw, FlaskConical } from 'lucide-react';
import {
  useAgendaDiagnostico, useSincronizarCitas, useEjecutarBacktest,
  type PermisoAgenda, type FilaBacktestAgenda,
} from '../../api/reportes.js';

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('es-CO');

/** `YYYY-MM-DD HH:MM:SS` (UTC, del servidor) → fecha y hora locales legibles. */
function fechaLocal(s: string | null | undefined): string {
  if (!s) return '—';
  const t = Date.parse(`${s.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'}`);
  return Number.isFinite(t) ? new Date(t).toLocaleString('es-CO') : s;
}

/** Mensaje que devolvió el servidor (p. ej. «ya hay una sincronización en curso»), o uno por omisión. */
function mensajeDe(err: unknown, porOmision: string): string {
  const m = (err as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof m === 'string' && m ? m : porOmision;
}

const pct = (v: number | null): string => (v === null ? '—' : `${Math.round(v * 100)}%`);

function Permiso({ nombre, codigo, estado, detalle, opcional }: {
  nombre: string; codigo: string; estado: PermisoAgenda; detalle?: string | null; opcional?: boolean;
}): React.ReactElement {
  const ok = estado === 'ok';
  const malo = estado === 'sin_permiso' || estado === 'error';
  const color = ok ? '#10b981' : malo ? (opcional ? '#f59e0b' : '#ef4444') : '#94a3b8';
  const texto = ok ? 'Funciona'
    : estado === 'sin_permiso' ? 'Sin permiso'
    : estado === 'error' ? 'Error'
    : 'Aún no se ha probado';
  return (
    <div data-testid={`permiso-${codigo}`} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0' }}>
      {ok ? <CheckCircle size={15} style={{ color, flexShrink: 0, marginTop: 2 }} />
        : <AlertTriangle size={15} style={{ color, flexShrink: 0, marginTop: 2 }} />}
      <div>
        <strong>{nombre}</strong> <code>{codigo}</code> — <span style={{ color }}>{texto}</span>
        {opcional && estado !== 'ok' && (
          <span style={{ color: '#64748b' }}> (opcional: sin él la EPS se vincula por nombre)</span>
        )}
        {detalle && (estado === 'sin_permiso' || estado === 'error') && <div style={{ color: '#64748b', fontSize: 12 }}>{detalle}</div>}
      </div>
    </div>
  );
}

function TablaBacktest({ filas, total }: { filas: FilaBacktestAgenda[]; total: Omit<FilaBacktestAgenda, 'entidadKey' | 'entidad'> }): React.ReactElement {
  return (
    <div className="tabla-entidades-wrapper">
      <table className="tabla-entidades-table" data-testid="tabla-backtest" style={{ fontSize: 13 }}>
        <thead>
          <tr>
            <th className="tabla-entidades-th">EPS</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Cumplidas</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Incumplidas</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Estimado</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Facturado real</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Cobertura</th>
            <th className="tabla-entidades-th" style={{ textAlign: 'right' }}>Inasistencia</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.entidadKey} className="tabla-entidades-tr">
              <td className="tabla-entidades-td tabla-entidades-nombre">{f.entidad}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{NUM.format(f.cumplidas)}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{NUM.format(f.incumplidas)}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>
                {COP.format(f.estimado)}
                {f.sinPrecio > 0 && <span style={{ color: '#f59e0b' }} title="Citas sin precio de referencia"> · {f.sinPrecio} sin precio</span>}
              </td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{COP.format(f.real)}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right', fontWeight: 500 }}>{pct(f.cobertura)}</td>
              <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{pct(f.inasistencia)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc', fontWeight: 600 }}>
            <td className="tabla-entidades-td">TOTAL</td>
            <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{NUM.format(total.cumplidas)}</td>
            <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{NUM.format(total.incumplidas)}</td>
            <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{COP.format(total.estimado)}</td>
            <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{COP.format(total.real)}</td>
            <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{pct(total.cobertura)}</td>
            <td className="tabla-entidades-td" style={{ textAlign: 'right' }}>{pct(total.inasistencia)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Proyección por agenda — estado de la sincronización de citas, permisos, qué no
 * se pudo vincular o valorar, y el backtest.
 *
 * Esta pantalla existe porque el mapeo de la API se escribió contra su
 * especificación sin poder llamarla: aquí es donde el propio servidor dice si
 * funcionó.
 */
export default function SeccionAgenda(): React.ReactElement {
  // Tras pedir una sincronización se consulta cada 5 s durante ~90 s; mientras el
  // backtest corre, mientras dure (sin tope: corta solo cuando el servidor lo cierra).
  const [esperandoSync, setEsperandoSync] = useState(false);
  const [backtestCorriendo, setBacktestCorriendo] = useState(false);
  const { data, isLoading, isError, refetch } = useAgendaDiagnostico(esperandoSync || backtestCorriendo ? 5000 : false);
  const sincronizar = useSincronizarCitas();
  const backtest = useEjecutarBacktest();

  const corriendo = data?.backtest?.estado === 'corriendo';
  useEffect(() => { setBacktestCorriendo(corriendo); }, [corriendo]);
  useEffect(() => {
    if (!sincronizar.isSuccess) return;
    setEsperandoSync(true);
    const t = setTimeout(() => setEsperandoSync(false), 90_000);
    return () => clearTimeout(t);
  }, [sincronizar.isSuccess, sincronizar.submittedAt]);

  if (isLoading) {
    return <div style={{ padding: '1rem' }}><Loader2 size={18} className="spin" /> Leyendo estado de la agenda…</div>;
  }
  if (isError || !data) {
    return (
      <div className="reportes-error">
        <AlertCircle size={16} /> No se pudo leer el estado de la agenda.
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void refetch()}>Reintentar</button>
      </div>
    );
  }

  if (!data.configurada) {
    return (
      <section data-testid="agenda-diag" className="diag-month-block" style={{ marginBottom: 24 }}>
        <div className="diag-month-header"><span className="diag-month-label">Proyección por agenda</span></div>
        <p style={{ padding: '12px 16px', color: '#64748b' }}>
          La agenda de citas no está activada. Actívala en <strong>Configuración → Fuentes</strong>, editando el
          conector de Medifolios y marcando <strong>«Agenda de citas»</strong>. El usuario de la API necesita el
          permiso <code>01010202</code>.
        </p>
      </section>
    );
  }

  const e = data.estado;
  const r = data.resumen;
  const bt = data.backtest;
  const sinEntidad = data.conveniosSinEntidad ?? [];
  const sinPrecio = data.citasSinPrecio ?? [];

  return (
    <section data-testid="agenda-diag" className="diag-month-block" style={{ marginBottom: 24 }}>
      <div className="diag-month-header">
        <span className="diag-month-label">Proyección por agenda</span>
        <span className="diag-month-totals">{data.conector?.nombre}</span>
      </div>

      <div style={{ padding: '12px 16px' }}>
        {/* Estado de la sincronización */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Última sincronización correcta</div>
            <div data-testid="agenda-ultima-ok" style={{ fontWeight: 600 }}>{fechaLocal(e?.ultimaOk)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Citas cargadas</div>
            <div data-testid="agenda-citas" style={{ fontWeight: 600 }}>{NUM.format(r?.citas ?? 0)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Agenda cargada hasta</div>
            <div style={{ fontWeight: 600 }}>{e?.horizonte ?? '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Duración</div>
            <div style={{ fontWeight: 600 }}>{e?.duracionMs ? `${Math.round(e.duracionMs / 1000)} s` : '—'}</div>
          </div>
          <button
            type="button" className="btn btn--secondary btn--sm" data-testid="btn-sincronizar-citas"
            disabled={sincronizar.isPending}
            onClick={() => sincronizar.mutate()}
          >
            {sincronizar.isPending ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Sincronizar citas ahora
          </button>
        </div>
        {sincronizar.isSuccess && (
          <p style={{ color: '#166534', fontSize: 13 }}>Sincronización pedida: tarda cerca de un minuto. Esta pantalla se actualiza sola.</p>
        )}
        {sincronizar.isError && <p data-testid="sync-error" style={{ color: '#b91c1c', fontSize: 13 }}>{mensajeDe(sincronizar.error, 'No se pudo pedir la sincronización.')}</p>}

        {e?.estado === 'error' && (
          <div className="entidades-config-banner" data-testid="agenda-error" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
            <AlertCircle size={14} />
            <span>
              La última sincronización falló{e.httpStatus ? ` (HTTP ${e.httpStatus})` : ''}: {(e.error ?? 'sin detalle').replace(/\.+$/, '')}.
              {e.ultimaOk ? ' Se conservan las últimas citas cargadas correctamente.' : ' Todavía no hay citas cargadas.'}
            </span>
          </div>
        )}

        {/* Citas de hoy para la pantalla de TV */}
        <h4 style={{ margin: '16px 0 4px' }}>Citas de hoy (pantalla de TV)</h4>
        <div data-testid="agenda-tv" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {e?.tvEstado === 'ok'
            ? <CheckCircle size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
            : <AlertTriangle size={15} style={{ color: e?.tvEstado === 'error' ? '#ef4444' : '#94a3b8', flexShrink: 0, marginTop: 2 }} />}
          <div>
            {e?.tvEstado === 'ok' && <>Se leyeron correctamente · {fechaLocal(e.tvActualizado)}</>}
            {e?.tvEstado === 'error' && <>La última lectura falló · {fechaLocal(e.tvActualizado)}<div style={{ color: '#64748b', fontSize: 12 }}>{e.tvError}</div></>}
            {!e?.tvEstado && <>Aún no se ha leído (corre tras cada sincronización de citas).</>}
          </div>
        </div>

        {/* Citas incumplidas (columna y tarjeta de Reportes) */}
        <h4 style={{ margin: '16px 0 4px' }}>Citas incumplidas (Reportes)</h4>
        <div data-testid="agenda-incumplidas" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {data.incumplidas?.estado === 'ok'
            ? <CheckCircle size={15} style={{ color: '#10b981', flexShrink: 0, marginTop: 2 }} />
            : <AlertTriangle size={15} style={{ color: data.incumplidas?.estado === 'error' ? '#ef4444' : '#94a3b8', flexShrink: 0, marginTop: 2 }} />}
          <div>
            {data.incumplidas?.estado === 'ok' && <>Cargadas del {data.incumplidas.desde ?? '—'} al {data.incumplidas.hasta ?? '—'} · última sincronización {fechaLocal(data.incumplidas.ultimaOk)}</>}
            {data.incumplidas?.estado === 'error' && <>
              La última sincronización falló (se conserva lo cargado; desde el {data.incumplidas.desde ?? '—'}).
              <div style={{ color: '#64748b', fontSize: 12 }}>{data.incumplidas.error}</div>
            </>}
            {(!data.incumplidas || data.incumplidas.estado === 'nunca') && <>Aún no se han sincronizado (corre tras cada sincronización de citas).</>}
            <div style={{ color: '#64748b', fontSize: 12 }}>
              Se guardan cuántas citas cumplidas e incumplidas hay por día y EPS (para el % de incumplimiento). Cada vuelta recarga los últimos 7 días, una vez al día el mes anterior, y suma un mes más de histórico hasta el 1 de enero del año anterior.
            </div>
          </div>
        </div>

        {/* Permisos */}
        <h4 style={{ margin: '16px 0 4px' }}>Permisos del usuario de la API</h4>
        <Permiso nombre="Citas" codigo="01010202" estado={data.permisos?.citas ?? 'desconocido'} />
        <Permiso nombre="Convenios" codigo="01041504" estado={data.permisos?.convenios ?? 'desconocido'} detalle={e?.conveniosError} opcional />

        {/* Calidad de la valoración */}
        <h4 style={{ margin: '16px 0 4px' }}>Calidad de los datos</h4>
        <p style={{ margin: 0 }} data-testid="agenda-calidad">
          {NUM.format(r?.conPrecio ?? 0)} citas con precio de referencia ·{' '}
          <span style={{ color: (r?.sinPrecio ?? 0) > 0 ? '#f59e0b' : undefined }}>{NUM.format(r?.sinPrecio ?? 0)} sin precio</span> ·{' '}
          <span style={{ color: (r?.sinEntidad ?? 0) > 0 ? '#f59e0b' : undefined }}>{NUM.format(r?.sinEntidad ?? 0)} sin EPS vinculada</span>
        </p>
        <p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>
          Una cita sin precio se muestra como «sin valor», nunca como $0. Se valora con la mediana de lo facturado por visita
          de ese tipo de servicio y esa EPS en los últimos 90 días.
        </p>

        {sinEntidad.length > 0 && (
          <>
            <h4 style={{ margin: '16px 0 4px' }}>Convenios sin EPS vinculada</h4>
            <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 4px' }}>
              Agrega el nombre del convenio como alias de la entidad correcta en Configuración → Entidades.
            </p>
            <ul data-testid="agenda-sin-entidad" style={{ margin: 0, paddingLeft: 18 }}>
              {sinEntidad.map((c) => <li key={c.convenio}>{c.convenio} — {NUM.format(c.citas)} citas</li>)}
            </ul>
          </>
        )}

        {sinPrecio.length > 0 && (
          <>
            <h4 style={{ margin: '16px 0 4px' }}>Citas sin precio de referencia</h4>
            <ul data-testid="agenda-sin-precio" style={{ margin: 0, paddingLeft: 18 }}>
              {sinPrecio.map((c) => <li key={`${c.referencia}|${c.convenio}`}>{c.referencia} · {c.convenio} — {NUM.format(c.citas)} citas</li>)}
            </ul>
          </>
        )}

        {/* Backtest */}
        <h4 style={{ margin: '20px 0 4px' }}>Precisión del método</h4>
        <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px' }}>
          Toma las citas del mes pasado, las valora con el historial <strong>anterior</strong> a ese mes y compara, por EPS, lo estimado de las
          cumplidas contra lo realmente facturado. Mide la <strong>valoración</strong> (cuánto vale una cita), no si las citas se agendaron bien.
          La cobertura es normal que quede algo por debajo de 100 %: lo facturado incluye atenciones que no nacieron de una cita. Lo que importa es
          que sea estable y parecida entre EPS.
        </p>
        <button
          type="button" className="btn btn--secondary btn--sm" data-testid="btn-backtest"
          disabled={backtest.isPending || corriendo}
          onClick={() => backtest.mutate()}
        >
          {backtest.isPending || corriendo ? <Loader2 size={14} className="spin" /> : <FlaskConical size={14} />} Evaluar precisión del mes pasado
        </button>
        {backtest.isError && <p data-testid="backtest-no-inicia" style={{ color: '#b91c1c', fontSize: 13 }}>{mensajeDe(backtest.error, 'No se pudo iniciar la evaluación.')}</p>}
        {corriendo && <p style={{ fontSize: 13, color: '#1e40af' }} data-testid="backtest-corriendo">Evaluando… puede tardar unos minutos. Esta pantalla se actualiza sola.</p>}
        {bt?.estado === 'error' && (
          <div className="entidades-config-banner" data-testid="backtest-error" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', marginTop: 8 }}>
            <AlertCircle size={14} /><span>La evaluación falló: {bt.error ?? 'sin detalle'}.</span>
          </div>
        )}
        {bt?.estado === 'ok' && bt.resultado && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Mes evaluado: {bt.resultado.mes} · terminó {fechaLocal(bt.terminado)}</div>
            <TablaBacktest filas={bt.resultado.filas} total={bt.resultado.total} />
          </div>
        )}
      </div>
    </section>
  );
}
