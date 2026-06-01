import React, { useState, useMemo } from 'react';
import {
  Loader2, AlertCircle, ChevronLeft, ChevronRight, Info,
  RefreshCw, Check, Banknote, FileText, ChevronDown, ChevronUp,
  Calendar, RotateCcw,
} from 'lucide-react';
import {
  useLiquidaciones, useGenerarLiquidaciones,
  useAprobarLiquidacion, usePagarLiquidacion,
  useAprobarLote, usePagarLote,
  useRevertirLiquidacion,
  descargarPDF,
  type LiquidacionRow, type EstadoLiquidacion,
} from '../api/liquidaciones.js';
import {
  useAjustes, useCrearAjuste, useAutorizarAjuste, useRechazarAjuste, useEliminarAjuste,
  type AjusteRow,
} from '../api/ajustes.js';
import { useAuth } from '../hooks/useAuth.js';
import type { HonorariosCeldas, HonorariosProfesionalRow } from '../api/honorarios.js';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmtCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) => new Intl.NumberFormat('es-CO').format(n);

function parseHonDate(iso: string): Date {
  // Date-only YYYY-MM-DD → treat as local so day doesn't shift on UTC offset
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d);
  }
  // Datetime: if no tz info, treat as UTC (MySQL stores naive UTC timestamps)
  if (/[Z+\-]\d{2}:?\d{2}$/.test(iso) || iso.endsWith('Z')) return new Date(iso);
  return new Date(iso.replace(' ', 'T') + 'Z');
}

const fmtFecha = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = parseHonDate(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
};

const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ─── Estado badge ─────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoLiquidacion, { label: string; cls: string }> = {
  CALCULADO: { label: 'Calculado', cls: 'liq-badge liq-badge--calc' },
  APROBADO:  { label: 'Aprobado',  cls: 'liq-badge liq-badge--aprov' },
  PAGADO:    { label: 'Pagado',    cls: 'liq-badge liq-badge--paid' },
};

function EstadoBadge({ estado }: { estado: EstadoLiquidacion }) {
  const cfg = ESTADO_CFG[estado];
  return <span className={cfg.cls}>{cfg.label}</span>;
}

// ─── CATS para detalle ────────────────────────────────────────────────────────

const CATS: { key: keyof Omit<HonorariosProfesionalRow,'profesional_id'|'nombre'|'total'|'sin_regla'>; label: string }[] = [
  { key: 'consulta',       label: 'Consulta' },
  { key: 'emg_vcn',        label: 'EMG / VCN' },
  { key: 'infiltracion',   label: 'Infiltración' },
  { key: 'ecografia',      label: 'Ecografía' },
  { key: 'terapia_choque', label: 'Ondas de Choque' },
  { key: 'junta',          label: 'Junta Médica' },
  { key: 'eeg',            label: 'EEG' },
  { key: 'psg_lms',        label: 'PSG / MSLT' },
  { key: 'tlm',            label: 'Telemetría' },
  { key: 'pe',             label: 'Potenciales Evocados' },
];

// ─── Modal pagar ──────────────────────────────────────────────────────────────

