import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Maximize, Minimize, X, Activity } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { useEstadoTv, type EstadoTv } from '../api/tv.js';
import NeuroficLogo from '../assets/NeuroficLogo.js';
import {
  HORA_INICIO, HORA_FIN, horaBogota, enHorarioLaboral, posicionEnJornada, valorEntreLecturas, suavizar,
  formatoCOP, formatoCorto, formatoNum, haceCuanto, horaTexto, saludDatos, textoMovimiento,
  proximosSieteDias, DIAS_CORTOS,
} from '../lib/tv.js';
import './tv.css';

/**
 * Pantalla de TV: una sola vista para dejar en un monitor de la oficina.
 *
 * «Vivo honesto»: los datos reales cambian cada 15–30 min como mucho (Medifolios solo
 * se consulta, no avisa). Para que la pantalla no esté quieta, los contadores avanzan
 * entre lecturas al RITMO REAL del día —con tope y marcados con «≈»— y se corrigen al
 * llegar el dato real. El resto del movimiento (el «ahora» que recorre la jornada, la
 * cinta, el foco rotativo) sale de datos reales. Ver `lib/tv.ts` y `docs/MODO-TV.md`.
 */

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CLAVE_INTERPOLAR = 'neurofic-tv-interpolar';
const CLAVE_MODO_TV = 'neurofic-tv';

// ─── Utilidades de la pantalla ────────────────────────────────────────────────

/** Se vuelve a renderizar cada `ms`: el reloj y la edad de los datos. */
function useAhora(ms = 1000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return ahora;
}

function leerBool(clave: string, porOmision: boolean): boolean {
  try { const v = localStorage.getItem(clave); return v === null ? porOmision : v === '1'; } catch { return porOmision; }
}

