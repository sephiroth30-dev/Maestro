import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Database,
  Globe,
  Server,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Activity,
  Edit2,
  Trash2,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react';
import {
  connectorKeys,
  useConnectors,
  useCreateConnector,
  useUpdateConnector,
  useDeleteConnector,
  useTestConnector,
  useTestNewConnector,
  useTriggerSync,
  useSyncHistory,
  useDeleteConnectorData,
  useDeleteOrphanData,
  useColumnDiagnostico,
  type Conector,
  type TipoConector,
  type FrecuenciaSync,
  type Sincronizacion,
  type ConnectionTestResult,
  type ColumnDiagnosticoResult,
  type CreateConnectorInput,
  type UpdateConnectorInput,
} from '../../api/connectors.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalize a datetime string that may lack timezone info (MySQL returns naive strings).
// We treat all naive datetimes as UTC to match the server storage convention.
function parseServerDate(dateStr: string): Date {
  // Already has timezone info (Z or +HH:MM or -HH:MM)
  if (/[Z+\-]\d{2}:?\d{2}$/.test(dateStr) || dateStr.endsWith('Z')) {
    return new Date(dateStr);
  }
  // Naive string — normalize space to T and append Z to treat as UTC
  return new Date(dateStr.replace(' ', 'T') + 'Z');
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const serverDate = parseServerDate(dateStr);
  const diff = Date.now() - serverDate.getTime();
  const mins = Math.floor(Math.abs(diff) / 60000);
  if (diff < -30_000) return 'Ahora';
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days > 1 ? 's' : ''}`;
}

function formatAbsoluteTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = parseServerDate(dateStr);
  return d.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  });
}

const FRECUENCIA_LABELS: Record<FrecuenciaSync, string> = {
  '30min': 'Cada 30 min',
  '1h': 'Cada hora',
  '4h': 'Cada 4 horas',
  'daily': 'Diario 8pm',
  'manual': 'Manual',
};

const TIPO_ICONS: Record<TipoConector, React.ReactNode> = {
  GOOGLE_SHEETS: <Database size={22} className="text-emerald-600" />,
  REST_API: <Globe size={22} className="text-blue-600" />,
  POSTGRESQL: <Server size={22} className="text-purple-600" />,
  CSV: <Database size={22} className="text-slate-600" />,
};

const TIPO_BADGE_CLASSES: Record<TipoConector, string> = {
  GOOGLE_SHEETS: 'badge badge--emerald',
  REST_API: 'badge badge--blue',
  POSTGRESQL: 'badge badge--purple',
  CSV: 'badge badge--slate',
};

const TIPO_LABELS: Record<TipoConector, string> = {
  GOOGLE_SHEETS: 'Google Sheets',
  REST_API: 'REST API',
  POSTGRESQL: 'PostgreSQL',
  CSV: 'CSV',
};

const ESTADO_CLASSES: Record<string, string> = {
  COMPLETADA: 'badge badge--emerald',
  EN_PROCESO: 'badge badge--blue',
  FALLIDA: 'badge badge--red',
  PARCIAL: 'badge badge--yellow',
};

const ESTADO_LABELS: Record<string, string> = {
  COMPLETADA: 'Completada',
  EN_PROCESO: 'En proceso',
  FALLIDA: 'Fallida',
  PARCIAL: 'Parcial',
};

// ─── ConnectorCard ────────────────────────────────────────────────────────────

interface ConnectorCardProps {
  conector: Conector;
  onEdit: (c: Conector) => void;
  onDelete: (c: Conector) => void;
  onHistory: (c: Conector) => void;
}

function ConnectorCard({
  conector,
  onEdit,
  onDelete,
  onHistory,
}: ConnectorCardProps): React.ReactElement {
  const qc = useQueryClient();
  const testMutation = useTestConnector();
  const syncMutation = useTriggerSync();
  const wipeMutation = useDeleteConnectorData();
  const colDiagMutation = useColumnDiagnostico();
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [syncPolling, setSyncPolling] = useState(false);
  const [wipeResult, setWipeResult] = useState<string | null>(null);
  const [colDiagResult, setColDiagResult] = useState<ColumnDiagnosticoResult | null>(null);
  const [colDiagError, setColDiagError] = useState<string | null>(null);

  // Only fetch history while polling; invalidate every 3s to detect completion
  const { data: polledHistory } = useSyncHistory(syncPolling ? conector.id : '');

  useEffect(() => {
    if (!syncPolling) return;
    const interval = setInterval(() => {
      void qc.invalidateQueries({ queryKey: connectorKeys.history(conector.id) });
      void qc.invalidateQueries({ queryKey: connectorKeys.lists() });
    }, 3000);
    return () => clearInterval(interval);
  }, [syncPolling, conector.id, qc]);

  // Stop polling when the latest record is in a terminal state
  useEffect(() => {
    if (!syncPolling || !polledHistory?.length) return;
    const latest = polledHistory[0];
    if (latest?.estado !== 'EN_PROCESO') {
      setSyncPolling(false);
    }
  }, [polledHistory, syncPolling]);

  const handleTest = async (): Promise<void> => {
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync(conector.id);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: 'Error al probar conexión' });
    }
  };

  const handleSync = async (): Promise<void> => {
    try {
      await syncMutation.mutateAsync(conector.id);
      setSyncPolling(true);
    } catch {
      // error handled by mutation state
    }
  };

  const handleWipe = async (): Promise<void> => {
    if (!window.confirm(
      `¿Eliminar TODOS los datos de atenciones del conector "${conector.nombre}"?\n\nEsta acción no se puede deshacer. Debes re-sincronizar para recuperar los datos.`
    )) return;
    setWipeResult(null);
    try {
      const result = await wipeMutation.mutateAsync(conector.id);
      setWipeResult(`${result.deleted} registros eliminados. Sincroniza para reimportar.`);
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['entidades'] });
      void qc.invalidateQueries({ queryKey: ['tendencia'] });
    } catch {
      setWipeResult('Error al limpiar los datos.');
    }
  };

  const handleColDiag = async (): Promise<void> => {
    setColDiagResult(null);
    setColDiagError(null);
    try {
      const result = await colDiagMutation.mutateAsync(conector.id);
      setColDiagResult(result);
    } catch (err) {
      setColDiagError(err instanceof Error ? err.message : 'Sin datos en caché. Sincroniza primero.');
    }
  };

  const latestSync = polledHistory?.[0];
  const syncDone = !syncPolling && syncMutation.isSuccess;

  return (
    <div className={`connector-card ${!conector.activo ? 'connector-card--inactive' : ''}`}>
      <div className="connector-card-header">
        <div className="connector-card-icon">{TIPO_ICONS[conector.tipo]}</div>
        <div className="connector-card-meta">
          <h3 className="connector-card-name">{conector.nombre}</h3>
          <div className="connector-card-badges">
            <span className={TIPO_BADGE_CLASSES[conector.tipo]}>
              {TIPO_LABELS[conector.tipo]}
            </span>
            <span className={`badge ${conector.activo ? 'badge--emerald' : 'badge--slate'}`}>
              {conector.activo ? (
                <>
                  <span className="badge-dot badge-dot--green" />
                  Activo
                </>
              ) : (
                <>
                  <span className="badge-dot badge-dot--gray" />
                  Inactivo
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="connector-card-info">
        <div className="connector-info-row" title={`Fecha exacta (COT): ${formatAbsoluteTime(conector.ultimaSync)}`}>
          <Clock size={14} className="connector-info-icon" />
          <span className="connector-info-label">Última sync:</span>
          <span className="connector-info-value" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span>{formatRelativeTime(conector.ultimaSync)}</span>
            {conector.ultimaSync && (
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{formatAbsoluteTime(conector.ultimaSync)}</span>
            )}
          </span>
        </div>
        <div className="connector-info-row">
          <Activity size={14} className="connector-info-icon" />
          <span className="connector-info-label">Frecuencia:</span>
          <span className="connector-info-value">
            {FRECUENCIA_LABELS[conector.frecuenciaSync] ?? conector.frecuenciaSync}
          </span>
        </div>
      </div>

      {/* Test result inline */}
      {testResult && (
        <div
          className={`connector-test-result ${
            testResult.success
              ? 'connector-test-result--success'
              : 'connector-test-result--error'
          }`}
        >
          {testResult.success ? (
            <CheckCircle size={14} />
          ) : (
            <XCircle size={14} />
          )}
          <span>{testResult.message}</span>
          {testResult.latencyMs !== undefined && testResult.success && (
            <span className="connector-test-latency">{testResult.latencyMs}ms</span>
          )}
        </div>
      )}

      {/* Sync status */}
      {syncMutation.isError && (
        <div className="connector-test-result connector-test-result--error">
          <XCircle size={14} />
          <span>Error al iniciar sincronización</span>
        </div>
      )}
      {syncPolling && (
        <div className="connector-test-result connector-test-result--info">
          <Loader2 size={14} className="spin" />
          <span>Sincronizando en segundo plano...</span>
        </div>
      )}
      {syncDone && latestSync && (
        <div
          className={`connector-test-result ${
            latestSync.estado === 'COMPLETADA'
              ? 'connector-test-result--success'
              : latestSync.estado === 'FALLIDA'
              ? 'connector-test-result--error'
              : 'connector-test-result--warning'
          }`}
        >
          {latestSync.estado === 'COMPLETADA' ? (
            <CheckCircle size={14} />
          ) : (
            <XCircle size={14} />
          )}
          <span>
            {latestSync.estado === 'COMPLETADA'
              ? `Sincronizado: ${latestSync.filasNuevas} filas nuevas (${latestSync.filasLeidas} leídas)`
              : latestSync.estado === 'FALLIDA'
              ? 'Error en la sincronización — ver Historial'
              : `Parcial: ${latestSync.filasNuevas} filas nuevas`}
          </span>
        </div>
      )}
      {syncDone && !latestSync && (
        <div className="connector-test-result connector-test-result--info">
          <CheckCircle size={14} />
          <span>Sincronización iniciada — revisa el Historial</span>
        </div>
      )}

      {wipeResult && (
        <div className={`connector-test-result ${wipeMutation.isError ? 'connector-test-result--error' : 'connector-test-result--warning'}`}>
          {wipeMutation.isError ? <XCircle size={14} /> : <CheckCircle size={14} />}
          <span>{wipeResult}</span>
        </div>
      )}

      {colDiagError && (
        <div className="connector-test-result connector-test-result--error">
          <XCircle size={14} />
          <span>{colDiagError}</span>
        </div>
      )}

      {colDiagResult && (
        <div className="col-diag-panel">
          {(() => {
            const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
            const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            return (
              <>
                <div className="col-diag-title">
                  Totales en BD — {colDiagResult.totalAtenciones.toLocaleString('es-CO')} atenciones · {COP.format(colDiagResult.totalValorBruto)}
                </div>
                <div className="col-diag-sums">
                  {colDiagResult.meses.map((m) => (
                    <div key={`${m.anio}-${m.mes}`} className="col-diag-sum-row">
                      <span className="col-diag-sum-name">{MESES[m.mes]} {m.anio}</span>
                      <span className="col-diag-sum-val">{COP.format(m.totalValorBruto)}</span>
                      <span className="col-diag-sum-name" style={{ color: '#94a3b8' }}>{m.atenciones.toLocaleString('es-CO')} atenc.</span>
                      {m.sinValor > 0 && (
                        <span style={{ color: '#ef4444', fontSize: '10px' }}>{m.sinValor} sin valor</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div className="connector-card-actions">
        <button
          type="button"
          className="btn btn--sm btn--primary"
          onClick={() => { void handleSync(); }}
          disabled={syncMutation.isPending || syncPolling || !conector.activo}
          title="Sincronizar ahora"
        >
          {(syncMutation.isPending || syncPolling) ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {syncPolling ? 'Sincronizando...' : 'Sincronizar'}
        </button>

        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => { void handleTest(); }}
          disabled={testMutation.isPending || !conector.activo}
          title="Probar conexión"
        >
          {testMutation.isPending ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <Activity size={13} />
          )}
          Probar
        </button>

        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => onHistory(conector)}
          title="Ver historial"
        >
          <History size={13} />
          Historial
        </button>

        <button
          type="button"
          className="btn btn--sm btn--ghost btn--danger-ghost"
          onClick={() => { void handleWipe(); }}
          disabled={wipeMutation.isPending}
          title="Eliminar todos los datos importados de este conector"
        >
          {wipeMutation.isPending ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <Trash2 size={13} />
          )}
          Limpiar datos
        </button>

        {conector.tipo === 'GOOGLE_SHEETS' && (
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => { void handleColDiag(); }}
            disabled={colDiagMutation.isPending}
            title="Ver qué columnas detecta este conector y las sumas por columna"
          >
            {colDiagMutation.isPending ? <Loader2 size={13} className="spin" /> : <Activity size={13} />}
            Columnas
          </button>
        )}

        <div className="connector-card-actions-right">
          <button
            type="button"
            className="btn btn--sm btn--icon"
            onClick={() => onEdit(conector)}
            title="Editar"
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            className="btn btn--sm btn--icon btn--icon-danger"
            onClick={() => onDelete(conector)}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SyncHistoryDrawer ────────────────────────────────────────────────────────

interface SyncHistoryDrawerProps {
  conector: Conector;
  onClose: () => void;
}

function SyncHistoryDrawer({
  conector,
  onClose,
}: SyncHistoryDrawerProps): React.ReactElement {
  const { data: history, isLoading } = useSyncHistory(conector.id);

  return (
    <div className="drawer-overlay" onClick={onClose} role="presentation">
      <div
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Historial de sincronizaciones"
      >
        <div className="drawer-header">
          <div>
            <h2 className="drawer-title">Historial de sincronizaciones</h2>
            <p className="drawer-subtitle">{conector.nombre}</p>
          </div>
          <button
            type="button"
            className="btn btn--sm btn--icon"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          {isLoading ? (
            <div className="drawer-loading">
              <Loader2 size={24} className="spin text-blue-500" />
              <span>Cargando historial...</span>
            </div>
          ) : !history || history.length === 0 ? (
            <div className="drawer-empty">
              <History size={40} className="text-slate-300" />
              <p>No hay sincronizaciones registradas</p>
            </div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Filas leídas</th>
                  <th>Filas nuevas</th>
                  <th>Duración</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s: Sincronizacion) => {
                  const duration =
                    s.finalizadaAt
                      ? `${Math.round(
                          (new Date(s.finalizadaAt).getTime() -
                            new Date(s.iniciadaAt).getTime()) /
                            1000
                        )}s`
                      : '—';
                  return (
                    <tr key={s.id}>
                      <td>
                        {new Date(s.iniciadaAt).toLocaleString('es-CO', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                          timeZone: 'America/Bogota',
                        })}
                      </td>
                      <td>
                        <span className={ESTADO_CLASSES[s.estado] ?? 'badge badge--slate'}>
                          {ESTADO_LABELS[s.estado] ?? s.estado}
                        </span>
                      </td>
                      <td>{s.filasLeidas}</td>
                      <td>{s.filasNuevas}</td>
                      <td>{duration}</td>
                      <td>
                        {s.errores ? (
                          <span
                            className="history-error"
                            title={JSON.stringify(s.errores)}
                          >
                            <AlertCircle size={14} />
                            {(s.errores as Record<string, string>)['message'] ?? 'Ver detalle'}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ConnectorForm (step-by-step modal) ──────────────────────────────────────

type FormStep = 1 | 2;

interface ConnectorFormState {
  nombre: string;
  tipo: TipoConector | '';
  frecuenciaSync: FrecuenciaSync;
  // Sheets fields
  sheetsMode: 'spreadsheet' | 'folder';
  spreadsheetId: string;
  folderId: string;
  fileNamePattern: string;
  sheetName: string;
  credentialsJson: string;
  // REST fields
  baseUrl: string;
  authType: 'none' | 'bearer' | 'basic';
  authValue: string;
  headers: Array<{ key: string; value: string }>;
}

const DEFAULT_FORM: ConnectorFormState = {
  nombre: '',
  tipo: '',
  frecuenciaSync: 'daily',
  sheetsMode: 'spreadsheet',
  spreadsheetId: '',
  folderId: '',
  fileNamePattern: '',
  sheetName: '',
  credentialsJson: '',
  baseUrl: '',
  authType: 'none',
  authValue: '',
  headers: [],
};

interface ConnectorModalProps {
  editing: Conector | null;
  onClose: () => void;
}

function ConnectorModal({
  editing,
  onClose,
}: ConnectorModalProps): React.ReactElement {
  const createMutation = useCreateConnector();
  const updateMutation = useUpdateConnector();
  const testNewMutation = useTestNewConnector();
  const testExistingMutation = useTestConnector();

  const [step, setStep] = useState<FormStep>(editing ? 2 : 1);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  // Init form from editing conector
  const initFormFromEditing = (): ConnectorFormState => {
    if (!editing) return DEFAULT_FORM;
    const cfg = editing.config as Record<string, unknown>;
    const base: ConnectorFormState = {
      nombre: editing.nombre,
      tipo: editing.tipo,
      frecuenciaSync: editing.frecuenciaSync,
      sheetsMode: 'spreadsheet',
      spreadsheetId: '',
      folderId: '',
      fileNamePattern: '',
      sheetName: '',
      credentialsJson: '',
      baseUrl: '',
      authType: 'none',
      authValue: '',
      headers: [],
    };
    if (editing.tipo === 'GOOGLE_SHEETS') {
      base.folderId = (cfg['folderId'] as string) ?? '';
      base.spreadsheetId = (cfg['spreadsheetId'] as string) ?? '';
      base.sheetsMode = base.folderId ? 'folder' : 'spreadsheet';
      base.fileNamePattern = (cfg['fileNamePattern'] as string) ?? '';
      base.sheetName = (cfg['sheetName'] as string) ?? '';
      base.credentialsJson =
        typeof cfg['credentials'] === 'object'
          ? JSON.stringify(cfg['credentials'], null, 2)
          : (cfg['credentials'] as string) ?? '';
    } else if (editing.tipo === 'REST_API') {
      base.baseUrl = (cfg['baseUrl'] as string) ?? '';
      base.authType = (cfg['authType'] as 'none' | 'bearer' | 'basic') ?? 'none';
      base.authValue = (cfg['authValue'] as string) ?? '';
      const hdrs = cfg['headers'] as Record<string, string> | undefined;
      if (hdrs) {
        base.headers = Object.entries(hdrs).map(([key, value]) => ({ key, value }));
      }
    }
    return base;
  };

  const [form, setForm] = useState<ConnectorFormState>(initFormFromEditing);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof ConnectorFormState>(
    key: K,
    value: ConnectorFormState[K]
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
    setTestResult(null);
  };

  // Build config object from form
  const buildConfig = (): Record<string, unknown> => {
    if (form.tipo === 'GOOGLE_SHEETS') {
      let credentials: unknown;
      try {
        credentials = JSON.parse(form.credentialsJson);
      } catch {
        credentials = form.credentialsJson;
      }
      if (form.sheetsMode === 'folder') {
        return {
          folderId: form.folderId.trim(),
          ...(form.sheetName.trim() && { sheetName: form.sheetName.trim() }),
          ...(form.fileNamePattern.trim() && { fileNamePattern: form.fileNamePattern.trim() }),
          credentials,
        };
      }
      return {
        spreadsheetId: form.spreadsheetId.trim(),
        ...(form.sheetName.trim() && { sheetName: form.sheetName.trim() }),
        credentials,
      };
    }
    if (form.tipo === 'REST_API') {
      const headersObj: Record<string, string> = {};
      for (const h of form.headers) {
        if (h.key.trim()) headersObj[h.key.trim()] = h.value;
      }
      return {
        baseUrl: form.baseUrl,
        ...(Object.keys(headersObj).length > 0 && { headers: headersObj }),
        authType: form.authType,
        ...(form.authValue && { authValue: form.authValue }),
      };
    }
    return {};
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.nombre.trim()) errs['nombre'] = 'El nombre es requerido';
    if (form.tipo === 'GOOGLE_SHEETS') {
      if (form.sheetsMode === 'folder') {
        if (!form.folderId.trim()) errs['folderId'] = 'El ID de la carpeta es requerido';
      } else {
        if (!form.spreadsheetId.trim()) errs['spreadsheetId'] = 'El ID de la hoja es requerido';
      }
      if (!form.credentialsJson.trim()) errs['credentialsJson'] = 'Las credenciales son requeridas';
    }
    if (form.tipo === 'REST_API') {
      if (!form.baseUrl.trim()) errs['baseUrl'] = 'La URL base es requerida';
      try {
        new URL(form.baseUrl);
      } catch {
        errs['baseUrl'] = 'URL inválida';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTest = async (): Promise<void> => {
    if (!validateStep2()) return;
    setTestResult(null);
    try {
      const config = buildConfig();
      if (editing) {
        const result = await testExistingMutation.mutateAsync(editing.id);
        setTestResult(result);
      } else {
        const result = await testNewMutation.mutateAsync({
          nombre: form.nombre,
          tipo: form.tipo as TipoConector,
          config,
        });
        setTestResult(result);
      }
    } catch {
      setTestResult({ success: false, message: 'Error al probar conexión' });
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!validateStep2()) return;
    const config = buildConfig();

    try {
      if (editing) {
        const input: UpdateConnectorInput = {
          nombre: form.nombre,
          config,
          frecuenciaSync: form.frecuenciaSync,
        };
        await updateMutation.mutateAsync({ id: editing.id, input });
      } else {
        const input: CreateConnectorInput = {
          nombre: form.nombre,
          tipo: form.tipo as TipoConector,
          config,
          frecuenciaSync: form.frecuenciaSync,
        };
        await createMutation.mutateAsync(input);
      }
      onClose();
    } catch (err) {
      setErrors({
        save:
          err instanceof Error
            ? err.message
            : 'Error al guardar conector',
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isTesting = testNewMutation.isPending || testExistingMutation.isPending;

  const TIPO_OPTIONS: Array<{
    tipo: TipoConector;
    label: string;
    desc: string;
    icon: React.ReactNode;
    disabled?: boolean;
  }> = [
    {
      tipo: 'GOOGLE_SHEETS',
      label: 'Google Sheets',
      desc: 'Conecta con hojas de cálculo de Google',
      icon: <Database size={32} className="text-emerald-500" />,
    },
    {
      tipo: 'REST_API',
      label: 'REST API',
      desc: 'Conecta con cualquier API HTTP/REST',
      icon: <Globe size={32} className="text-blue-500" />,
    },
    {
      tipo: 'POSTGRESQL',
      label: 'PostgreSQL',
      desc: 'Conexión directa a base de datos',
      icon: <Server size={32} className="text-purple-400" />,
      disabled: true,
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Editar fuente' : 'Nueva fuente'}
      >
        <div className="modal-header">
          <div>
            <h2 className="modal-title">
              {editing ? 'Editar fuente' : 'Nueva fuente de datos'}
            </h2>
            {!editing && (
              <p className="modal-step-indicator">
                Paso {step} de 2
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn--sm btn--icon"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Step 1: Select type */}
          {step === 1 && (
            <div>
              <p className="modal-section-label">Selecciona el tipo de fuente</p>
              <div className="tipo-grid">
                {TIPO_OPTIONS.map((opt) => (
                  <button
                    key={opt.tipo}
                    type="button"
                    className={[
                      'tipo-card',
                      form.tipo === opt.tipo ? 'tipo-card--selected' : '',
                      opt.disabled ? 'tipo-card--disabled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      if (!opt.disabled) setField('tipo', opt.tipo);
                    }}
                    disabled={opt.disabled}
                  >
                    <div className="tipo-card-icon">{opt.icon}</div>
                    <div className="tipo-card-label">{opt.label}</div>
                    <div className="tipo-card-desc">{opt.desc}</div>
                    {opt.disabled && (
                      <span className="tipo-card-soon">Próximamente</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 2 && (
            <div className="form-stack">
              {/* Nombre */}
              <div className="form-group">
                <label className="form-label" htmlFor="conn-nombre">
                  Nombre
                </label>
                <input
                  id="conn-nombre"
                  type="text"
                  className={`form-input ${errors['nombre'] ? 'form-input--error' : ''}`}
                  value={form.nombre}
                  onChange={(e) => setField('nombre', e.target.value)}
                  placeholder="Ej: Reportes mensuales"
                  autoFocus
                />
                {errors['nombre'] && (
                  <span className="form-error">{errors['nombre']}</span>
                )}
              </div>

              {/* Google Sheets fields */}
              {form.tipo === 'GOOGLE_SHEETS' && (
                <>
                  {/* Mode toggle */}
                  <div className="form-group">
                    <label className="form-label">Fuente</label>
                    <div className="mode-toggle">
                      <button
                        type="button"
                        className={`mode-toggle-btn ${form.sheetsMode === 'spreadsheet' ? 'mode-toggle-btn--active' : ''}`}
                        onClick={() => setField('sheetsMode', 'spreadsheet')}
                      >
                        <Database size={15} />
                        Hoja individual
                      </button>
                      <button
                        type="button"
                        className={`mode-toggle-btn ${form.sheetsMode === 'folder' ? 'mode-toggle-btn--active' : ''}`}
                        onClick={() => setField('sheetsMode', 'folder')}
                      >
                        <Server size={15} />
                        Carpeta de Drive
                      </button>
                    </div>
                    <p className="form-hint">
                      {form.sheetsMode === 'folder'
                        ? 'Sincroniza todas las planillas de una carpeta de Google Drive automáticamente.'
                        : 'Conecta con una sola planilla de Google Sheets.'}
                    </p>
                  </div>

                  {form.sheetsMode === 'spreadsheet' ? (
                    <div className="form-group">
                      <label className="form-label" htmlFor="conn-sheet-id">
                        Spreadsheet ID
                      </label>
                      <input
                        id="conn-sheet-id"
                        type="text"
                        className={`form-input ${errors['spreadsheetId'] ? 'form-input--error' : ''}`}
                        value={form.spreadsheetId}
                        onChange={(e) => setField('spreadsheetId', e.target.value)}
                        placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                      />
                      <p className="form-hint">
                        El ID está en la URL:{' '}
                        <code>docs.google.com/spreadsheets/d/<strong>[ID]</strong>/edit</code>
                      </p>
                      {errors['spreadsheetId'] && (
                        <span className="form-error">{errors['spreadsheetId']}</span>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="form-group">
                        <label className="form-label" htmlFor="conn-folder-id">
                          ID de Carpeta (Google Drive)
                        </label>
                        <input
                          id="conn-folder-id"
                          type="text"
                          className={`form-input ${errors['folderId'] ? 'form-input--error' : ''}`}
                          value={form.folderId}
                          onChange={(e) => setField('folderId', e.target.value)}
                          placeholder="1a2B3c4D5e6F7g8H9i0J..."
                        />
                        <p className="form-hint">
                          El ID está en la URL de Drive:{' '}
                          <code>drive.google.com/drive/folders/<strong>[ID]</strong></code>
                          <br />
                          Comparte la carpeta con el email de la cuenta de servicio.
                        </p>
                        {errors['folderId'] && (
                          <span className="form-error">{errors['folderId']}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label" htmlFor="conn-file-pattern">
                          Filtro de archivos <span className="config-optional">(opcional)</span>
                        </label>
                        <input
                          id="conn-file-pattern"
                          type="text"
                          className="form-input"
                          value={form.fileNamePattern}
                          onChange={(e) => setField('fileNamePattern', e.target.value)}
                          placeholder="^CUADRE"
                        />
                        <p className="form-hint">
                          Expresión regular para filtrar archivos por nombre (ignora mayúsculas).
                          Ejemplo: <code>^CUADRE</code> — solo sincroniza archivos cuyo nombre empieza con «CUADRE».
                          Dejar vacío para sincronizar todos los archivos de la carpeta.
                        </p>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="conn-sheet-name">
                      Hoja específica <span className="config-optional">(opcional)</span>
                    </label>
                    <input
                      id="conn-sheet-name"
                      type="text"
                      className="form-input"
                      value={form.sheetName}
                      onChange={(e) => setField('sheetName', e.target.value)}
                      placeholder="BASE_CONSOLIDADA_ANUAL"
                    />
                    <p className="form-hint">
                      Nombre exacto de la hoja a leer. Dejar vacío para detección automática
                      (prioridad: hoja consolidada → hojas de fecha → primera hoja).
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="conn-credentials">
                      Credenciales (Service Account JSON)
                    </label>
                    <textarea
                      id="conn-credentials"
                      className={`form-input form-textarea ${errors['credentialsJson'] ? 'form-input--error' : ''}`}
                      value={form.credentialsJson}
                      onChange={(e) => setField('credentialsJson', e.target.value)}
                      placeholder='{"type": "service_account", "project_id": "...", ...}'
                      rows={6}
                    />
                    <p className="form-hint form-hint--warning">
                      La misma clave JSON sirve para todas las fuentes de datos.
                      Se almacena encriptada y nunca aparece en logs.
                    </p>
                    {errors['credentialsJson'] && (
                      <span className="form-error">{errors['credentialsJson']}</span>
                    )}
                  </div>
                </>
              )}

              {/* REST API fields */}
              {form.tipo === 'REST_API' && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="conn-base-url">
                      URL Base
                    </label>
                    <input
                      id="conn-base-url"
                      type="url"
                      className={`form-input ${errors['baseUrl'] ? 'form-input--error' : ''}`}
                      value={form.baseUrl}
                      onChange={(e) => setField('baseUrl', e.target.value)}
                      placeholder="https://api.ejemplo.com/v1"
                    />
                    {errors['baseUrl'] && (
                      <span className="form-error">{errors['baseUrl']}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Autenticación
                    </label>
                    <select
                      className="form-input form-select"
                      value={form.authType}
                      onChange={(e) =>
                        setField('authType', e.target.value as 'none' | 'bearer' | 'basic')
                      }
                    >
                      <option value="none">Sin autenticación</option>
                      <option value="bearer">Bearer token</option>
                      <option value="basic">Basic auth</option>
                    </select>
                  </div>

                  {form.authType !== 'none' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="conn-auth-value">
                        {form.authType === 'bearer' ? 'Token' : 'Credenciales (base64)'}
                      </label>
                      <input
                        id="conn-auth-value"
                        type="password"
                        className="form-input"
                        value={form.authValue}
                        onChange={(e) => setField('authValue', e.target.value)}
                        placeholder={
                          form.authType === 'bearer'
                            ? 'eyJhbGciOi...'
                            : 'dXNlcjpwYXNz'
                        }
                      />
                    </div>
                  )}

                  {/* Headers */}
                  <div className="form-group">
                    <div className="form-label-row">
                      <label className="form-label">
                        Headers adicionales
                      </label>
                      <button
                        type="button"
                        className="btn btn--xs btn--ghost"
                        onClick={() =>
                          setField('headers', [
                            ...form.headers,
                            { key: '', value: '' },
                          ])
                        }
                      >
                        <Plus size={12} /> Agregar
                      </button>
                    </div>
                    {form.headers.map((h, idx) => (
                      <div key={idx} className="header-row">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Header"
                          value={h.key}
                          onChange={(e) => {
                            const updated = [...form.headers];
                            updated[idx] = { ...h, key: e.target.value };
                            setField('headers', updated);
                          }}
                        />
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Valor"
                          value={h.value}
                          onChange={(e) => {
                            const updated = [...form.headers];
                            updated[idx] = { ...h, value: e.target.value };
                            setField('headers', updated);
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn--sm btn--icon btn--icon-danger"
                          onClick={() => {
                            const updated = form.headers.filter(
                              (_, i) => i !== idx
                            );
                            setField('headers', updated);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Frecuencia */}
              <div className="form-group">
                <label className="form-label" htmlFor="conn-frecuencia">
                  Frecuencia de sincronización
                </label>
                <select
                  id="conn-frecuencia"
                  className="form-input form-select"
                  value={form.frecuenciaSync}
                  onChange={(e) =>
                    setField('frecuenciaSync', e.target.value as FrecuenciaSync)
                  }
                >
                  {Object.entries(FRECUENCIA_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Test connection button */}
              <div className="form-group">
                <button
                  type="button"
                  className="btn btn--outline btn--full"
                  onClick={() => { void handleTest(); }}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <Activity size={15} />
                  )}
                  Probar conexión
                </button>

                {testResult && (
                  <div
                    className={`test-result-box ${
                      testResult.success
                        ? 'test-result-box--success'
                        : 'test-result-box--error'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle size={16} />
                    ) : (
                      <XCircle size={16} />
                    )}
                    <div>
                      <p className="test-result-msg">{testResult.message}</p>
                      {testResult.latencyMs !== undefined && testResult.success && (
                        <p className="test-result-latency">
                          Latencia: {testResult.latencyMs}ms
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Save error */}
              {errors['save'] && (
                <div className="test-result-box test-result-box--error">
                  <AlertCircle size={16} />
                  <p>{errors['save']}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === 1 ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!form.tipo}
                onClick={() => setStep(2)}
              >
                Continuar
                <ChevronRight size={16} />
              </button>
            </>
          ) : (
            <>
              {!editing && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setStep(1)}
                >
                  Atrás
                </button>
              )}
              {editing && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={onClose}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => { void handleSave(); }}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 size={15} className="spin" />
                ) : null}
                {editing ? 'Guardar cambios' : 'Crear fuente'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
  conector: Conector;
  onClose: () => void;
}

