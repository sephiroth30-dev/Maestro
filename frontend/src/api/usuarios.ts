import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client.js';
import type { Rol } from '../types/index.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  modulos: string[];
  activo: boolean;
  createdAt: string;
}

export interface CreateUsuarioPayload {
  nombre: string;
  email: string;
  rol: Rol;
  password: string;
  modulos?: string[];
}

export interface UpdateUsuarioPayload {
  nombre?: string;
  email?: string;
  rol?: Rol;
  modulos?: string[];
  activo?: boolean;
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function fetchUsuarios(): Promise<UsuarioRow[]> {
  const { data } = await apiClient.get<UsuarioRow[]>('/usuarios');
  return data;
}

async function createUsuario(payload: CreateUsuarioPayload): Promise<UsuarioRow> {
  const { data } = await apiClient.post<UsuarioRow>('/usuarios', payload);
  return data;
}

async function updateUsuario(id: string, payload: UpdateUsuarioPayload): Promise<void> {
  await apiClient.patch(`/usuarios/${id}`, payload);
}

async function deleteUsuario(id: string): Promise<void> {
  await apiClient.delete(`/usuarios/${id}`);
}

async function resetPassword(id: string, newPassword: string): Promise<void> {
  await apiClient.post(`/usuarios/${id}/reset-password`, { newPassword });
}

async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: fetchUsuarios,
    staleTime: 30_000,
  });
}

export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUsuario,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useUpdateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUsuarioPayload }) =>
      updateUsuario(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useDeleteUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteUsuario,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      resetPassword(id, newPassword),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
  });
}