function msDe(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/**
 * Contador animado. Muestra el valor REAL de la última lectura más —si se permite— lo que
 * daría el ritmo del día desde la hora de esa lectura, con tope. Se acomoda con una
 * transición, también hacia abajo cuando llega un dato real menor.
 */
function Contador({
  valor, anclaMs, porHora, enHorario, topeMin, interpolar, formato, entero = false, className,
}: {
  valor: number;
  anclaMs: number | null;
  porHora: number | null;
  enHorario: boolean;
  topeMin: number;
  interpolar: boolean;
  formato: (n: number) => string;
  entero?: boolean;
  className?: string;
}): React.ReactElement {
  const mostrado = useRef(valor);
  const [texto, setTexto] = useState(() => formato(valor));
  const ultimoTexto = useRef(texto);

  // Los parámetros viajan en una ref: el temporizador no se reinicia con cada lectura.
  const params = useRef({ valor, anclaMs, porHora, enHorario, topeMin, interpolar, formato, entero });
  params.current = { valor, anclaMs, porHora, enHorario, topeMin, interpolar, formato, entero };

  useEffect(() => {
    let previo = Date.now();
    const id = setInterval(() => {
      const ahoraMs = Date.now();
      const p = params.current;
      const objetivo = p.interpolar && p.anclaMs !== null
        ? valorEntreLecturas({ ancla: p.valor, anclaMs: p.anclaMs, ahoraMs, porHora: p.porHora, enHorario: p.enHorario, topeMin: p.topeMin })
        : p.valor;
      mostrado.current = suavizar(mostrado.current, objetivo, ahoraMs - previo);
      previo = ahoraMs;
      const t = p.formato(p.entero ? Math.floor(mostrado.current + 1e-6) : mostrado.current);
      if (t !== ultimoTexto.current) { ultimoTexto.current = t; setTexto(t); }
    }, 100);
    return () => clearInterval(id);
  }, []);

  return <span className={className}>{texto}</span>;
}

// ─── Bloques ──────────────────────────────────────────────────────────────────

function Meta({ d }: { d: EstadoTv }): React.ReactElement {
  const m = d.meta;
  const pct = m.presupuesto > 0 ? (m.facturado_mes / m.presupuesto) * 100 : 0;
  const pctProy = m.presupuesto > 0 ? (m.proyectado / m.presupuesto) * 100 : 0;
  const ancho = Math.min(pct, 100);
  const anchoProy = Math.min(Math.max(pctProy, pct), 100) - ancho;
  const supera = pctProy > 100;

  return (
    <section className="tv-card tv-meta" data-testid="tv-meta">
      <header className="tv-card-t"><span>Meta de {MESES[m.mes_idx]}</span><span className="tv-chip">{m.dias_restantes} días hábiles restantes</span></header>
      <div className="tv-meta-fila">
        <Contador className="tv-grande" valor={pct} anclaMs={null} porHora={null} enHorario={false} topeMin={0} interpolar={false}
          formato={(n) => `${n.toFixed(1).replace('.', ',')} %`} />
        <div className="tv-meta-cifras">
          <div><span className="tv-etq">Facturado</span><b>{formatoCOP(m.facturado_mes)}</b></div>
          <div><span className="tv-etq">Meta</span><b>{formatoCOP(m.presupuesto)}</b></div>
        </div>
      </div>
      <div className="tv-barra" role="img" aria-label={`Cumplimiento ${pct.toFixed(1)} por ciento`}>
        <div className="tv-barra-real" style={{ width: `${ancho}%` }} />
        <div className="tv-barra-agenda" style={{ left: `${ancho}%`, width: `${anchoProy}%` }} />
        <div className="tv-barra-brillo" />
      </div>
      <div className="tv-meta-pie">
        <div>
          <span className="tv-etq">Proyectado (atendido + agendado)</span>
          <b className={supera ? 'tv-ok' : ''}>{formatoCorto(m.proyectado)} · {pctProy.toFixed(0)} %</b>
          <span className="tv-nota">techo: no descuenta a quienes no llegan</span>
        </div>
        <div>
          <span className="tv-etq">Por ritmo</span>
          <b>{formatoCorto(m.proyeccion_ritmo)}</b>
        </div>
        <div>
          <span className="tv-etq">Hoy es</span>
          <b>{d.hoy.split('-').reverse().join('/')}</b>
        </div>
      </div>
    </section>
  );
}

function FacturadoHoy({ d, interpolar, enHorario }: { d: EstadoTv; interpolar: boolean; enHorario: boolean }): React.ReactElement {
  const anclaMs = msDe(d.actualizado.consumos);
  const cad = d.actualizado.cadencia_consumos_min;
  const tope = Math.min(cad ?? 30, 60);
  const ritmo = d.ritmo.facturado_por_hora;
  const estimando = interpolar && enHorario && ritmo !== null && ritmo > 0 && anclaMs !== null;

  return (
    <section className="tv-card tv-hoy" data-testid="tv-hoy">
      <header className="tv-card-t"><span>Facturado hoy</span>{estimando && <span className="tv-chip tv-chip-est" title="Avanza al ritmo de hoy entre lecturas">≈ entre lecturas</span>}</header>
      <Contador className="tv-enorme" valor={d.meta.facturado_hoy} anclaMs={anclaMs} porHora={ritmo} enHorario={enHorario}
        topeMin={tope} interpolar={interpolar} formato={formatoCOP} />
      <div className="tv-real">
        <span>dato real: <b>{formatoCOP(d.meta.facturado_hoy)}</b></span>
        <span>{horaTexto(d.actualizado.consumos)}</span>
      </div>
      <div className="tv-ritmo">
        <Activity size={16} aria-hidden="true" />
        {ritmo !== null ? <>Ritmo de hoy: <b>{formatoCorto(ritmo)}</b> por hora</> : <>El ritmo se calcula pasada la primera media hora de jornada</>}
      </div>
    </section>
  );
}

function CitasHoy({ d, interpolar, ahora, enHorario }: { d: EstadoTv; interpolar: boolean; ahora: number; enHorario: boolean }): React.ReactElement {
  const c = d.citas_hoy;
  const anclaMs = msDe(c.actualizado_en);
  const ritmoAt = d.ritmo.atendidas_por_hora;
  const horas = useMemo(() => Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i), []);
  const porHora = useMemo(() => new Map(c.por_hora.map((x) => [x.hora, x])), [c.por_hora]);
  const max = Math.max(1, ...c.por_hora.map((x) => x.pendientes + x.atendidas + x.incumplidas));
  const pos = posicionEnJornada(ahora) * 100;
  const enJornada = enHorarioLaboral(ahora);

  return (
    <section className="tv-card tv-citas" data-testid="tv-citas">
      <header className="tv-card-t"><span>Citas de hoy</span><span className="tv-chip">{formatoNum(c.total)} en total · {horaTexto(c.actualizado_en)}</span></header>
      {!c.es_de_hoy ? (
        <p className="tv-vacio" data-testid="tv-citas-vacio">
          {c.lectura === 'error'
            ? 'No se pudieron leer las citas de hoy. Un administrador puede ver el motivo en Configuración → Diagnóstico.'
            : 'Esperando la primera lectura de las citas de hoy (se sincroniza cada 15 minutos).'}
        </p>
      ) : (
        <>
          <div className="tv-tres">
            <div className="tv-n tv-n-ok">
              <Contador className="tv-grande" valor={c.atendidas} anclaMs={anclaMs} porHora={ritmoAt} enHorario={enHorario}
                topeMin={15} interpolar={interpolar} formato={formatoNum} entero />
              <span>atendidas{enHorario && interpolar && ritmoAt !== null && ritmoAt > 0 ? ' ≈' : ''}</span>
            </div>
            <div className="tv-n tv-n-pend"><b className="tv-grande">{formatoNum(c.pendientes)}</b><span>pendientes</span></div>
            <div className="tv-n tv-n-no"><b className="tv-grande">{formatoNum(c.incumplidas)}</b><span>incumplidas</span></div>
          </div>
          <div className="tv-horas" aria-label="Citas por hora">
            {horas.map((h) => {
              const x = porHora.get(h);
              const tot = x ? x.pendientes + x.atendidas + x.incumplidas : 0;
              return (
                <div key={h} className="tv-hora">
                  <div className="tv-hora-barra" style={{ height: `${(tot / max) * 100}%` }}>
                    {x && <>
                      <i className="tv-seg tv-seg-ok" style={{ flex: x.atendidas }} />
                      <i className="tv-seg tv-seg-no" style={{ flex: x.incumplidas }} />
                      <i className="tv-seg tv-seg-pend" style={{ flex: x.pendientes }} />
                    </>}
                  </div>
                  <span>{h > 12 ? h - 12 : h}{h < 12 ? 'a' : 'p'}</span>
                </div>
              );
            })}
            {enJornada && <div className="tv-ahora" style={{ left: `${pos}%` }} data-testid="tv-ahora"><i /></div>}
          </div>
        </>
      )}
    </section>
  );
}