function DeleteConfirmModal({
  conector,
  onClose,
}: DeleteConfirmProps): React.ReactElement {
  const deleteMutation = useDeleteConnector();

  const handleDelete = async (): Promise<void> => {
    await deleteMutation.mutateAsync(conector.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-body" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="delete-icon-wrap">
            <Trash2 size={32} className="text-red-500" />
          </div>
          <h2 className="modal-title" style={{ marginBottom: '0.5rem' }}>
            ¿Eliminar fuente?
          </h2>
          <p className="modal-subtitle">
            Se desactivará <strong>{conector.nombre}</strong>. El historial de
            sincronizaciones se conservará.
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => { void handleDelete(); }}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 size={14} className="spin" />
            ) : null}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Conectores(): React.ReactElement {
  const { data: conectores, isLoading, error } = useConnectors();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingConector, setEditingConector] = useState<Conector | null>(null);
  const [deletingConector, setDeletingConector] = useState<Conector | null>(null);
  const [historyConector, setHistoryConector] = useState<Conector | null>(null);
  const [orphanResult, setOrphanResult] = useState<string | null>(null);
  const orphanMutation = useDeleteOrphanData();

  const handleEdit = (c: Conector): void => {
    setEditingConector(c);
    setShowModal(true);
  };

  const handleCloseModal = (): void => {
    setShowModal(false);
    setEditingConector(null);
  };

  const handleCleanOrphan = async (): Promise<void> => {
    if (!window.confirm(
      '¿Eliminar los registros de atenciones de prueba (sin conector asignado)?\n\nEstos son datos ficticios del sistema que no provienen de ninguna fuente real. Esta acción no se puede deshacer.'
    )) return;
    setOrphanResult(null);
    try {
      const result = await orphanMutation.mutateAsync();
      setOrphanResult(`${result.deleted} registros de prueba eliminados.`);
      void qc.invalidateQueries({ queryKey: ['kpis'] });
      void qc.invalidateQueries({ queryKey: ['entidades'] });
      void qc.invalidateQueries({ queryKey: ['tendencia'] });
    } catch {
      setOrphanResult('Error al limpiar los registros de prueba.');
    }
  };

  return (
    <div className="page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fuentes de Datos</h1>
          <p className="page-subtitle">
            Gestiona las conexiones a tus fuentes de información
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {orphanResult && (
            <span style={{ fontSize: '0.8rem', color: orphanMutation.isError ? '#ef4444' : '#10b981' }}>
              {orphanResult}
            </span>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => { void handleCleanOrphan(); }}
            disabled={orphanMutation.isPending}
            title="Eliminar registros de prueba sin conector asignado"
          >
            {orphanMutation.isPending ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
            Limpiar pruebas
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />
            Nueva fuente
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="page-loading">
          <Loader2 size={32} className="spin text-blue-500" />
          <span>Cargando fuentes de datos...</span>
        </div>
      ) : error ? (
        <div className="page-error">
          <AlertCircle size={32} className="text-red-500" />
          <p>Error al cargar fuentes de datos</p>
          <p className="page-error-detail">
            {error instanceof Error ? error.message : 'Error desconocido'}
          </p>
        </div>
      ) : !conectores || conectores.length === 0 ? (
        <div className="page-empty">
          <Database size={48} className="text-slate-300" />
          <h2 className="page-empty-title">Sin fuentes configuradas</h2>
          <p className="page-empty-text">
            Agrega tu primera fuente de datos para comenzar a sincronizar
            información.
          </p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />
            Agregar fuente
          </button>
        </div>
      ) : (
        <div className="connectors-grid">
          {conectores.map((c) => (
            <ConnectorCard
              key={c.id}
              conector={c}
              onEdit={handleEdit}
              onDelete={setDeletingConector}
              onHistory={setHistoryConector}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ConnectorModal
          editing={editingConector}
          onClose={handleCloseModal}
        />
      )}

      {deletingConector && (
        <DeleteConfirmModal
          conector={deletingConector}
          onClose={() => setDeletingConector(null)}
        />
      )}

      {historyConector && (
        <SyncHistoryDrawer
          conector={historyConector}
          onClose={() => setHistoryConector(null)}
        />
      )}
    </div>
  );
}
