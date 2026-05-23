import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { apiClient } from './client.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TipoConector = 'GOOGLE_SHEETS' | 'REST_API' | 'POSTGRESQL' | 'CSV';
export type FrecuenciaSync = '30min' | '1h' | '4h' | 'daily' | 'manual';
export type EstadoSync = 'EN_PROCESO' | 'COMPLETADA' | 'FALLIDA' | 'PARCIAL';

export interface Conector {
  id: string;
  nombre: string;
  tipo: TipoConector;
  config: Record<string, unknown>;
  activo: boolean;
  frecuenciaSync: FrecuenciaSync;
  ultimaSync: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sincronizacion {
  id: string;
  conectorId: string;
  estado: EstadoSync;
  filasLeidas: number;
  filasNuevas: number;
  errores: Record<string, unknown> | null;
  iniciadaAt: string;
  finalizadaAt: string | null;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface SyncResult {
  conectorId: string;
  success: boolean;
  rowsRead: number;
  rowsNew: number;
  durationMs: number;
  error?: string;
}

// Async sync: the endpoint returns 202 immediately while sync runs in background
export interface SyncStartedResult {
  conectorId: string;
  status: 'EN_PROCESO';
}

export interface CreateConnectorInput {
  nombre: string;
  tipo: TipoConector;
  config: Record<string, unknown>;
  frecuenciaSync?: FrecuenciaSync;
}

export interface UpdateConnectorInput {
  nombre?: string;
  config?: Record<string, unknown>;
  activo?: boolean;
  frecuenciaSync?: FrecuenciaSync;
}

export interface TestConnectorInput {
  nombre: string;
  tipo: TipoConector;
  config: Record<string, unknown>;
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const connectorKeys = {
  all: ['connectors'] as const,
  lists: () => [...connectorKeys.all, 'list'] as const,
  detail: (id: string) => [...connectorKeys.all, 'detail', id] as const,
  sheets: (id: string) => [...connectorKeys.all, 'sheets', id] as const,
  history: (id: string) => [...connectorKeys.all, 'history', id] as const,
};

// ─── API calls ────────────────────────────────────────────────────────────────

async function fetchConnectors(): Promise<Conector[]> {
  const res = await apiClient.get<Conector[]>('/connectors');
  return res.data;
}

async function fetchConnector(id: string): Promise<Conector> {
  const res = await apiClient.get<Conector>(`/connectors/${id}`);
  return res.data;
}

async function fetchConnectorSheets(id: string): Promise<string[]> {
  const res = await apiClient.get<{ sheets: string[] }>(
    `/connectors/${id}/sheets`
  );
  return res.data.sheets;
}

async function fetchSyncHistory(id: string): Promise<Sincronizacion[]> {
  const res = await apiClient.get<Sincronizacion[]>(
    `/connectors/${id}/sync/history`
  );
  return res.data;
}

async function createConnector(input: CreateConnectorInput): Promise<Conector> {
  const res = await apiClient.post<Conector>('/connectors', input);
  return res.data;
}

async function updateConnector(
  id: string,
  input: UpdateConnectorInput
): Promise<Conector> {
  const res = await apiClient.put<Conector>(`/connectors/${id}`, input);
  return res.data;
}

async function deleteConnector(id: string): Promise<void> {
  await apiClient.delete(`/connectors/${id}`);
}

async function testExistingConnector(id: string): Promise<ConnectionTestResult> {
  const res = await apiClient.post<ConnectionTestResult>(
    `/connectors/${id}/test`
  );
  return res.data;
}

async function testNewConnector(
  input: TestConnectorInput
): Promise<ConnectionTestResult> {
  const res = await apiClient.post<ConnectionTestResult>(
    '/connectors/test',
    input
  );
  return res.data;
}

async function triggerSync(id: string): Promise<SyncStartedResult> {
  const res = await apiClient.post<SyncStartedResult>(`/connectors/${id}/sync`);
  return res.data;
}

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useConnectors(): UseQueryResult<Conector[]> {
  return useQuery({
    queryKey: connectorKeys.lists(),
    queryFn: fetchConnectors,
  });
}

export function useConnector(id: string): UseQueryResult<Conector> {
  return useQuery({
    queryKey: connectorKeys.detail(id),
    queryFn: () => fetchConnector(id),
    enabled: Boolean(id),
  });
}

export function useConnectorSheets(id: string): UseQueryResult<string[]> {
  return useQuery({
    queryKey: connectorKeys.sheets(id),
    queryFn: () => fetchConnectorSheets(id),
    enabled: Boolean(id),
  });
}

export function useSyncHistory(id: string): UseQueryResult<Sincronizacion[]> {
  return useQuery({
    queryKey: connectorKeys.history(id),
    queryFn: () => fetchSyncHistory(id),
    enabled: Boolean(id),
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateConnector(): UseMutationResult<
  Conector,
  Error,
  CreateConnectorInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createConnector,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectorKeys.lists() });
    },
  });
}

export function useUpdateConnector(): UseMutationResult<
  Conector,
  Error,
  { id: string; input: UpdateConnectorInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => updateConnector(id, input),
    onSuccess: (updated) => {
      qc.setQueryData(connectorKeys.detail(updated.id), updated);
      void qc.invalidateQueries({ queryKey: connectorKeys.lists() });
    },
  });
}

export function useDeleteConnector(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteConnector,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectorKeys.lists() });
    },
  });
}

export function useTestConnector(): UseMutationResult<
  ConnectionTestResult,
  Error,
  string
> {
  return useMutation({
    mutationFn: testExistingConnector,
  });
}

export function useTestNewConnector(): UseMutationResult<
  ConnectionTestResult,
  Error,
  TestConnectorInput
> {
  return useMutation({
    mutationFn: testNewConnector,
  });
}

export function useTriggerSync(): UseMutationResult<SyncStartedResult, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: (_data, id) => {
      // Invalidate history so the card can poll it for completion
      void qc.invalidateQueries({ queryKey: connectorKeys.history(id) });
      void qc.invalidateQueries({ queryKey: connectorKeys.lists() });
    },
  });
}

export function useDeleteConnectorData(): UseMutationResult<
  { conectorId: string; deleted: number },
  Error,
  string
> {
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<{ conectorId: string; deleted: number }>(
        `/connectors/${id}/data`
      );
      return res.data;
    },
  });
}
