import type { Conector, Sincronizacion, EstadoSync, TipoConector } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/prisma.js';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateConectorData {
  nombre: string;
  tipo: TipoConector;
  config: Record<string, unknown>;
  frecuenciaSync?: string;
}

export interface UpdateConectorData {
  nombre?: string;
  config?: Record<string, unknown>;
  activo?: boolean;
  frecuenciaSync?: string;
  ultimaSync?: Date;
}

export interface CreateSincronizacionData {
  conectorId: string;
  estado: EstadoSync;
  filasLeidas?: number;
  filasNuevas?: number;
  errores?: Record<string, unknown>;
  finalizadaAt?: Date;
}

// ─── Row shapes from DB ───────────────────────────────────────────────────────

interface ConectorRow extends RowDataPacket {
  id: string;
  nombre: string;
  tipo: TipoConector;
  config: string | Record<string, unknown>;
  activo: number;
  frecuencia_sync: string;
  ultima_sync: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface SincronizacionRow extends RowDataPacket {
  id: string;
  conector_id: string;
  estado: EstadoSync;
  filas_leidas: number;
  filas_nuevas: number;
  errores: string | Record<string, unknown> | null;
  iniciada_at: Date;
  finalizada_at: Date | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapConector(row: ConectorRow): Conector {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    config: (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) as Record<string, unknown>,
    activo: Boolean(row.activo),
    frecuenciaSync: row.frecuencia_sync,
    ultimaSync: row.ultima_sync,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as unknown as Conector;
}

function mapSincronizacion(row: SincronizacionRow): Sincronizacion {
  return {
    id: row.id,
    conectorId: row.conector_id,
    estado: row.estado,
    filasLeidas: row.filas_leidas,
    filasNuevas: row.filas_nuevas,
    errores: row.errores !== null
      ? (typeof row.errores === 'string' ? JSON.parse(row.errores) : row.errores)
      : null,
    iniciadaAt: row.iniciada_at,
    finalizadaAt: row.finalizada_at,
  } as unknown as Sincronizacion;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ConectoresRepository {
  // ─── Conector CRUD ────────────────────────────────────────────────────────

  async create(data: CreateConectorData): Promise<Conector> {
    const id = randomUUID();
    const frecuenciaSync = data.frecuenciaSync ?? 'daily';
    await pool.execute<ResultSetHeader>(
      'INSERT INTO conectores (id, nombre, tipo, config, activo, frecuencia_sync, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())',
      [id, data.nombre, data.tipo, JSON.stringify(data.config), frecuenciaSync]
    );
    const [rows] = await pool.query<ConectorRow[]>(
      'SELECT * FROM conectores WHERE id = ? LIMIT 1',
      [id]
    );
    return mapConector(rows[0]!);
  }

  async findAll(): Promise<Conector[]> {
    const [rows] = await pool.query<ConectorRow[]>(
      'SELECT * FROM conectores ORDER BY created_at DESC'
    );
    return rows.map(mapConector);
  }

  async findAllActive(): Promise<Conector[]> {
    const [rows] = await pool.query<ConectorRow[]>(
      'SELECT * FROM conectores WHERE activo = 1 ORDER BY nombre ASC'
    );
    return rows.map(mapConector);
  }

  async findById(id: string): Promise<Conector | null> {
    const [rows] = await pool.query<ConectorRow[]>(
      'SELECT * FROM conectores WHERE id = ? LIMIT 1',
      [id]
    );
    const row = rows[0];
    return row ? mapConector(row) : null;
  }

  async update(id: string, data: UpdateConectorData): Promise<Conector> {
    const setClauses: string[] = [];
    const params: (string | boolean | Date | number)[] = [];

    if (data.nombre !== undefined) {
      setClauses.push('nombre = ?');
      params.push(data.nombre);
    }
    if (data.config !== undefined) {
      setClauses.push('config = ?');
      params.push(JSON.stringify(data.config));
    }
    if (data.activo !== undefined) {
      setClauses.push('activo = ?');
      params.push(data.activo ? 1 : 0);
    }
    if (data.frecuenciaSync !== undefined) {
      setClauses.push('frecuencia_sync = ?');
      params.push(data.frecuenciaSync);
    }
    if (data.ultimaSync !== undefined) {
      setClauses.push('ultima_sync = ?');
      params.push(data.ultimaSync);
    }

    setClauses.push('updated_at = NOW()');
    params.push(id);

    await pool.execute<ResultSetHeader>(
      `UPDATE conectores SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );
    const [rows] = await pool.query<ConectorRow[]>(
      'SELECT * FROM conectores WHERE id = ? LIMIT 1',
      [id]
    );
    return mapConector(rows[0]!);
  }

  async softDelete(id: string): Promise<void> {
    await pool.execute<ResultSetHeader>('DELETE FROM atenciones WHERE conector_id = ?', [id]);
    await pool.execute<ResultSetHeader>('DELETE FROM sincronizaciones WHERE conector_id = ?', [id]);
    await pool.execute<ResultSetHeader>('DELETE FROM conectores WHERE id = ?', [id]);
  }

  // ─── Sincronizaciones ─────────────────────────────────────────────────────

  async createSincronizacion(
    data: CreateSincronizacionData
  ): Promise<Sincronizacion> {
    const id = randomUUID();
    const filasLeidas = data.filasLeidas ?? 0;
    const filasNuevas = data.filasNuevas ?? 0;
    const errores = data.errores !== undefined ? JSON.stringify(data.errores) : null;
    const finalizadaAt = data.finalizadaAt ?? null;

    await pool.execute<ResultSetHeader>(
      'INSERT INTO sincronizaciones (id, conector_id, estado, filas_leidas, filas_nuevas, errores, iniciada_at, finalizada_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)',
      [id, data.conectorId, data.estado, filasLeidas, filasNuevas, errores, finalizadaAt]
    );
    const [rows] = await pool.query<SincronizacionRow[]>(
      'SELECT * FROM sincronizaciones WHERE id = ? LIMIT 1',
      [id]
    );
    return mapSincronizacion(rows[0]!);
  }

  async updateSincronizacion(
    id: string,
    data: Partial<{
      estado: EstadoSync;
      filasLeidas: number;
      filasNuevas: number;
      errores: Record<string, unknown>;
      finalizadaAt: Date;
    }>
  ): Promise<Sincronizacion> {
    const setClauses: string[] = [];
    const params: (string | number | Date | null)[] = [];

    if (data.estado !== undefined) {
      setClauses.push('estado = ?');
      params.push(data.estado);
    }
    if (data.filasLeidas !== undefined) {
      setClauses.push('filas_leidas = ?');
      params.push(data.filasLeidas);
    }
    if (data.filasNuevas !== undefined) {
      setClauses.push('filas_nuevas = ?');
      params.push(data.filasNuevas);
    }
    if (data.errores !== undefined) {
      setClauses.push('errores = ?');
      params.push(JSON.stringify(data.errores));
    }
    if (data.finalizadaAt !== undefined) {
      setClauses.push('finalizada_at = ?');
      params.push(data.finalizadaAt);
    }

    if (setClauses.length > 0) {
      params.push(id);
      await pool.execute<ResultSetHeader>(
        `UPDATE sincronizaciones SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    }

    const [rows] = await pool.query<SincronizacionRow[]>(
      'SELECT * FROM sincronizaciones WHERE id = ? LIMIT 1',
      [id]
    );
    return mapSincronizacion(rows[0]!);
  }

  async findSincronizacionesByConector(
    conectorId: string,
    limit = 20
  ): Promise<Sincronizacion[]> {
    const [rows] = await pool.query<SincronizacionRow[]>(
      'SELECT * FROM sincronizaciones WHERE conector_id = ? ORDER BY iniciada_at DESC LIMIT ?',
      [conectorId, limit]
    );
    return rows.map(mapSincronizacion);
  }
}

export const conectoresRepo = new ConectoresRepository();
