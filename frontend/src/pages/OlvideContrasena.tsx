import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import { forgotPassword } from '../api/auth.js';
import NeuroficLogo from '../assets/NeuroficLogo.js';

/** Segundos que se bloquea el botón tras enviar, para no encadenar solicitudes. */
const ESPERA_REENVIO_S = 60;

export default function OlvideContrasena(): React.ReactElement {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [espera, setEspera] = useState(0);
  const emailRef = useRef<HTMLInputElement>(null);

  // Foco inicial en el campo de correo
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Cuenta regresiva del reenvío
  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!email.trim() || enviando || espera > 0) return;

    setError('');
    setEnviando(true);
    try {
      await forgotPassword(email.trim());
      // Confirmación genérica: no revela si el correo existe
      setEnviado(true);
      setEspera(ESPERA_REENVIO_S);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 429) {
        setError('Demasiados intentos. Espera unos minutos.');
      } else {
        setError('No pudimos procesar la solicitud. Revisa tu conexión e intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const bloqueado = enviando || espera > 0;

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <NeuroficLogo size={72} />
          </div>
          <h1 className="login-title">Recuperar contraseña</h1>
          <p className="login-subtitle">
            Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
          </p>
        </div>

        {error && (
          <div className="login-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {enviado && (
          <div className="login-success" role="status">
            <Mail size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p>
                Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.
                Revisa también la carpeta de spam.
              </p>
              <p>El enlace caduca en 30 minutos. Si no llega en unos minutos, contacta al administrador.</p>
            </div>
          </div>
        )}

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
              ref={emailRef}
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError('');
              }}
              className={`form-input ${error ? 'form-input--error' : ''}`}
              placeholder="usuario@neurofic.com"
              aria-invalid={error ? true : undefined}
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={bloqueado || !email.trim()}
          >
            {enviando ? (
              <>
                <span className="login-btn-spinner" aria-hidden="true" />
                Enviando…
              </>
            ) : espera > 0 ? (
              `Reenviar en ${espera} s`
            ) : enviado ? (
              'Reenviar enlace'
            ) : (
              'Enviar enlace'
            )}
          </button>
        </form>

        <Link to="/login" className="login-reset-link">
          <ArrowLeft size={12} aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
          Volver al inicio de sesión
        </Link>
      </div>
    </div>
  );
}
