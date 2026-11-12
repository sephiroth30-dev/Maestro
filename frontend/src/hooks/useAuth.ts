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
      navigate('/dashboard', { replace: true });
    },
    [storeLogin, navigate]
  );

  const logout = useCallback((): void => {
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