function Agenda({ d, giro }: { d: EstadoTv; giro: number }): React.ReactElement {
  const dias = useMemo(() => proximosSieteDias(d.hoy, d.agenda.proximos_dias), [d.hoy, d.agenda.proximos_dias]);
  const max = Math.max(1, ...dias.map((x) => x.valor));

  // Foco rotativo: datos reales del día, uno cada ~12 s.
  const focos = useMemo(() => {
    const out: Array<{ titulo: string; texto: string }> = [];
    const top = d.agenda.top_entidades[0];
    if (top) out.push({ titulo: 'EPS con más agenda', texto: `${top.entidad} · ${formatoCorto(top.valor)} en ${formatoNum(top.citas)} citas` });
    const pico = d.citas_hoy.por_hora.filter((x) => x.hora >= HORA_INICIO && x.hora < HORA_FIN).sort((a, b) => (b.pendientes + b.atendidas + b.incumplidas) - (a.pendientes + a.atendidas + a.incumplidas))[0];
    if (pico) out.push({ titulo: 'Hora más cargada de hoy', texto: `${pico.hora > 12 ? pico.hora - 12 : pico.hora}:00 ${pico.hora < 12 ? 'a. m.' : 'p. m.'} · ${formatoNum(pico.pendientes + pico.atendidas + pico.incumplidas)} citas` });
    const dia = [...dias].sort((a, b) => b.valor - a.valor)[0];
    if (dia && dia.valor > 0) out.push({ titulo: 'Día más cargado de la semana', texto: `${DIAS_CORTOS[dia.diaSemana]} ${dia.fecha.slice(8)} · ${formatoCorto(dia.valor)} en ${formatoNum(dia.citas)} citas` });
    if (out.length === 0) out.push({ titulo: 'Agenda', texto: 'Sin citas pendientes cargadas' });
    return out;
  }, [d.agenda.top_entidades, d.citas_hoy.por_hora, dias]);
  const foco = focos[giro % focos.length]!;

  return (
    <section className="tv-card tv-agenda" data-testid="tv-agenda">
      <header className="tv-card-t"><span>Agenda · próximos 7 días</span><span className="tv-chip">{formatoNum(d.agenda.total.citas)} pendientes en el mes</span></header>
      <div className="tv-dias">
        {dias.map((x, i) => (
          <div key={x.fecha} className={`tv-dia${i === 0 ? ' tv-dia-hoy' : ''}`}>
            <span className="tv-dia-v">{x.valor > 0 ? formatoCorto(x.valor) : '—'}</span>
            <div className="tv-dia-barra"><i style={{ height: `${(x.valor / max) * 100}%` }} /></div>
            <span>{DIAS_CORTOS[x.diaSemana]} {x.fecha.slice(8)}</span>
          </div>
        ))}
      </div>
      <div className="tv-foco" key={giro} data-testid="tv-foco">
        <span className="tv-etq">{foco.titulo}</span>
        <b>{foco.texto}</b>
      </div>
      {d.meta.agendado_mes.citas_sin_valor > 0 && (
        <p className="tv-nota">{formatoNum(d.meta.agendado_mes.citas_sin_valor)} citas sin precio de referencia no suman al valor.</p>
      )}
    </section>
  );
}

