import React, { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle, KeyRound, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import NeuroficLogo from '../assets/NeuroficLogo.js';

export default function Login(): React.ReactElement {
  const { isAuthenticated, isLoading, error, login, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetInfo, setShowResetInfo] = useState(false);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearError();

    if (!email.trim() || !password.trim()) return;

    try {
      await login(email.trim(), password);
    } catch {
      // Error is already stored in the auth store — no local state needed
    }
  };

  const getErrorMessage = (): string => {
    if (!error) return '';
    if (error.toLowerCase().includes('invalid credentials') || error.toLowerCase().includes('401')) {
      return 'Correo electrónico o contraseña incorrectos.';
    }
    if (error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('429')) {
      return 'Demasiados intentos. Por favor espera un minuto antes de intentarlo de nuevo.';
    }
    return 'Ocurrió un error. Por favor intenta de nuevo.';
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Logo / Brand */}
        <div className="login-header">
          <div className="login-logo">
            <NeuroficLogo size={72} />
          </div>
          <h1 className="login-title">Neurofic Admin</h1>
          <p className="login-subtitle">Panel de administración clínica</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="login-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{getErrorMessage()}</span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="login-form"
          noValidate
        >
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) clearError();
              }}
              className={`form-input ${error ? 'form-input--error' : ''}`}
              placeholder="usuario@neurofic.com"
              disabled={isLoading}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Contraseña
            </label>
            <div className="form-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
                className={`form-input form-input--with-icon ${error ? 'form-input--error' : ''}`}
                placeholder="••••••••"
                disabled={isLoading}
              />
              <button
                type="button"
                className="form-input-icon-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isLoading || !email.trim() || !password.trim()}
          >
            {isLoading ? (
              <>
                <span className="login-btn-spinner" aria-hidden="true" />
                Iniciando sesión…
              </>
            ) : (
              <>
                <LogIn size={18} aria-hidden="true" />
                Iniciar sesión
              </>
            )}
          </button>
        </form>

        {/* Reset password info */}
        {showResetInfo ? (
          <div className="login-reset-info" role="status">
            <button
              type="button"
              className="login-reset-close"
              onClick={() => setShowResetInfo(false)}
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
            <KeyRound size={16} style={{ flexShrink: 0, color: '#3b82f6' }} />
            <span>
              Contacta al <strong>administrador del sistema</strong> para restablecer tu contraseña.
              El administrador puede hacerlo desde el panel de Usuarios.
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="login-reset-link"
            onClick={() => setShowResetInfo(true)}
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}

        <p className="login-footer">
          Acceso restringido al personal autorizado de Neurofic.
          <br />
          <span style={{ fontSize: '0.7rem', color: '#cbd5e1', letterSpacing: '0.04em' }}>v{__APP_VERSION__}</span>
        </p>
      </div>
    </div>
  );
}
