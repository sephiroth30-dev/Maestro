import React, { useState, useMemo } from 'react';
import {
  UserPlus, Pencil, Trash2, KeyRound, Loader2,
  CheckCircle, AlertCircle, X, Eye, EyeOff, ShieldCheck,
} from 'lucide-react';
import {
  useUsuarios, useCreateUsuario, useUpdateUsuario,
  useDeleteUsuario, useResetPassword,
} from '../../api/usuarios.js';
import type { UsuarioRow } from '../../api/usuarios.js';
import type { Rol, Modulo } from '../../types/index.js';
import { ROL_LABELS, MODULO_LABELS } from '../../types/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useSortState } from '../../components/SortableHeader.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────


const ROL_COLORS: Record<Rol, string> = {
  ADMIN:            '#7c3aed',
  GERENCIA:         '#0369a1',
  DIRECCION:        '#0891b2',
  FACTURACION:      '#065f46',
  COORDINADORA:     '#92400e',
  ADMISIONES:       '#475569',
  RECURSOS_HUMANOS: '#b45309',
};

function rolBadge(rol: Rol): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
        background: ROL_COLORS[rol] + '18',
        color: ROL_COLORS[rol],
        border: `1px solid ${ROL_COLORS[rol]}30`,
      }}
    >
      {ROL_LABELS[rol] ?? rol}
    </span>
  );
}

function initials(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((n) => n[0]?.toUpperCase() ?? '').join('');
}

// ─── Module access map ────────────────────────────────────────────────────────

interface ModuleAccess {
  label: string;
  color: string;
  roles: Rol[];
  note?: (rol: Rol) => string | undefined;
}

const MODULES: ModuleAccess[] = [
  { label: 'Dashboard',    color: '#6366f1', roles: ['ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES','RECURSOS_HUMANOS'] },
  { label: 'Reportes',     color: '#0891b2', roles: ['ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES'],
    note: (r) => r === 'ADMISIONES' ? 'solo mes actual' : undefined },
  { label: 'Honorarios',   color: '#0369a1', roles: ['ADMIN','GERENCIA','DIRECCION','FACTURACION','RECURSOS_HUMANOS'] },
  { label: 'Capacidad',    color: '#065f46', roles: ['ADMIN','GERENCIA','DIRECCION','FACTURACION'] },
  { label: 'Auditoría',    color: '#7c3aed', roles: ['ADMIN','FACTURACION'] },
  { label: 'Admin',        color: '#9f1239', roles: ['ADMIN'] },
];

function AccessChips({ rol }: { rol: Rol }): React.ReactElement {
  const chips = MODULES.filter((m) => m.roles.includes(rol));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {chips.map((m) => {
        const note = m.note?.(rol);
        return (
          <span
            key={m.label}
            title={note ? `${m.label} — ${note}` : m.label}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 7px',
              borderRadius: 999,
              fontSize: '0.68rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              background: m.color + '14',
              color: m.color,
              border: `1px solid ${m.color}28`,
              whiteSpace: 'nowrap',
            }}
          >
            {m.label}
            {note && <span style={{ opacity: 0.7, fontWeight: 400 }}>*</span>}
          </span>
        );
      })}
    </div>
  );
}

// ─── Module helpers ───────────────────────────────────────────────────────────

const ALL_MODULOS: Modulo[] = ['dashboard', 'reportes', 'honorarios', 'capacidad', 'auditoria', 'configuracion', 'aprobar'];

const MODULO_COLORS: Record<Modulo, string> = {
  dashboard:    '#6366f1',
  reportes:     '#0891b2',
  honorarios:   '#0369a1',
  capacidad:    '#065f46',
  auditoria:    '#7c3aed',
  configuracion:'#9f1239',
  aprobar:      '#b45309',
};

