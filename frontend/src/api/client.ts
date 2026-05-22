import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';
import type { RefreshResponse } from '../types/index.js';

// We use a lazy import to avoid circular dependency (client → authStore → client)
type AuthStoreSnapshot = {
  accessToken: string | null;
  refreshToken: () => Promise<void>;
  logout: () => void;
};

let _authStore: AuthStoreSnapshot | null = null;

/**
 * Called once from the auth store to wire up the interceptor.
 * This breaks the circular dependency at module load time.
 */
export function setAuthStore(store: AuthStoreSnapshot): void {
  _authStore = store;
}

const BASE_URL = import.meta.env['VITE_API_BASE_URL'] as string | undefined ?? '';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// ─── Request interceptor: inject Authorization header ─────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = _authStore?.accessToken;
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

// ─── Track whether a refresh is already in progress ──────────────────────────
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void): void {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(newToken: string): void {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function onRefreshFailed(): void {
  refreshSubscribers = [];
}

// ─── Response interceptor: handle 401 with automatic token refresh ────────────
apiClient.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => response,
  async (error: AxiosError): Promise<AxiosResponse> => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      _authStore
    ) {
      if (isRefreshing) {
        // Queue request until the ongoing refresh resolves
        return new Promise<AxiosResponse>((resolve, reject) => {
          subscribeTokenRefresh((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            }
            resolve(apiClient(originalRequest));
          });
          // If refresh fails, reject this queued request too
          void (async () => {
            await new Promise((r) => setTimeout(r, 10_000));
            reject(new Error('Token refresh timed out'));
          })();
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await _authStore.refreshToken();

        const newToken = _authStore.accessToken;
        if (!newToken) throw new Error('No token after refresh');

        onTokenRefreshed(newToken);

        if (originalRequest.headers) {
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        }

        return apiClient(originalRequest);
      } catch {
        onRefreshFailed();
        _authStore.logout();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── Raw auth calls that bypass the interceptor (no circular dep) ─────────────

export async function rawLogin(
  email: string,
  password: string
): Promise<import('../types/index.js').LoginResponse> {
  const response = await apiClient.post<import('../types/index.js').LoginResponse>(
    '/api/auth/login',
    { email, password }
  );
  return response.data;
}

export async function rawRefresh(
  refreshToken: string
): Promise<RefreshResponse> {
  const response = await apiClient.post<RefreshResponse>('/api/auth/refresh', {
    refreshToken,
  });
  return response.data;
}

export async function rawLogout(refreshToken: string): Promise<void> {
  await apiClient.post('/api/auth/logout', { refreshToken });
}

export async function rawGetMe(): Promise<import('../types/index.js').User> {
  const response = await apiClient.get<import('../types/index.js').User>('/api/auth/me');
  return response.data;
}
