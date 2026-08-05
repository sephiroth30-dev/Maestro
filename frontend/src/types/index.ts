// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Rol =
  | 'ADMIN'
  | 'GERENCIA'
  | 'DIRECCION'
  | 'FACTURACION'
  | 'COORDINADORA'
  | 'ADMISIONES'
  | 'RECURSOS_HUMANOS';

export interface User {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  modulos?: string[];
}

export type Modulo = 'dashboard' | 'reportes' | 'pacientes' | 'honorarios' | 'capacidad' | 'auditoria' | 'configuracion' | 'aprobar';

export const MODULO_LABELS: Record<Modulo, string> = {
  dashboard: 'Dashboard',
  reportes: 'Reportes',
  pacientes: 'Analítica de pacientes',
  honorarios: 'Honorarios',
  capacidad: 'Capacidad instalada',
  auditoria: 'Auditoría',
  configuracion: 'Configuración',
  aprobar: 'Autorizar liquidaciones',
};

// ─── API Request/Response Types ───────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: User;
}

export interface RefreshResponse {
  accessToken: string;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  requestId?: string;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
  version: string;
}

// ─── Role Display Labels ──────────────────────────────────────────────────────

export const ROL_LABELS: Record<Rol, string> = {
  ADMIN: 'Administrador',
  GERENCIA: 'Gerencia',
  DIRECCION: 'Dirección',
  FACTURACION: 'Facturación',
  COORDINADORA: 'Coordinadora',
  ADMISIONES: 'Admisiones',
  RECURSOS_HUMANOS: 'Recursos Humanos',
};

// ─── Auditoría ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  usuarioEmail: string | null;
  accion: string;
  entidadTipo: string | null;
  entidadId: string | null;
  detalle: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditoriaResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

// ─── Capacidad Instalada ──────────────────────────────────────────────────────

/**
 * Contra qué se compara la capacidad de un grupo.
 *
 * - `pacientes` — visitas únicas (paciente + día). EMG y VCN en la misma cita
 *   ocupan un solo hueco de agenda.
 * - `estudios` — registros facturados. En Potenciales Evocados una visita cubre
 *   varias modalidades y cada una consume equipo y lectura por separado.
 */
export type BaseConteo = 'pacientes' | 'estudios';

export interface CapacidadConfig {
  id: string;
  grupo: string;
  nombre: string;
  anio: number;
  mesIdx: number;
  capacidad: number;
  recursos: string | null;
  /** `null` = usar la base por omisión del grupo. */
  baseConteo: BaseConteo | null;
}

export interface UtilizacionGrupo {
  grupo: string;
  nombre: string;
  capacidad: number | null;
  /** Cuál de las dos cifras gobierna la ocupación de este grupo. */
  base: BaseConteo;
  /** Visitas únicas: paciente + día. */
  pacientes: number;
  /** Registros facturados. */
  estudios: number;
  /** Registros sin identificación de paciente, imposibles de deduplicar. */
  sinPaciente: number;
  /** La cifra de `base`: es la que se compara contra la capacidad. */
  sesiones: number;
  pctOcupacion: number | null;
  disponible: number | null;
}
