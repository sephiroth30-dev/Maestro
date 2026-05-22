import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { rawLogin, rawRefresh, rawLogout, setAuthStore } from '../api/client.js';
import type { User } from '../types/index.js';

export interface AuthStore {
  user: User | null;
  accessToken: string | null;
  _refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      _refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string): Promise<void> => {
        set({ isLoading: true, error: null });
        try {
          const data = await rawLogin(email, password);
          set({
            user: data.usuario,
            accessToken: data.accessToken,
            _refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Error al iniciar sesión';
          set({ isLoading: false, error: message, isAuthenticated: false });
          throw err;
        }
      },

      logout: (): void => {
        const { _refreshToken } = get();

        // Fire-and-forget: revoke the refresh token on the server
        if (_refreshToken) {
          void rawLogout(_refreshToken).catch(() => {
            // Ignore errors — we clear state locally regardless
          });
        }

        set({
          user: null,
          accessToken: null,
          _refreshToken: null,
          isAuthenticated: false,
          error: null,
        });
      },

      refreshToken: async (): Promise<void> => {
        const { _refreshToken } = get();

        if (!_refreshToken) {
          throw new Error('No refresh token available');
        }

        const data = await rawRefresh(_refreshToken);
        set({ accessToken: data.accessToken });
      },

      clearError: (): void => {
        set({ error: null });
      },
    }),
    {
      name: 'neurofic-auth',
      storage: createJSONStorage(() => sessionStorage),
      // Only persist safe fields — never the access token in localStorage
      partialize: (state) => ({
        user: state.user,
        _refreshToken: state._refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Wire up the axios interceptor once the store is created
setAuthStore({
  get accessToken() {
    return useAuthStore.getState().accessToken;
  },
  refreshToken: () => useAuthStore.getState().refreshToken(),
  logout: () => useAuthStore.getState().logout(),
});
