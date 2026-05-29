import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/prisma.js';

// ─── Action constants ─────────────────────────────────────────────────────────

export const ACCION = {
  LOGIN:                 'LOGIN',
  LOGIN_FALLIDO:         'LOGIN_FALLIDO',
  LOGOUT:                'LOGOUT',
  CAMBIO_PASSWORD:       'CAMBIO_PASSWORD',
  RESET_PASSWORD:        'RESET_PASSWORD',
  USUARIO_CREADO:        'USUARIO_CREADO',
  USUARIO_ACTUALIZADO:   'USUARIO_ACTUALIZADO',
  USUARIO_ELIMINADO:     'USUARIO_ELIMINADO',
  AJUSTE_CREADO:         'AJUSTE_CREADO',
  AJUSTE_AUTORIZADO:     'AJUSTE_AUTORIZADO',
  AJUSTE_RECHAZADO:      'AJUSTE_RECHAZADO',
  AJUSTE_ELIMINADO:      'AJUSTE_ELIMINADO',
  LIQUIDACION_GENERADA:  'LIQUIDACION_GENERADA',
  LIQUIDACION_APROBADA:  'LIQUIDACION_APROBADA',
  LIQUIDACION_PAGADA:    'LIQUIDACION_PAGADA',
  LIQUIDACION_REVERTIDA: 'LIQUIDACION_REVERTIDA',
  CONECTOR_CREADO:       'CONECTOR_CREADO',
  CONECTOR_ACTUALIZADO:  'CONECTOR_ACTUALIZADO',
  CONECTOR_ELIMINADO:    'CONECTOR_ELIMINADO',
  SYNC_INICIADO:         'SYNC_INICIADO',
  DATOS_ELIMINADOS:      'DATOS_ELIMINADOS',
} as const;

export type Accion = (typeof ACCION)[keyof typeof ACCION];

// ─── Row / mapped types ───────────────────────────────────────────────────────

interface AuditLogRow extends RowDataPacket {
  id: string;
  usuario_id: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
  accion: string;
  entidad_tipo: string | null;
  entidad_id: string | null;
  detalle: Record<string, unknown> | string | null;
  ip: string | null;
  created_at: string;
}

export interface AuditLogMapped {
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

export interface InsertAuditData {
  usuarioId?: string | null;
  accion: string;
  entidadTipo?: string | null;
  entidadId?: string | null;
  detalle?: Record<string, unknown> | null;
  ip?: string | null;
}

export interface FindManyParams {
  page?: number;
  limit?: number;
  usuarioId?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapRow(row: AuditLogRow): AuditLogMapped {
  const detalle =
    row.detalle == null
      ? null
      : typeof row.detalle === 'string'
        ? (JSON.parse(row.detalle) as Record<string, unknown>)
        : row.detalle;

  return {
    id: row.id,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre,
    usuarioEmail: row.usuario_email,
    accion: row.accion,
    entidadTipo: row.entidad_tipo,
    entidadId: row.entidad_id,
    detalle,
    ip: row.ip,
    createdAt: row.created_at,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

class AuditoriaRepository {
  async insert(data: InsertAuditData): Promise<void> {
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO audit_log
         (id, usuario_id, accion, entidad_tipo, entidad_id, detalle, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        data.usuarioId ?? null,
        data.accion,
        data.entidadTipo ?? null,
        data.entidadId ?? null,
        data.detalle ? JSON.stringify(data.detalle) : null,
        data.ip ?? null,
      ]
    );
  }

  async findMany(params: FindManyParams): Promise<{ rows: AuditLogMapped[]; total: number }> {
    const page  = Math.max(params.page  ?? 1, 1);
    const limit = Math.min(params.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const bindings: (string | number)[] = [];

    if (params.usuarioId) {
      conditions.push('al.usuario_id = ?');
      bindings.push(params.usuarioId);
    }
    if (params.accion) {
      conditions.push('al.accion = ?');
      bindings.push(params.accion);
    }
    if (params.desde) {
      conditions.push('al.created_at >= ?');
      bindings.push(params.desde + ' 00:00:00');
    }
    if (params.hasta) {
      conditions.push('al.created_at <= ?');
      bindings.push(params.hasta + ' 23:59:59');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM audit_log al ${where}`,
      bindings
    );
    const total: number = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<AuditLogRow[]>(
      `SELECT al.*,
              u.nombre AS usuario_nombre,
              u.email  AS usuario_email
       FROM   audit_log al
       LEFT JOIN usuarios u ON u.id = al.usuario_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`,
      [...bindings, limit, offset]
    );

    return { rows: rows.map(mapRow), total };
  }

  async listAcciones(): Promise<string[]> {
    const [rows] = await pool.query<(RowDataPacket & { accion: string })[]>(
      'SELECT DISTINCT accion FROM audit_log ORDER BY accion ASC'
    );
    return rows.map((r) => r.accion);
  }
}

export const auditoriaRepo = new AuditoriaRepository();
