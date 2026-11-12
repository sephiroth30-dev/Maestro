import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.js';
import type { AuthStore } from '../stores/authStore.js';

export interface UseAuthReturn {
  user: AuthStore['user'];
  accessToken: AuthStore['accessToken'];
  isAuthenticated: AuthStore['isAuthenticated'];
  isLoading: AuthStore['isLoading'];
  error: AuthStore['error'];
  login: (email: string, password: string, recordar?: boolean) => Promise<void>;
  logout: () => void;
  clearError: AuthStore['clearError'];
}

export function useAuth(): UseAuthReturn {
  const navigate = useNavigate();

  const {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    logout: storeLogout,
    clearError,
  } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string, recordar = false): Promise<void> => {
      await storeLogin(email, password, recordar);
      // Si este equipo es la pantalla de TV (ver `pages/Tv.tsx`), tras iniciar sesión vuelve a ella.
      let esTv = false;
      try { esTv = localStorage.getItem('neurofic-tv') === '1'; } catch { /* sin almacenamiento */ }
      navigate(esTv ? '/tv' : '/dashboard', { replace: true });
    },
    [storeLogin, navigate]
  );

  const logout = useCallback((): void => {
    // Cerrar sesión A PROPÓSITO también deja de tratar este equipo como la pantalla de TV. Un cierre
    // forzado (sesión caducada) NO pasa por aquí: tras volver a entrar, la TV regresa a /tv.
    try { localStorage.removeItem('neurofic-tv'); } catch { /* sin almacenamiento */ }
    storeLogout();
    navigate('/login', { replace: true });
  }, [storeLogout, navigate]);

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };
}
