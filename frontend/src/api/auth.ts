import { rawLogin, rawRefresh, rawLogout, rawGetMe } from './client.js';
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
