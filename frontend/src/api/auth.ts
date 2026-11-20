import { apiClient, rawLogin, rawRefresh, rawLogout, rawGetMe } from './client.js';
import type {
  LoginResponse,
  RefreshResponse,
  User,
} from '../types/index.js';

/**
 * Auth API module.
 * Re-exports raw auth calls with typed signatures.
 * Components should use the authStore (Zustand) rather than calling these
 * functions directly — these are the underlying HTTP primitives.
 */

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  return rawLogin(email, password);
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshResponse> {
  return rawRefresh(refreshToken);
}

export async function logout(refreshToken: string): Promise<void> {
  return rawLogout(refreshToken);
}

export async function getMe(): Promise<User> {
  return rawGetMe();
}

// ─── Recuperación de contraseña (rutas públicas, sin token de sesión) ─────────

/** Pide el enlace de restablecimiento. El servidor responde 200 exista o no el correo. */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  return response.data;
}

/** Fija la nueva contraseña con el token recibido por correo. 400 si es inválido o caducó. */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/auth/reset-password', {
    token,
    newPassword,
  });
  return response.data;
}
