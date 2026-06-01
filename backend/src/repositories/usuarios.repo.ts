import type { Rol } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/prisma.js';

// ─── Row shapes from DB ───────────────────────────────────────────────────────

interface UsuarioRow extends RowDataPacket {
  id: string;
  email: string;
  nombre: string;
  password_hash: string;
  rol: Rol;
  modulos: string | null;
  activo: number;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface RefreshTokenRow extends RowDataPacket {
  id: string;
  token_hash: string;
  usuario_id: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

// ─── Mapped return types ──────────────────────────────────────────────────────

export interface UsuarioMapped {
  id: string;
  email: string;
  nombre: string;
  passwordHash: string;
  rol: Rol;
  modulos: string[];
  activo: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenMapped {
  id: string;
  tokenHash: string;
  usuarioId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateRefreshTokenData {
  tokenHash: string;
  usuarioId: string;
  expiresAt: Date;
}

export interface CreateUsuarioData {
  nombre: string;
  email: string;
  passwordHash: string;
  rol: Rol;
  modulos?: string[];
}

export interface UpdateUsuarioData {
  nombre?: string;
  email?: string;
  rol?: Rol;
  modulos?: string[];
  activo?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapUsuario(row: UsuarioRow): UsuarioMapped {
  let modulos: string[] = [];
  try {
    if (row.modulos) modulos = JSON.parse(row.modulos) as string[];
  } catch { /* ignore malformed JSON */ }
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    passwordHash: row.password_hash,
    rol: row.rol,
    modulos,
    activo: Boolean(row.activo),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRefreshToken(row: RefreshTokenRow): RefreshTokenMapped {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    usuarioId: row.usuario_id,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class UsuariosRepository {
  async findByEmail(email: string): Promise<UsuarioMapped | null> {
    const [rows] = await pool.query<UsuarioRow[]>(
      'SELECT * FROM usuarios WHERE email = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1',
      [email]
    );
    const row = rows[0];
    return row ? mapUsuario(row) : null;
  }

  async findById(id: string): Promise<UsuarioMapped | null> {
    const [rows] = await pool.query<UsuarioRow[]>(
      'SELECT * FROM usuarios WHERE id = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    const row = rows[0];
    return row ? mapUsuario(row) : null;
  }

  async updateLastSeen(_id: string): Promise<void> {
    // Reserved for future use: track last activity
  }

  async createRefreshToken(data: CreateRefreshTokenData): Promise<RefreshTokenMapped> {
    const id = randomUUID();
    await pool.execute<ResultSetHeader>(
      'INSERT INTO refresh_tokens (id, token_hash, usuario_id, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())',
      [id, data.tokenHash, data.usuarioId, data.expiresAt]
    );
    const [rows] = await pool.query<RefreshTokenRow[]>(
      'SELECT * FROM refresh_tokens WHERE id = ? LIMIT 1',
      [id]
    );
    return mapRefreshToken(rows[0]!);
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenMapped | null> {
    const [rows] = await pool.query<RefreshTokenRow[]>(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1',
      [tokenHash]
    );
    const row = rows[0];
    return row ? mapRefreshToken(row) : null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await pool.execute<ResultSetHeader>(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
      [tokenHash]
    );
  }

  async revokeAllUserRefreshTokens(usuarioId: string): Promise<void> {
    await pool.execute<ResultSetHeader>(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE usuario_id = ? AND revoked_at IS NULL',
      [usuarioId]
    );
  }

  async deleteExpiredTokens(): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
    return result.affectedRows;
  }

  async getUserRol(id: string): Promise<Rol | null> {
    const [rows] = await pool.query<(RowDataPacket & { rol: Rol })[]>(
      'SELECT rol FROM usuarios WHERE id = ? AND activo = 1 AND deleted_at IS NULL LIMIT 1',
      [id]
    );
    return rows[0]?.rol ?? null;
  }

  // ─── Admin CRUD ───────────────────────────────────────────────────────────

  async listAll(): Promise<UsuarioMapped[]> {
    const [rows] = await pool.query<UsuarioRow[]>(
      'SELECT * FROM usuarios WHERE deleted_at IS NULL ORDER BY nombre ASC'
    );
    return rows.map(mapUsuario);
  }

  async findByEmailExcluding(email: string, excludeId: string): Promise<UsuarioMapped | null> {
    const [rows] = await pool.query<UsuarioRow[]>(
      'SELECT * FROM usuarios WHERE email = ? AND id != ? AND deleted_at IS NULL LIMIT 1',
      [email, excludeId]
    );
    return rows[0] ? mapUsuario(rows[0]) : null;
  }

  async create(data: CreateUsuarioData): Promise<UsuarioMapped> {
    const id = randomUUID();
    const modulosJson = data.modulos ? JSON.stringify(data.modulos) : null;
    await pool.execute<ResultSetHeader>(
      'INSERT INTO usuarios (id, email, nombre, password_hash, rol, modulos, activo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())',
      [id, data.email, data.nombre, data.passwordHash, data.rol, modulosJson]
    );
    const [rows] = await pool.query<UsuarioRow[]>('SELECT * FROM usuarios WHERE id = ? LIMIT 1', [id]);
    return mapUsuario(rows[0]!);
  }

  async update(id: string, data: UpdateUsuarioData): Promise<void> {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    if (data.nombre !== undefined) { sets.push('nombre = ?'); params.push(data.nombre); }
    if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email); }
    if (data.rol !== undefined) { sets.push('rol = ?'); params.push(data.rol); }
    if (data.modulos !== undefined) { sets.push('modulos = ?'); params.push(JSON.stringify(data.modulos)); }
    if (data.activo !== undefined) { sets.push('activo = ?'); params.push(data.activo ? 1 : 0); }
    if (sets.length === 0) return;
    sets.push('updated_at = NOW()');
    params.push(id);
    await pool.execute<ResultSetHeader>(
      `UPDATE usuarios SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await pool.execute<ResultSetHeader>(
      'UPDATE usuarios SET password_hash = ?, updated_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [passwordHash, id]
    );
  }

  async softDelete(id: string): Promise<void> {
    await pool.execute<ResultSetHeader>(
      'UPDATE usuarios SET deleted_at = NOW(), activo = 0 WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }
}

export const usuariosRepo = new UsuariosRepository();
