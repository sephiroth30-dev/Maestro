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

  login: (email: string, password: string, recordar?: boolean) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

/**
 * Dónde vive la sesión. Por omisión en `sessionStorage` (se pierde al cerrar la
 * pestaña). Con «Mantener sesión en este equipo» pasa a `localStorage`, para que un
 * PC que se reinicia (p. ej. el de la pantalla de la oficina) vuelva a entrar solo.
 * La marca de la elección vive en `localStorage`; el access token NUNCA se guarda.
 */
const CLAVE_RECORDAR = 'neurofic-keep';

function recordarSesion(): boolean {
  try { return localStorage.getItem(CLAVE_RECORDAR) === '1'; } catch { return false; }
}

const almacenSesion = {
  getItem: (name: string): string | null => {
    try {
      return (recordarSesion() ? localStorage.getItem(name) : null) ?? sessionStorage.getItem(name);
    } catch { return null; }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (recordarSesion()) { localStorage.setItem(name, value); sessionStorage.removeItem(name); }
      else { sessionStorage.setItem(name, value); localStorage.removeItem(name); }
    } catch { /* almacenamiento bloqueado: la sesión vive solo en memoria */ }
  },
  removeItem: (name: string): void => {
    try { localStorage.removeItem(name); sessionStorage.removeItem(name); } catch { /* nada que borrar */ }
  },
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      _refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string, recordar = false): Promise<void> => {
        set({ isLoading: true, error: null });
        try {
          const data = await rawLogin(email, password);
          // Antes de guardar el estado: `persist` escribe en el almacén que diga la marca.
          try { if (recordar) localStorage.setItem(CLAVE_RECORDAR, '1'); else localStorage.removeItem(CLAVE_RECORDAR); } catch { /* sin localStorage */ }
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
        try { localStorage.removeItem(CLAVE_RECORDAR); } catch { /* sin localStorage */ }
        almacenSesion.removeItem('neurofic-auth');
      },

      refreshToken: async (): Promise<void> => {
        const { _refreshToken } = get();

        if (!_refreshToken) {
          throw new Error('No refresh token available');
        }

        const data = await rawRefresh(_refreshToken);
        // Si mientras tanto se cerró la sesión (inactividad, otra pestaña) NO se resucita:
        // escribir aquí dejaría un refresh token vivo, sin revocar, tras cerrar sesión.
        if (get()._refreshToken !== _refreshToken || !get().isAuthenticated) return;
        // El servidor rota el refresh token: si no se guarda el nuevo, la segunda
        // renovación usa uno ya revocado y el servidor cierra TODAS las sesiones.
        set({ accessToken: data.accessToken, ...(data.refreshToken ? { _refreshToken: data.refreshToken } : {}) });
      },

      clearError: (): void => {
        set({ error: null });
      },
    }),
    {
      name: 'neurofic-auth',
      storage: createJSONStorage(() => almacenSesion),
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

// Con «Mantener sesión» el refresh token vive en `localStorage`, compartido entre
// pestañas: si otra pestaña renueva (y por tanto rota el token), esta debe enterarse o
// usaría un token ya revocado y el servidor lo tomaría por robo. `persist` no escucha el
// evento `storage` por sí solo.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'neurofic-auth' && recordarSesion()) void useAuthStore.persist.rehydrate();
  });
}
