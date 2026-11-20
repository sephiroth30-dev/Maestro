import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';
import { resetPassword } from '../api/auth.js';
import NeuroficLogo from '../assets/NeuroficLogo.js';

const MIN_PASSWORD = 8;
const MSG_ENLACE_INVALIDO = 'El enlace no es válido o ya caducó. Solicita uno nuevo.';

// Token capturado de la URL. Vive en memoria solo mientras la página está montada: en
// desarrollo (React.StrictMode) el componente se renderiza dos veces en el montaje y la
// segunda ya no vería el token, porque la URL quedó limpia en la primera.
let tokenCapturado = '';

/**
 * Lee el token de `?token=…` y lo quita de la barra de direcciones, para que no quede en
 * el historial ni viaje en el Referer. Solo se guarda en memoria: nunca en storage ni en
 * pantalla.
 */
function extraerTokenYLimpiarUrl(): string {
  const token = new URLSearchParams(window.location.search).get('token');
  if (token) tokenCapturado = token;
  if (window.location.search) {
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  return tokenCapturado;
}

export default function RestablecerContrasena(): React.ReactElement {
  const navigate = useNavigate();

  const [token] = useState(extraerTokenYLimpiarUrl);
  const hayToken = token !== '';

  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [enlaceInvalido, setEnlaceInvalido] = useState(false);
  const [listo, setListo] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // No enviar Referer desde esta página mientras esté montada
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  // Al desmontar, olvidar el token capturado
  useEffect(() => () => { tokenCapturado = ''; }, []);

  // Foco inicial en la nueva contraseña
  useEffect(() => {
    if (hayToken) passwordRef.current?.focus();
  }, [hayToken]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (enviando) return;

    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
      return;
    }
    if (password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setError('');
    setEnviando(true);
    try {
      await resetPassword(token, password);
      setPassword('');
      setConfirmacion('');
      setListo(true);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 400) {
        const data = err.response.data as { error?: string } | undefined;
        setError(data?.error ?? MSG_ENLACE_INVALIDO);
        setEnlaceInvalido(true);
      } else if (isAxiosError(err) && err.response?.status === 429) {
        setError('Demasiados intentos. Espera unos minutos.');
      } else {
        setError('No pudimos procesar la solicitud. Revisa tu conexión e intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const cabecera = (titulo: string, subtitulo: string): React.ReactElement => (
    <div className="login-header">
      <div className="login-logo">
        <NeuroficLogo size={72} />
      </div>
      <h1 className="login-title">{titulo}</h1>
      <p className="login-subtitle">{subtitulo}</p>
    </div>
  );

  // Sin token en la URL: enlace inválido
  if (!hayToken && !listo) {
    return (
      <div className="login-page">
        <div className="login-container">
          {cabecera('Enlace no válido', 'No pudimos validar tu solicitud')}
          <div className="login-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{MSG_ENLACE_INVALIDO}</span>
          </div>
          <button
            type="button"
            className="login-btn"
            onClick={() => navigate('/olvide-contrasena')}
          >
            Solicitar un enlace nuevo
          </button>
        </div>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="login-page">
        <div className="login-container">
          {cabecera('Contraseña actualizada', 'Ya puedes ingresar con tu nueva contraseña')}
          <div className="login-success" role="status">
            <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Tu contraseña se actualizó correctamente.</span>
          </div>
          <button
            type="button"
            className="login-btn"
            onClick={() => navigate('/login')}
            autoFocus
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        {cabecera('Nueva contraseña', `Elige una contraseña de al menos ${MIN_PASSWORD} caracteres`)}

        {error && (
          <div className="login-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          className="login-form"
          noValidate
        >
          <div className="form-group">
            <label htmlFor="nueva-password" className="form-label">
              Nueva contraseña
            </label>
            <div className="form-input-wrapper">
              <input
                ref={passwordRef}
                id="nueva-password"
                type={mostrar ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error && !enlaceInvalido) setError('');
                }}
                className={`form-input form-input--with-icon ${error ? 'form-input--error' : ''}`}
                placeholder="Mínimo 8 caracteres"
                disabled={enviando || enlaceInvalido}
              />
              <button
                type="button"
                className="form-input-icon-btn"
                onClick={() => setMostrar((prev) => !prev)}
                aria-label={mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                tabIndex={-1}
              >
                {mostrar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmar-password" className="form-label">
              Confirmar contraseña
            </label>
            <input
              id="confirmar-password"
              type={mostrar ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmacion}
              onChange={(e) => {
                setConfirmacion(e.target.value);
                if (error && !enlaceInvalido) setError('');
              }}
              className={`form-input ${error ? 'form-input--error' : ''}`}
              placeholder="Repite la contraseña"
              disabled={enviando || enlaceInvalido}
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={enviando || enlaceInvalido || !password || !confirmacion}
          >
            {enviando ? (
              <>
                <span className="login-btn-spinner" aria-hidden="true" />
                Guardando…
              </>
            ) : (
              'Guardar contraseña'
            )}
          </button>
        </form>

        {enlaceInvalido ? (
          <Link to="/olvide-contrasena" className="login-reset-link">
            Solicitar un enlace nuevo
          </Link>
        ) : (
          <Link to="/login" className="login-reset-link">
            Volver al inicio de sesión
          </Link>
        )}
      </div>
    </div>
  );
}