function deriveRolFromModulos(mods: Modulo[]): Rol {
  const has = (m: Modulo) => mods.includes(m);
  if (has('configuracion')) return 'ADMIN';
  if (has('aprobar')) return 'GERENCIA';
  if (has('honorarios') && has('reportes')) return 'FACTURACION';
  if (has('honorarios')) return 'RECURSOS_HUMANOS';
  if (has('reportes') || has('capacidad') || has('auditoria')) return 'COORDINADORA';
  return 'ADMISIONES';
}

function ModulosChips({ modulos }: { modulos: string[] }): React.ReactElement {
  const visible = modulos.filter((m) => m !== 'dashboard') as Modulo[];
  if (visible.length === 0) return <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Solo dashboard</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {visible.map((m) => {
        const color = MODULO_COLORS[m] ?? '#64748b';
        return (
          <span key={m} style={{
            display: 'inline-block',
            padding: '2px 7px',
            borderRadius: 999,
            fontSize: '0.68rem',
            fontWeight: 600,
            background: color + '14',
            color,
            border: `1px solid ${color}28`,
            whiteSpace: 'nowrap',
          }}>
            {MODULO_LABELS[m] ?? m}
          </span>
        );
      })}
    </div>
  );
}

// ─── Modules selector (used in create/edit forms) ─────────────────────────────

function ModulosSelector({
  value,
  onChange,
  disabled,
}: {
  value: Modulo[];
  onChange: (mods: Modulo[]) => void;
  disabled?: boolean;
}): React.ReactElement {
  const toggle = (m: Modulo) => {
    if (m === 'dashboard') return; // always on
    const next = value.includes(m) ? value.filter((x) => x !== m) : [...value, m];
    if (!next.includes('dashboard')) next.unshift('dashboard');
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {ALL_MODULOS.map((m) => {
        const checked = value.includes(m);
        const isAlways = m === 'dashboard';
        const color = MODULO_COLORS[m];
        return (
          <label key={m} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 10px',
            borderRadius: '6px',
            background: checked ? color + '0e' : 'transparent',
            border: `1px solid ${checked ? color + '30' : '#e2e8f0'}`,
            cursor: (disabled || isAlways) ? 'default' : 'pointer',
            opacity: (disabled && !isAlways) ? 0.5 : 1,
          }}>
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled || isAlways}
              onChange={() => toggle(m)}
              style={{ accentColor: color }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: checked ? color : '#374151' }}>
                {MODULO_LABELS[m]}
              </div>
              {m === 'aprobar' && (
                <div style={{ fontSize: '0.72rem', color: '#92400e' }}>
                  Puede aprobar y pagar liquidaciones de honorarios
                </div>
              )}
              {m === 'configuracion' && (
                <div style={{ fontSize: '0.72rem', color: '#9f1239' }}>
                  Acceso completo — gestión de usuarios, reglas y fuentes de datos
                </div>
              )}
            </div>
            {isAlways && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>siempre</span>}
          </label>
        );
      })}
    </div>
  );
}



// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateModalProps { onClose: () => void }