function ModalPagar({
  liq,
  onConfirm,
  onClose,
}: {
  liq: LiquidacionRow;
  onConfirm: (notas: string) => void;
  onClose: () => void;
}) {
  const [notas, setNotas] = useState('');
  return (
    <div className="liq-modal-overlay" onClick={onClose}>
      <div className="liq-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="liq-modal-title">Registrar pago</h3>
        <p className="liq-modal-sub">
          <strong>{liq.profesional_display}</strong> — {fmtCOP(liq.monto_total)}
        </p>
        <label className="liq-modal-label">Notas (opcional)</label>
        <textarea
          className="liq-modal-textarea"
          rows={3}
          placeholder="Ej: Transferencia PSE #12345"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
        <div className="liq-modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn--primary" onClick={() => onConfirm(notas)}>
            <Banknote size={14} /> Confirmar pago
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal revertir ───────────────────────────────────────────────────────────

function ModalRevertir({
  liq,
  onConfirm,
  onClose,
}: {
  liq: LiquidacionRow;
  onConfirm: (razon: string) => void;
  onClose: () => void;
}) {
  const [razon, setRazon] = useState('');
  return (
    <div className="liq-modal-overlay" onClick={onClose}>
      <div className="liq-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="liq-modal-title" style={{ color: '#b45309' }}>Revertir a borrador</h3>
        <p className="liq-modal-sub">
          <strong>{liq.profesional_display}</strong> — {fmtCOP(liq.monto_total)}<br />
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            El registro volverá a estado <strong>Calculado</strong> y podrás revisarlo antes de aprobarlo nuevamente.
          </span>
        </p>
        <label className="liq-modal-label">Razón de reversión <span style={{ color: '#ef4444' }}>*</span></label>
        <textarea
          className="liq-modal-textarea"
          rows={3}
          placeholder="Ej: Valor incorrecto, faltan servicios adicionales..."
          value={razon}
          onChange={(e) => setRazon(e.target.value)}
          autoFocus
        />
        <div className="liq-modal-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn"
            style={{ background: '#f59e0b', color: '#fff' }}
            disabled={razon.trim().length < 5}
            onClick={() => onConfirm(razon.trim())}
          >
            <RotateCcw size={14} /> Revertir a borrador
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sección de ajustes manuales ─────────────────────────────────────────────

const CAT_OPTIONS = [
  { value: 'consulta',       label: 'Consulta' },
  { value: 'emg_vcn',        label: 'EMG / VCN' },
  { value: 'infiltracion',   label: 'Infiltración' },
  { value: 'ecografia',      label: 'Ecografía' },
  { value: 'terapia_choque', label: 'Ondas de Choque' },
  { value: 'junta',          label: 'Junta Médica' },
  { value: 'eeg',            label: 'EEG' },
  { value: 'psg_lms',        label: 'PSG / MSLT' },
  { value: 'tlm',            label: 'Telemetría' },
  { value: 'pe',             label: 'Potenciales Evocados' },
];

const ESTADO_AJ: Record<AjusteRow['estado'], { label: string; cls: string }> = {
  PENDIENTE:  { label: '⏳ Pendiente auth.',  cls: 'aj-badge aj-badge--pend' },
  AUTORIZADO: { label: '✓ Autorizado',        cls: 'aj-badge aj-badge--auth' },
  RECHAZADO:  { label: '✗ Rechazado',         cls: 'aj-badge aj-badge--rech' },
};

function AjustesSection({
  liquidacion,
  usuarioId,
  canAutorizar,
}: {
  liquidacion: LiquidacionRow;
  usuarioId: string;
  canAutorizar: boolean;
}) {
  const isPagado = liquidacion.estado === 'PAGADO';
  const { data: ajustes = [], isLoading } = useAjustes(liquidacion.id);
  const crear    = useCrearAjuste(liquidacion.id);
  const autorizar = useAutorizarAjuste();
  const rechazar  = useRechazarAjuste();
  const eliminar  = useEliminarAjuste();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    categoria: 'junta', descripcion: '', cantidad: 1,
    valor_unitario: 0, justificacion: '', referencia_doc: '',
  });
  const [rechazarModal, setRechazarModal] = useState<{ id: string } | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const handleCrear = () => {
    crear.mutate(
      { ...form, valor_unitario: Number(form.valor_unitario) },
      {
        onSuccess: () => {
          setShowForm(false);
          setForm({ categoria: 'junta', descripcion: '', cantidad: 1, valor_unitario: 0, justificacion: '', referencia_doc: '' });
        },
      }
    );
  };

  return (
    <div className="aj-section">
      <div className="aj-header">
        <span className="aj-title">Ajustes manuales</span>
        {!isPagado && (
          <button type="button" className="aj-btn-add" onClick={() => setShowForm(v => !v)}>
            {showForm ? '✕ Cancelar' : '+ Agregar ajuste'}
          </button>
        )}
      </div>

      {isLoading && <p className="aj-empty">Cargando…</p>}

      {ajustes.length === 0 && !showForm && (
        <p className="aj-empty">Sin ajustes para esta liquidación.</p>
      )}

      {ajustes.map((aj) => (
        <div key={aj.id} className={`aj-item ${aj.estado === 'RECHAZADO' ? 'aj-item--rech' : ''}`}>
          <div className="aj-item-top">
            <span className="aj-item-desc">
              <strong>{CAT_OPTIONS.find(c => c.value === aj.categoria)?.label ?? aj.categoria}</strong>
              {' · '}{aj.descripcion}
              {' · '}{fmtNum(aj.cantidad)} × {fmtCOP(aj.valor_unitario)}
              {' = '}<strong>{fmtCOP(aj.valor_total)}</strong>
            </span>
            <span className={ESTADO_AJ[aj.estado].cls}>{ESTADO_AJ[aj.estado].label}</span>
          </div>
          <p className="aj-item-just">
            "{aj.justificacion}"
            {aj.referencia_doc && <> · Ref: <em>{aj.referencia_doc}</em></>}
          </p>
          <div className="aj-item-meta">
            Registrado por <strong>{aj.creado_por_nombre ?? '—'}</strong>
            {aj.autorizado_por_nombre && <> · Autorizado por <strong>{aj.autorizado_por_nombre}</strong></>}
            {aj.motivo_rechazo && <> · Motivo: <em>{aj.motivo_rechazo}</em></>}
          </div>
          {aj.estado === 'PENDIENTE' && (
            <div className="aj-item-actions">
              {canAutorizar && aj.creado_por !== usuarioId && (
                <>
                  <button type="button" className="aj-btn aj-btn--auth"
                    onClick={() => autorizar.mutate(aj.id)}>
                    ✓ Autorizar
                  </button>
                  <button type="button" className="aj-btn aj-btn--rech"
                    onClick={() => setRechazarModal({ id: aj.id })}>
                    ✗ Rechazar
                  </button>
                </>
              )}
              {aj.creado_por === usuarioId && (
                <button type="button" className="aj-btn aj-btn--del"
                  onClick={() => eliminar.mutate({ id: aj.id, liquidacionId: liquidacion.id })}>
                  Eliminar
                </button>
              )}
              {canAutorizar && aj.creado_por === usuarioId && (
                <span className="aj-self-note">Registrado por ti — requiere autorización de otro usuario</span>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Formulario nuevo ajuste */}
      {showForm && (
        <div className="aj-form">
          <div className="aj-form-row">
            <div className="aj-form-field">
              <label>Categoría</label>
              <select className="aj-select" value={form.categoria}
                onChange={(e) => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {CAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="aj-form-field aj-form-field--grow">
              <label>Descripción del servicio</label>
              <input className="aj-input" type="text" placeholder="Ej: Junta 15 abr — paciente Juan Pérez"
                value={form.descripcion}
                onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))} />
            </div>
          </div>
          <div className="aj-form-row">
            <div className="aj-form-field">
              <label>Cantidad</label>
              <input className="aj-input" type="number" min={1} max={999}
                value={form.cantidad}
                onChange={(e) => setForm(f => ({ ...f, cantidad: parseInt(e.target.value) || 1 }))} />
            </div>
            <div className="aj-form-field">
              <label>Valor unitario (COP)</label>
              <input className="aj-input" type="number" min={1} placeholder="60000"
                value={form.valor_unitario || ''}
                onChange={(e) => setForm(f => ({ ...f, valor_unitario: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div className="aj-form-field aj-form-field--total">
              <label>Total</label>
              <span className="aj-total-preview">{fmtCOP(form.cantidad * form.valor_unitario)}</span>
            </div>
          </div>
          <div className="aj-form-row">
            <div className="aj-form-field aj-form-field--grow">
              <label>Justificación <span style={{ color: '#ef4444' }}>*</span></label>
              <input className="aj-input" type="text"
                placeholder="Mín. 10 caracteres — razón del ajuste manual"
                value={form.justificacion}
                onChange={(e) => setForm(f => ({ ...f, justificacion: e.target.value }))} />
            </div>
            <div className="aj-form-field">
              <label>Referencia / N° acta</label>
              <input className="aj-input" type="text" placeholder="Acta #23"
                value={form.referencia_doc}
                onChange={(e) => setForm(f => ({ ...f, referencia_doc: e.target.value }))} />
            </div>
          </div>
          {crear.error && (
            <p style={{ color: '#ef4444', fontSize: '12px' }}>
              {(crear.error as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Error al guardar'}
            </p>
          )}
          <div className="aj-form-actions">
            <span className="aj-form-note">
              ⚠ Este ajuste requerirá autorización de Gerencia o Dirección antes de sumarse al total.
            </span>
            <button type="button" className="btn btn--primary" disabled={crear.isPending ||
              form.descripcion.length < 3 || form.justificacion.length < 10 || form.valor_unitario <= 0}
              onClick={handleCrear}>
              {crear.isPending ? <><Loader2 size={13} className="spin" /> Guardando…</> : 'Guardar ajuste'}
            </button>
          </div>
        </div>
      )}

      {/* Modal rechazar */}
      {rechazarModal && (
        <div className="liq-modal-overlay" onClick={() => setRechazarModal(null)}>
          <div className="liq-modal" onClick={e => e.stopPropagation()}>
            <h3 className="liq-modal-title">Rechazar ajuste</h3>
            <label className="liq-modal-label">Motivo del rechazo <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea className="liq-modal-textarea" rows={3} value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Explica por qué se rechaza este ajuste…" />
            <div className="liq-modal-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setRechazarModal(null)}>Cancelar</button>
              <button type="button" className="btn" style={{ background: '#ef4444', color: '#fff' }}
                disabled={motivoRechazo.trim().length < 5}
                onClick={() => {
                  rechazar.mutate({ id: rechazarModal.id, motivo: motivoRechazo },
                    { onSuccess: () => { setRechazarModal(null); setMotivoRechazo(''); } });
                }}>
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fila expandible ──────────────────────────────────────────────────────────

function FilaLiquidacion({
  liq,
  checked,
  onCheck,
  onAprobar,
  onPagar,
  onRevertir,
  onPDF,
  usuarioId,
  canAutorizar,
}: {
  liq: LiquidacionRow;
  checked: boolean;
  onCheck: (id: string) => void;
  onAprobar: (liq: LiquidacionRow) => void;
  onPagar: (liq: LiquidacionRow) => void;
  onRevertir: (liq: LiquidacionRow) => void;
  onPDF: (liq: LiquidacionRow) => void;
  usuarioId: string;
  canAutorizar: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const snap = liq.datos_snapshot;

  const cats = CATS.filter((c) => (snap[c.key] as HonorariosCeldas).monto > 0);

  return (
    <>
      <tr className={`liq-tr ${checked ? 'liq-tr--checked' : ''}`}>
        <td className="liq-td liq-td--check">
          <input
            type="checkbox"
            className="liq-checkbox"
            checked={checked}
            disabled={liq.estado === 'PAGADO'}
            onChange={() => onCheck(liq.id)}
          />
        </td>
        <td className="liq-td liq-td--nombre">
          <div className="liq-nombre">{liq.profesional_display}</div>
          {liq.especialidad && <div className="liq-especialidad">{liq.especialidad}</div>}
        </td>
        <td className="liq-td liq-td--periodo">
          <div className="liq-periodo">{fmtFecha(liq.fecha_desde)} – {fmtFecha(liq.fecha_hasta)}</div>
        </td>
        <td className="liq-td liq-td--monto">{fmtCOP(liq.monto_total)}</td>
        <td className="liq-td liq-td--estado"><EstadoBadge estado={liq.estado} /></td>
        <td className="liq-td liq-td--acciones">
          <div className="liq-acciones">
            {liq.estado === 'CALCULADO' && (
              <button type="button" className="liq-btn liq-btn--aprov" onClick={() => onAprobar(liq)} title="Aprobar">
                <Check size={13} /> Aprobar
              </button>
            )}
            {liq.estado === 'APROBADO' && (
              <>
                <button type="button" className="liq-btn liq-btn--pay" onClick={() => onPagar(liq)} title="Pagar">
                  <Banknote size={13} /> Pagar
                </button>
                <button type="button" className="liq-btn liq-btn--revert" onClick={() => onRevertir(liq)} title="Revertir a borrador">
                  <RotateCcw size={13} />
                </button>
              </>
            )}
            {liq.estado !== 'CALCULADO' && (
              <button type="button" className="liq-btn liq-btn--pdf" onClick={() => onPDF(liq)} title="Descargar PDF">
                <FileText size={13} /> PDF
              </button>
            )}
            <button
              type="button"
              className="liq-btn liq-btn--detail"
              onClick={() => setExpanded((v) => !v)}
              title="Ver detalle"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="liq-tr--detail">
          <td colSpan={6}>
            <div className="liq-detail">
              <table className="liq-detail-table">
                <tbody>
                  {cats.map((c) => {
                    const celda = snap[c.key] as HonorariosCeldas;
                    return (
                      <tr key={c.key}>
                        <td className="liq-detail-cat">{c.label}</td>
                        <td className="liq-detail-cnt">{fmtNum(celda.cnt)}</td>
                        <td className="liq-detail-monto">{fmtCOP(celda.monto)}</td>
                      </tr>
                    );
                  })}
                  {snap.sin_regla?.monto > 0 && (
                    <tr className="liq-detail-sinregla">
                      <td>Sin regla (facturado)</td>
                      <td>{fmtNum(snap.sin_regla.cnt)}</td>
                      <td>{fmtCOP(snap.sin_regla.monto)}</td>
                    </tr>
                  )}
                  <tr className="liq-detail-total">
                    <td><strong>Total honorarios</strong></td>
                    <td></td>
                    <td><strong>{fmtCOP(liq.monto_total)}</strong></td>
                  </tr>
                </tbody>
              </table>
              {liq.aprobado_en && (
                <p className="liq-detail-meta">
                  Aprobado por <strong>{liq.aprobado_por_nombre}</strong> el {fmtFecha(liq.aprobado_en)}
                </p>
              )}
              {liq.pagado_en && (
                <p className="liq-detail-meta">
                  Pagado por <strong>{liq.pagado_por_nombre}</strong> el {fmtFecha(liq.pagado_en)}
                  {liq.notas && <> · <em>{liq.notas}</em></>}
                </p>
              )}
              <AjustesSection
                liquidacion={liq}
                usuarioId={usuarioId}
                canAutorizar={canAutorizar}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Selector de período ──────────────────────────────────────────────────────

function primeroDelMes(anio: number, mes: number) {
  return `${anio}-${String(mes).padStart(2, '0')}-01`;
}
function ultimoDelMes(anio: number, mes: number) {
  return new Date(anio, mes, 0).toISOString().substring(0, 10);
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Honorarios(): React.ReactElement {
  const { user } = useAuth();
  const usuarioId   = user?.id ?? '';
  const canAutorizar = ['ADMIN', 'GERENCIA', 'DIRECCION'].includes(user?.rol ?? '');

  const now = new Date();
  const [mes, setMes]   = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [modoRango, setModoRango] = useState(false);
  const [rangoDesde, setRangoDesde] = useState(primeroDelMes(now.getFullYear(), now.getMonth() + 1));
  const [rangoHasta, setRangoHasta] = useState(ultimoDelMes(now.getFullYear(), now.getMonth() + 1));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pagarModal, setPagarModal]     = useState<LiquidacionRow | null>(null);
  const [revertirModal, setRevertirModal] = useState<LiquidacionRow | null>(null);

  const fechaDesde = modoRango ? rangoDesde : primeroDelMes(anio, mes);
  const fechaHasta = modoRango ? rangoHasta : ultimoDelMes(anio, mes);

  const { data: rows = [], isLoading, isError } = useLiquidaciones(fechaDesde, fechaHasta);
  const generar   = useGenerarLiquidaciones();
  const aprobar1  = useAprobarLiquidacion();
  const pagar1    = usePagarLiquidacion();
  const revertir1 = useRevertirLiquidacion();
  const aprobarL  = useAprobarLote();
  const pagarL    = usePagarLote();

  // KPIs
  const kpis = useMemo(() => {
    const acumulado = rows.reduce((s, r) => s + r.monto_total, 0);
    const aprobado  = rows.filter((r) => r.estado === 'APROBADO' || r.estado === 'PAGADO').reduce((s, r) => s + r.monto_total, 0);
    const pagado    = rows.filter((r) => r.estado === 'PAGADO').reduce((s, r) => s + r.monto_total, 0);
    return { acumulado, aprobado, pagado };
  }, [rows]);

  // Selection helpers
  const selectableIds = rows.filter((r) => r.estado !== 'PAGADO').map((r) => r.id);
  const toggleAll = () => {
    if (selected.size === selectableIds.length) setSelected(new Set());
    else setSelected(new Set(selectableIds));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectedRows = rows.filter((r) => selected.has(r.id));
  const canAprobarLote = selectedRows.some((r) => r.estado === 'CALCULADO');
  const canPagarLote   = selectedRows.some((r) => r.estado === 'APROBADO');

  const prevMes = () => {
    if (mes === 1) { setMes(12); setAnio(a => a - 1); }
    else setMes(m => m - 1);
    setSelected(new Set());
  };
  const nextMes = () => {
    if (anio > now.getFullYear() || (anio === now.getFullYear() && mes >= now.getMonth() + 1)) return;
    if (mes === 12) { setMes(1); setAnio(a => a + 1); }
    else setMes(m => m + 1);
    setSelected(new Set());
  };

  const handleGenerar = () => {
    generar.mutate({ fechaDesde, fechaHasta });
    setSelected(new Set());
  };

  return (
    <div className="page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="hon-header">
        <div>
          <h1 className="page-title">Honorarios Médicos</h1>
          <p className="page-subtitle">Liquidación por período — aprueba y registra el pago por profesional</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          {/* Selector mes */}
          {!modoRango && (
            <div className="hon-period-picker">
              <button type="button" className="hon-period-btn" onClick={prevMes}><ChevronLeft size={16} /></button>
              <span className="hon-period-label">{MESES[mes]} {anio}</span>
              <button type="button" className="hon-period-btn" onClick={nextMes}><ChevronRight size={16} /></button>
            </div>
          )}

          {/* Rango personalizado */}
          {modoRango && (
            <div className="liq-rango">
              <input type="date" className="liq-date-input" value={rangoDesde}
                onChange={(e) => setRangoDesde(e.target.value)} />
              <span style={{ color: '#64748b' }}>—</span>
              <input type="date" className="liq-date-input" value={rangoHasta}
                onChange={(e) => setRangoHasta(e.target.value)} />
            </div>
          )}

          <button
            type="button"
            className={`liq-btn-rango ${modoRango ? 'liq-btn-rango--active' : ''}`}
            onClick={() => { setModoRango(v => !v); setSelected(new Set()); }}
          >
            <Calendar size={13} /> {modoRango ? 'Usar mes completo' : 'Período parcial'}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="liq-kpis">
        <div className="liq-kpi">
          <span className="liq-kpi-label">Acumulado total</span>
          <span className="liq-kpi-value">{fmtCOP(kpis.acumulado)}</span>
          <span className="liq-kpi-sub">{rows.length} profesionales</span>
        </div>
        <div className="liq-kpi liq-kpi--aprov">
          <span className="liq-kpi-label">Aprobado</span>
          <span className="liq-kpi-value">{fmtCOP(kpis.aprobado)}</span>
          <span className="liq-kpi-sub">{rows.filter(r => r.estado === 'APROBADO' || r.estado === 'PAGADO').length} prof.</span>
        </div>
        <div className="liq-kpi liq-kpi--paid">
          <span className="liq-kpi-label">Pagado</span>
          <span className="liq-kpi-value">{fmtCOP(kpis.pagado)}</span>
          <span className="liq-kpi-sub">{rows.filter(r => r.estado === 'PAGADO').length} prof.</span>
        </div>
        <div className="liq-kpi-action">
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleGenerar}
            disabled={generar.isPending}
          >
            {generar.isPending
              ? <><Loader2 size={14} className="spin" /> Calculando…</>
              : <><RefreshCw size={14} /> {rows.length > 0 ? 'Recalcular' : 'Generar liquidaciones'}</>
            }
          </button>
          <p className="liq-kpi-hint">
            {rows.length > 0
              ? 'Recalcula los montos. Los aprobados/pagados no se modifican.'
              : 'Genera los registros de liquidación para este período.'}
          </p>
        </div>
      </div>

      {/* ── Estados / errores ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className="page-loading">
          <Loader2 size={24} className="spin" style={{ color: '#3b82f6' }} />
          <p style={{ color: '#64748b', marginTop: '8px' }}>Cargando liquidaciones…</p>
        </div>
      )}
      {isError && (
        <div className="reportes-error"><AlertCircle size={16} />Error al cargar las liquidaciones.</div>
      )}
      {generar.isError && (
        <div className="reportes-error"><AlertCircle size={16} />Error al generar las liquidaciones.</div>
      )}

      {/* ── Banner vacío ───────────────────────────────────────────────────── */}
      {!isLoading && rows.length === 0 && (
        <div className="entidades-config-banner" style={{ marginTop: '16px' }}>
          <Info size={14} style={{ flexShrink: 0 }} />
          <span>
            No hay liquidaciones para este período. Haz clic en <strong>Generar liquidaciones</strong> para calcularlas
            desde los registros de facturación.
          </span>
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <>
          {/* Toolbar de selección masiva */}
          {selected.size > 0 && (
            <div className="liq-bulk-bar">
              <span className="liq-bulk-info">{selected.size} seleccionado{selected.size > 1 ? 's' : ''}</span>
              {canAprobarLote && (
                <button
                  type="button"
                  className="liq-btn liq-btn--aprov"
                  disabled={aprobarL.isPending}
                  onClick={() => {
                    const ids = [...selected].filter(id => rows.find(r => r.id === id)?.estado === 'CALCULADO');
                    aprobarL.mutate(ids, { onSuccess: () => setSelected(new Set()) });
                  }}
                >
                  <Check size={13} /> Aprobar seleccionados
                </button>
              )}
              {canPagarLote && (
                <button
                  type="button"
                  className="liq-btn liq-btn--pay"
                  disabled={pagarL.isPending}
                  onClick={() => {
                    const ids = [...selected].filter(id => rows.find(r => r.id === id)?.estado === 'APROBADO');
                    pagarL.mutate(ids, { onSuccess: () => setSelected(new Set()) });
                  }}
                >
                  <Banknote size={13} /> Marcar como pagado
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={() => setSelected(new Set())}>
                Deseleccionar
              </button>
            </div>
          )}

          <div className="liq-table-wrap">
            <table className="liq-table">
              <thead>
                <tr>
                  <th className="liq-th liq-th--check">
                    <input
                      type="checkbox"
                      className="liq-checkbox"
                      checked={selected.size === selectableIds.length && selectableIds.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="liq-th">Profesional</th>
                  <th className="liq-th">Período</th>
                  <th className="liq-th liq-th--r">Total honorario</th>
                  <th className="liq-th">Estado</th>
                  <th className="liq-th">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((liq) => (
                  <FilaLiquidacion
                    key={liq.id}
                    liq={liq}
                    checked={selected.has(liq.id)}
                    onCheck={toggleOne}
                    onAprobar={(l) => aprobar1.mutate(l.id)}
                    onPagar={(l) => setPagarModal(l)}
                    onRevertir={(l) => setRevertirModal(l)}
                    onPDF={(l) => void descargarPDF(l.id, l.profesional_display)}
                    usuarioId={usuarioId}
                    canAutorizar={canAutorizar}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Modal revertir ─────────────────────────────────────────────────── */}
      {revertirModal && (
        <ModalRevertir
          liq={revertirModal}
          onConfirm={(razon) => {
            revertir1.mutate({ id: revertirModal.id, razon }, { onSuccess: () => setRevertirModal(null) });
          }}
          onClose={() => setRevertirModal(null)}
        />
      )}

      {/* ── Modal pagar ────────────────────────────────────────────────────── */}
      {pagarModal && (
        <ModalPagar
          liq={pagarModal}
          onConfirm={(notas) => {
            pagar1.mutate({ id: pagarModal.id, notas }, { onSuccess: () => setPagarModal(null) });
          }}
          onClose={() => setPagarModal(null)}
        />
      )}

      {/* ── Nota al pie ────────────────────────────────────────────────────── */}
      <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '16px' }}>
        Los valores calculados se basan en las reglas de liquidación vigentes.
        Los registros <strong>Aprobados</strong> y <strong>Pagados</strong> quedan bloqueados y no se modifican al recalcular.
        El PDF se genera con el snapshot del momento de creación.
      </p>
    </div>
  );
}
