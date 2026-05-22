import React, { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';

export default function Login(): React.ReactElement {
  const { isAuthenticated, isLoading, error, login, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
            <span className="login-logo-text">N</span>
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

        <p className="login-footer">
          Acceso restringido al personal autorizado de Neurofic.
        </p>
      </div>
    </div>
  );
}
