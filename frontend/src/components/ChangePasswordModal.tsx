import React, { useState } from 'react';
import { X, Eye, EyeOff, KeyRound, Loader2, CheckCircle } from 'lucide-react';
import { useChangePassword } from '../api/usuarios.js';

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props): React.ReactElement {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [clientError, setClientError] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useChangePassword();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setClientError('');

    if (newPassword.length < 8) {
      setClientError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setClientError('Las contraseñas no coinciden');
      return;
    }

    try {
      await mutation.mutateAsync({ currentPassword, newPassword });
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al cambiar la contraseña';
      setClientError(msg);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal--sm">
        <div className="modal-header">
          <div>
            <div className="modal-title">Cambiar contraseña</div>
            <div className="modal-subtitle">Solo tú puedes cambiar tu propia contraseña</div>
          </div>
          <button type="button" className="btn btn--ghost btn--icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {success ? (
          <div className="modal-body" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <CheckCircle size={40} color="#22c55e" style={{ margin: '0 auto 1rem' }} />
            <div style={{ fontWeight: 600, color: '#0f172a' }}>¡Contraseña actualizada!</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="form-stack">
                <div className="form-group">
                  <label className="form-label">Contraseña actual</label>
                  <div className="form-input-wrapper">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      className="form-input form-input--with-icon"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="form-input-icon-btn"
                      onClick={() => setShowCurrent((v) => !v)}
                      tabIndex={-1}
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nueva contraseña</label>
                  <div className="form-input-wrapper">
                    <input
                      type={showNew ? 'text' : 'password'}
                      className="form-input form-input--with-icon"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="form-input-icon-btn"
                      onClick={() => setShowNew((v) => !v)}
                      tabIndex={-1}
                    >
                      {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <span className="form-hint">Mínimo 8 caracteres</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirmar nueva contraseña</label>
                  <input
                    type="password"
                    className={`form-input${confirmPassword && confirmPassword !== newPassword ? ' form-input--error' : ''}`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                {clientError && (
                  <div className="form-hint" style={{ color: '#ef4444' }}>
                    {clientError}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <><Loader2 size={15} className="spin" /> Guardando…</>
                ) : (
                  <><KeyRound size={15} /> Cambiar contraseña</>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