function Cinta({ d }: { d: EstadoTv }): React.ReactElement {
  const items = useMemo(() => {
    const m = d.movimientos.map(textoMovimiento);
    if (m.length === 0) m.push('Sin movimientos detectados todavía');
    m.push(`Citas actualizadas ${horaTexto(d.actualizado.citas)}`);
    m.push(`Facturación actualizada ${horaTexto(d.actualizado.consumos)}`);
    return m;
  }, [d.movimientos, d.actualizado.citas, d.actualizado.consumos]);
  // Se duplica para que el desplazamiento sea continuo y nunca quede quieta.
  const lista = [...items, ...items];
  return (
    <footer className="tv-cinta" data-testid="tv-cinta">
      <span className="tv-cinta-t">Movimientos</span>
      <div className="tv-cinta-v">
        <div className="tv-cinta-pista" style={{ animationDuration: `${Math.max(30, items.length * 7)}s` }}>
          {lista.map((t, i) => <span key={i} className="tv-cinta-i">{t}</span>)}
        </div>
      </div>
    </footer>
  );
}

/** Fuera de horario: cierre del día, tranquilo y atenuado. */
function Resumen({ d, ahora }: { d: EstadoTv; ahora: number }): React.ReactElement {
  const m = d.meta;
  const pct = m.presupuesto > 0 ? (m.facturado_mes / m.presupuesto) * 100 : 0;
  const hoy = horaBogota(ahora);
  const cierreDelDia = hoy.diaSemana !== 0 && hoy.hora >= HORA_FIN && d.citas_hoy.es_de_hoy;
  return (
    <main className="tv-resumen" data-testid="tv-resumen">
      <div className="tv-reloj-grande">{horaTexto(new Date(ahora).toISOString())}</div>
      <p className="tv-etq">Fuera de horario · se reanuda {hoy.diaSemana === 0 || (hoy.diaSemana === 6 && hoy.hora >= HORA_FIN) ? 'el lunes' : 'a las 6:00 a. m.'}</p>
      <div className="tv-resumen-cifras">
        {/* El cierre del día solo tiene sentido pasadas las 8 p. m. del mismo día: de madrugada o en
            domingo «hoy» ya es otro día, con $0 y 0 citas, y no es el cierre de nada. */}
        {cierreDelDia && <>
          <div><span className="tv-etq">Facturado hoy</span><b>{formatoCOP(m.facturado_hoy)}</b></div>
          <div><span className="tv-etq">Citas atendidas</span><b>{formatoNum(d.citas_hoy.atendidas)}</b></div>
          <div><span className="tv-etq">Incumplidas</span><b>{formatoNum(d.citas_hoy.incumplidas)}</b></div>
        </>}
        <div><span className="tv-etq">Meta de {MESES[m.mes_idx]}</span><b>{pct.toFixed(1).replace('.', ',')} %</b></div>
        <div><span className="tv-etq">Facturado del mes</span><b>{formatoCorto(m.facturado_mes)}</b></div>
      </div>
    </main>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

const TV_ROLES = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA'];

export default function Tv(): React.ReactElement {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const permitido = isAuthenticated && Boolean(user) && TV_ROLES.includes(user!.rol);
  const q = useEstadoTv(permitido);
  const ahora = useAhora(1000);
  const [interpolar, setInterpolar] = useState(() => leerBool(CLAVE_INTERPOLAR, true));
  const [pantallaCompleta, setPantallaCompleta] = useState(() => Boolean(document.fullscreenElement));
  const [controles, setControles] = useState(true);
  const [giro, setGiro] = useState(0);
  const [desplazo, setDesplazo] = useState({ x: 0, y: 0 });
  const versionInicial = useRef<string | null>(null);
  const ultimaActividad = useRef(Date.now());
  const [wakeLockOk, setWakeLockOk] = useState<boolean | null>(null);

  const d = q.data;
  const enHorario = enHorarioLaboral(ahora);

  // «Esta pantalla es una TV»: tras un reinicio y un nuevo inicio de sesión se vuelve aquí. Solo si
  // este usuario puede verla (si no, un usuario sin acceso dejaría la marca puesta para los demás).
  useEffect(() => {
    if (!permitido) return;
    try { localStorage.setItem(CLAVE_MODO_TV, '1'); } catch { /* sin almacenamiento */ }
  }, [permitido]);

  // Autorrecarga cuando se despliega una versión nueva: una página abierta semanas
  // se quedaría con el código viejo.
  useEffect(() => {
    if (!d) return;
    if (versionInicial.current === null) { versionInicial.current = d.version; return; }
    if (d.version !== versionInicial.current) window.location.reload();
  }, [d]);

  // Pantalla completa y sin dormirse. El permiso de pantalla completa exige un gesto del
  // usuario: lo pide el botón «Modo TV». El Wake Lock se pierde al ocultarse la pestaña y se renueva.
  useEffect(() => {
    let candado: { release: () => Promise<void> } | null = null;
    let vivo = true;
    const pedir = async (): Promise<void> => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        if (!nav.wakeLock) { setWakeLockOk(false); return; }
        const nuevo = await nav.wakeLock.request('screen');
        // Si la pantalla se cerró mientras se pedía, el candado recién concedido no debe quedar vivo.
        if (!vivo) { void nuevo.release().catch(() => undefined); return; }
        candado = nuevo;
        setWakeLockOk(true);
      } catch { if (vivo) setWakeLockOk(false); }
    };
    void pedir();
    const alVolver = (): void => { if (document.visibilityState === 'visible') void pedir(); };
    const alCambiarFs = (): void => setPantallaCompleta(Boolean(document.fullscreenElement));
    document.addEventListener('visibilitychange', alVolver);
    document.addEventListener('fullscreenchange', alCambiarFs);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', alVolver);
      document.removeEventListener('fullscreenchange', alCambiarFs);
      void candado?.release().catch(() => undefined);
    };
  }, []);

  // Los controles y el cursor se ocultan tras unos segundos sin mover el ratón.
  useEffect(() => {
    const mover = (): void => { ultimaActividad.current = Date.now(); setControles(true); };
    window.addEventListener('mousemove', mover);
    window.addEventListener('keydown', mover);
    const id = setInterval(() => { if (Date.now() - ultimaActividad.current > 5000) setControles(false); }, 1000);
    return () => { window.removeEventListener('mousemove', mover); window.removeEventListener('keydown', mover); clearInterval(id); };
  }, []);

  // Foco rotativo cada 12 s y desplazamiento lento de la imagen (contra el quemado del panel).
  useEffect(() => {
    const a = setInterval(() => setGiro((g) => g + 1), 12_000);
    const posiciones = [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: -6, y: 2 }, { x: 4, y: -6 }, { x: -4, y: -4 }];
    let i = 0;
    const b = setInterval(() => { i = (i + 1) % posiciones.length; setDesplazo(posiciones[i]!); }, 3 * 60_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const alternarPantallaCompleta = useCallback((): void => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const alternarInterpolar = (): void => {
    const nuevo = !interpolar;
    setInterpolar(nuevo);
    try { localStorage.setItem(CLAVE_INTERPOLAR, nuevo ? '1' : '0'); } catch { /* sin almacenamiento */ }
  };

  const salir = (): void => {
    try { localStorage.removeItem(CLAVE_MODO_TV); } catch { /* sin almacenamiento */ }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    navigate('/dashboard', { replace: true });
  };

  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!TV_ROLES.includes(user.rol)) return <Navigate to="/dashboard" replace />;

  // Mientras carga por primera vez no se alarma: «sin conexión» solo si ya falló.
  const salud = !d && !q.isError ? 'vivo' : saludDatos({
    ahoraMs: ahora,
    ultimaLecturaMs: q.dataUpdatedAt > 0 ? q.dataUpdatedAt : null,
    enHorario,
    consumos: { ms: msDe(d?.actualizado.consumos), cadenciaMin: d?.actualizado.cadencia_consumos_min ?? null },
    citas: d?.actualizado.citas ? { ms: msDe(d.actualizado.citas) } : null,
  });

  const tranquilo = !enHorario;
  const clases = `tv${tranquilo ? ' tv-tranquilo' : ''}${controles ? '' : ' tv-sin-controles'}`;

  return (
    <div className={clases} data-testid="tv" data-modo={tranquilo ? 'tranquilo' : 'normal'} data-salud={salud}>
      <div className="tv-lienzo" style={{ transform: `translate(${desplazo.x}px, ${desplazo.y}px)` }}>
        <header className="tv-cab">
          <div className="tv-marca"><NeuroficLogo size={44} /><div><b>Neurofic</b><span>Monitor de la clínica</span></div></div>
          <div className="tv-reloj" data-testid="tv-reloj">{horaTexto(new Date(ahora).toISOString())}</div>
          <div className="tv-estado">
            <span className={`tv-punto tv-punto-${salud}`} aria-hidden="true" />
            <span data-testid="tv-actualizado">
              {salud === 'sin_conexion' ? 'Sin conexión con el servidor' : salud === 'retrasado' ? 'Medifolios sin sincronizar' : 'En vivo'}
              {' · '}datos {d ? haceCuanto(ahora - (msDe(d.generado_en) ?? ahora)) : '—'}
            </span>
            <div className="tv-botones">
              <button type="button" onClick={alternarInterpolar} className={interpolar ? 'tv-on' : ''} title="Avanzar los contadores al ritmo de hoy entre lecturas (≈). Apagado: solo el dato real.">≈</button>
              <button type="button" onClick={alternarPantallaCompleta} title="Pantalla completa">{pantallaCompleta ? <Minimize size={18} /> : <Maximize size={18} />}</button>
              <button type="button" onClick={salir} title="Salir del modo TV"><X size={18} /></button>
            </div>
          </div>
        </header>

        {salud !== 'vivo' && (
          <div className="tv-aviso" role="alert" data-testid="tv-aviso">
            {salud === 'sin_conexion'
              ? `Sin respuesta del servidor desde ${horaTexto(q.dataUpdatedAt > 0 ? new Date(q.dataUpdatedAt).toISOString() : null)} — se muestra la última lectura`
              : `La última sincronización con Medifolios fue ${horaTexto(d?.actualizado.consumos ?? d?.actualizado.citas)} — las cifras pueden estar atrasadas`}
          </div>
        )}
        {wakeLockOk === false && controles && (
          <div className="tv-aviso tv-aviso-leve">Este navegador no puede evitar que el equipo se duerma: desactiva la suspensión en el sistema.</div>
        )}

        {!d ? (
          <main className="tv-cargando">{q.isError ? 'No se pudo cargar la pantalla.' : 'Cargando…'}</main>
        ) : tranquilo ? (
          <Resumen d={d} ahora={ahora} />
        ) : (
          <main className="tv-malla">
            <Meta d={d} />
            <FacturadoHoy d={d} interpolar={interpolar} enHorario={enHorario} />
            <CitasHoy d={d} interpolar={interpolar} ahora={ahora} enHorario={enHorario} />
            <Agenda d={d} giro={giro} />
          </main>
        )}
        {d && !tranquilo && <Cinta d={d} />}
      </div>
    </div>
  );
}