function CreateModal({ onClose }: CreateModalProps): React.ReactElement {
  const [modulos, setModulos] = useState<Modulo[]>(['dashboard']);
  const [form, setForm] = useState({ nombre: '', email: '', password: '' });
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const mutation = useCreateUsuario();

  const derivedRol = deriveRolFromModulos(modulos);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (form.password !== confirmPwd) { setError('Las contraseñas no coinciden'); return; }
    try {
      await mutation.mutateAsync({ ...form, rol: derivedRol, modulos });
      onClose();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al crear el usuario'
      );
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Nuevo usuario</div>
            <div className="modal-subtitle">El usuario podrá iniciar sesión inmediatamente</div>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input className="form-input" required value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-input" type="email" required value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Acceso a módulos</label>
                <ModulosSelector value={modulos} onChange={setModulos} />
                <span className="form-hint" style={{ marginTop: 6, display: 'block' }}>
                  Rol asignado automáticamente: <strong>{ROL_LABELS[derivedRol]}</strong>
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña inicial</label>
                <div className="form-input-wrapper">
                  <input className="form-input form-input--with-icon" type={showPwd ? 'text' : 'password'}
                    required minLength={8} value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password" />
                  <button type="button" className="form-input-icon-btn" tabIndex={-1}
                    onClick={() => setShowPwd((v) => !v)}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="form-hint">Mínimo 8 caracteres</span>
              </div>
              <div className="form-group">
                <label className="form-label">Confirmar contraseña</label>
                <input className={`form-input${confirmPwd && confirmPwd !== form.password ? ' form-input--error' : ''}`}
                  type="password" required value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)} autoComplete="new-password" />
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
              {mutation.isPending ? <><Loader2 size={14} className="spin" /> Creando…</> : <><UserPlus size={14} /> Crear usuario</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps { usuario: UsuarioRow; selfId: string; onClose: () => void }

function EditModal({ usuario, selfId, onClose }: EditModalProps): React.ReactElement {
  const initialModulos: Modulo[] = (usuario.modulos && usuario.modulos.length > 0)
    ? usuario.modulos as Modulo[]
    : ['dashboard'];
  const [modulos, setModulos] = useState<Modulo[]>(initialModulos);
  const [nombre, setNombre] = useState(usuario.nombre);
  const [email, setEmail] = useState(usuario.email);
  const [activo, setActivo] = useState(usuario.activo);
  const [error, setError] = useState('');
  const mutation = useUpdateUsuario();

  const isSelf = usuario.id === selfId;
  const derivedRol = deriveRolFromModulos(modulos);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    try {
      await mutation.mutateAsync({
        id: usuario.id,
        payload: { nombre, email, activo, modulos, rol: derivedRol },
      });
      onClose();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al actualizar el usuario'
      );
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Editar usuario</div>
            <div className="modal-subtitle">{usuario.email}</div>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-stack">
              <div className="form-group">
                <label className="form-label">Nombre completo</label>
                <input className="form-input" required value={nombre}
                  onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Correo electrónico</label>
                <input className="form-input" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Acceso a módulos</label>
                <ModulosSelector value={modulos} onChange={setModulos} disabled={isSelf} />
                <span className="form-hint" style={{ marginTop: 6, display: 'block' }}>
                  Rol asignado: <strong>{ROL_LABELS[derivedRol]}</strong>
                  {isSelf && ' — No puedes editar tus propios módulos'}
                </span>
              </div>
              <div className="form-group">
                <label className="form-label">Estado</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: isSelf ? 'not-allowed' : 'pointer' }}>
                  <input type="checkbox" checked={activo} disabled={isSelf}
                    onChange={(e) => setActivo(e.target.checked)} />
                  <span style={{ fontSize: '0.85rem' }}>Usuario activo</span>
                </label>
                {isSelf && <span className="form-hint">No puedes desactivar tu propia cuenta</span>}
              </div>
              {error && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
              {mutation.isPending ? <><Loader2 size={14} className="spin" /> Guardando…</> : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Reset Password Modal ─────────────────────────────────────────────────────

interface ResetPasswordModalProps { usuario: UsuarioRow; onClose: () => void }

function ResetPasswordModal({ usuario, onClose }: ResetPasswordModalProps): React.ReactElement {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const mutation = useResetPassword();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Mínimo 8 caracteres'); return; }
    if (newPassword !== confirm) { setError('Las contraseñas no coinciden'); return; }
    try {
      await mutation.mutateAsync({ id: usuario.id, newPassword });
      setDone(true);
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al restablecer la contraseña'
      );
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">Restablecer contraseña</div>
            <div className="modal-subtitle">{usuario.nombre}</div>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose}><X size={18} /></button>
        </div>
        {done ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
            <CheckCircle size={36} color="#22c55e" style={{ margin: '0 auto 0.75rem' }} />
            <div style={{ fontWeight: 600 }}>Contraseña restablecida</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
              La sesión del usuario fue cerrada
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-stack">
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.8rem', color: '#92400e' }}>
                  La sesión activa del usuario será cerrada automáticamente.
                </div>
                <div className="form-group">
                  <label className="form-label">Nueva contraseña</label>
                  <div className="form-input-wrapper">
                    <input className="form-input form-input--with-icon" type={showPwd ? 'text' : 'password'}
                      required minLength={8} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                    <button type="button" className="form-input-icon-btn" tabIndex={-1}
                      onClick={() => setShowPwd((v) => !v)}>
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Confirmar contraseña</label>
                  <input className={`form-input${confirm && confirm !== newPassword ? ' form-input--error' : ''}`}
                    type="password" required value={confirm}
                    onChange={(e) => setConfirm(e.target.value)} />
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>{error}</div>}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
                {mutation.isPending ? <><Loader2 size={14} className="spin" /> Guardando…</> : <><KeyRound size={14} /> Restablecer</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps { usuario: UsuarioRow; onClose: () => void }

function DeleteConfirm({ usuario, onClose }: DeleteConfirmProps): React.ReactElement {
  const [error, setError] = useState('');
  const mutation = useDeleteUsuario();

  async function handleConfirm(): Promise<void> {
    setError('');
    try {
      await mutation.mutateAsync(usuario.id);
      onClose();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al eliminar el usuario'
      );
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm">
        <div className="modal-header">
          <div className="modal-title">Eliminar usuario</div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>
            ¿Estás seguro de que deseas eliminar a <strong>{usuario.nombre}</strong>?
          </p>
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            El usuario no podrá iniciar sesión. Esta acción puede revertirse editando el usuario.
          </p>
          {error && (
            <div style={{ marginTop: '0.75rem', color: '#ef4444', fontSize: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn--danger" disabled={mutation.isPending} onClick={handleConfirm}>
            {mutation.isPending ? <><Loader2 size={14} className="spin" /> Eliminando…</> : <><Trash2 size={14} /> Eliminar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Modal =
  | { type: 'create' }
  | { type: 'edit'; usuario: UsuarioRow }
  | { type: 'reset'; usuario: UsuarioRow }
  | { type: 'delete'; usuario: UsuarioRow };

export default function Usuarios(): React.ReactElement {
  const { user: self } = useAuth();
  const { data: usuarios, isLoading, error } = useUsuarios();
  const [modal, setModal] = useState<Modal | null>(null);
  const { sortField, sortDir, onSort } = useSortState<'nombre' | 'rol'>('nombre', 'asc');

  const sortedUsuarios = useMemo(() => {
    if (!usuarios) return [];
    return [...usuarios].sort((a, b) => {
      const cmp = sortField === 'nombre'
        ? a.nombre.localeCompare(b.nombre, 'es')
        : a.rol.localeCompare(b.rol, 'es');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [usuarios, sortField, sortDir]);

  const closeModal = (): void => setModal(null);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <ShieldCheck size={22} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: '#6366f1' }} />
            Gestión de Usuarios
          </h1>
          <p className="page-subtitle">Administra accesos y roles del sistema</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setModal({ type: 'create' })}
        >
          <UserPlus size={16} /> Nuevo usuario
        </button>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', padding: '2rem' }}>
          <Loader2 size={18} className="spin" /> Cargando usuarios…
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#ef4444', padding: '1rem', background: '#fef2f2', borderRadius: 8 }}>
          <AlertCircle size={16} /> Error al cargar los usuarios
        </div>
      )}

      {usuarios && (
        <div className="chart-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th className="sort-th" onClick={() => onSort('nombre')}>
                  Usuario<span className={`liq-sort-icon${sortField === 'nombre' ? ' liq-sort-icon--active' : ''}`}>{sortField === 'nombre' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th className="sort-th" onClick={() => onSort('rol')}>
                  Rol<span className={`liq-sort-icon${sortField === 'rol' ? ' liq-sort-icon--active' : ''}`}>{sortField === 'rol' ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th>Acceso a módulos</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%',
                        background: '#e0e7ff', color: '#4f46e5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        {initials(u.nombre)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                          {u.nombre}
                          {u.id === self?.id && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: '#6366f1', fontWeight: 500 }}>(tú)</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{rolBadge(u.rol)}</td>
                  <td>
                    {u.modulos && u.modulos.length > 0
                      ? <ModulosChips modulos={u.modulos} />
                      : <AccessChips rol={u.rol} />}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: '0.75rem', fontWeight: 500,
                      color: u.activo ? '#15803d' : '#6b7280',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: u.activo ? '#22c55e' : '#d1d5db',
                        display: 'inline-block',
                      }} />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        title="Editar"
                        onClick={() => setModal({ type: 'edit', usuario: u })}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--icon btn--sm"
                        title="Restablecer contraseña"
                        onClick={() => setModal({ type: 'reset', usuario: u })}
                      >
                        <KeyRound size={14} />
                      </button>
                      {u.id !== self?.id && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--icon btn--sm btn--icon-danger"
                          title="Eliminar"
                          onClick={() => setModal({ type: 'delete', usuario: u })}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tabla de permisos por rol ────────────────────────────────────── */}
      <div style={{ marginTop: '2.5rem' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={16} style={{ color: '#6366f1' }} /> Permisos por rol
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>Función</th>
                {(['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA', 'ADMISIONES'] as Rol[]).map(r => (
                  <th key={r} style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '2px solid #e2e8f0' }}>
                    {rolBadge(r)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Dashboard / KPIs',              perms: ['ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES'] },
                { label: 'Reportes (todos los períodos)',  perms: ['ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA'] },
                { label: 'Reportes (solo mes actual)',     perms: ['ADMISIONES'] },
                { label: 'Honorarios (ver / generar)',     perms: ['ADMIN','GERENCIA','DIRECCION','FACTURACION'] },
                { label: 'Honorarios (aprobar / pagar)',   perms: ['ADMIN','GERENCIA','DIRECCION'] },
                { label: 'Ajustes manuales (crear)',       perms: ['ADMIN','GERENCIA','DIRECCION','FACTURACION'] },
                { label: 'Ajustes manuales (autorizar)',   perms: ['ADMIN','GERENCIA','DIRECCION'] },
                { label: 'Capacidad instalada',            perms: ['ADMIN','GERENCIA','DIRECCION','FACTURACION'] },
                { label: 'Auditoría del sistema',          perms: ['ADMIN','FACTURACION'] },
                { label: 'Gestión de usuarios',            perms: ['ADMIN'] },
                { label: 'Configuración del sistema',      perms: ['ADMIN'] },
                { label: 'Cap. instalada (configurar)',    perms: ['ADMIN'] },
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '7px 12px', color: '#334155', fontWeight: 500 }}>{row.label}</td>
                  {(['ADMIN','GERENCIA','DIRECCION','FACTURACION','COORDINADORA','ADMISIONES'] as Rol[]).map(r => (
                    <td key={r} style={{ textAlign: 'center', padding: '7px 10px' }}>
                      {row.perms.includes(r)
                        ? <span style={{ color: '#16a34a', fontSize: '1rem' }}>✓</span>
                        : <span style={{ color: '#e2e8f0', fontSize: '0.9rem' }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal?.type === 'create' && <CreateModal onClose={closeModal} />}
      {modal?.type === 'edit' && (
        <EditModal usuario={modal.usuario} selfId={self?.id ?? ''} onClose={closeModal} />
      )}
      {modal?.type === 'reset' && <ResetPasswordModal usuario={modal.usuario} onClose={closeModal} />}
      {modal?.type === 'delete' && <DeleteConfirm usuario={modal.usuario} onClose={closeModal} />}
    </div>
  );
}
