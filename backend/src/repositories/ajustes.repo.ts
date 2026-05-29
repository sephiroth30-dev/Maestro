import { pool } from '../config/prisma.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EstadoAjuste = 'PENDIENTE' | 'AUTORIZADO' | 'RECHAZADO';

export interface AjusteDB {
  id: string;
  liquidacion_id: string;
  categoria: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
  justificacion: string;
  referencia_doc: string | null;
  estado: EstadoAjuste;
  creado_por: string;
  creado_por_nombre: string | null;
  autorizado_por: string | null;
  autorizado_por_nombre: string | null;
  autorizado_en: string | null;
  motivo_rechazo: string | null;
  created_at: string;
}

// ─── Mapeo ────────────────────────────────────────────────────────────────────

function mapAjuste(r: RowDataPacket): AjusteDB {
  return {
    id:                    r.id,
    liquidacion_id:        r.liquidacion_id,
    categoria:             r.categoria,
    descripcion:           r.descripcion,
    cantidad:              Number(r.cantidad),
    valor_unitario:        Number(r.valor_unitario),
    valor_total:           Number(r.valor_total),
    justificacion:         r.justificacion,
    referencia_doc:        r.referencia_doc ?? null,
    estado:                r.estado as EstadoAjuste,
    creado_por:            r.creado_por,
    creado_por_nombre:     r.creado_por_nombre ?? null,
    autorizado_por:        r.autorizado_por ?? null,
    autorizado_por_nombre: r.autorizado_por_nombre ?? null,
    autorizado_en:         r.autorizado_en ? new Date(r.autorizado_en).toISOString() : null,
    motivo_rechazo:        r.motivo_rechazo ?? null,
    created_at:            r.created_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAjustesByLiquidacion(liquidacionId: string): Promise<AjusteDB[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*,
            uc.nombre AS creado_por_nombre,
            ua.nombre AS autorizado_por_nombre
     FROM liquidacion_ajustes a
     LEFT JOIN usuarios uc ON uc.id = a.creado_por
     LEFT JOIN usuarios ua ON ua.id = a.autorizado_por
     WHERE a.liquidacion_id = ?
     ORDER BY a.created_at ASC`,
    [liquidacionId],
  );
  return rows.map(mapAjuste);
}

export async function getAjusteById(id: string): Promise<AjusteDB | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*,
            uc.nombre AS creado_por_nombre,
            ua.nombre AS autorizado_por_nombre
     FROM liquidacion_ajustes a
     LEFT JOIN usuarios uc ON uc.id = a.creado_por
     LEFT JOIN usuarios ua ON ua.id = a.autorizado_por
     WHERE a.id = ?`,
    [id],
  );
  return rows.length ? mapAjuste(rows[0]) : null;
}

export async function crearAjuste(data: {
  liquidacion_id: string;
  categoria: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  justificacion: string;
  referencia_doc?: string;
  creado_por: string;
}): Promise<AjusteDB> {
  const valor_total = data.cantidad * data.valor_unitario;
  await pool.execute<ResultSetHeader>(
    `INSERT INTO liquidacion_ajustes
       (liquidacion_id, categoria, descripcion, cantidad, valor_unitario, valor_total,
        justificacion, referencia_doc, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.liquidacion_id, data.categoria, data.descripcion,
      data.cantidad, data.valor_unitario, valor_total,
      data.justificacion, data.referencia_doc ?? null, data.creado_por,
    ] as (string | number | null)[],
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, uc.nombre AS creado_por_nombre, ua.nombre AS autorizado_por_nombre
     FROM liquidacion_ajustes a
     LEFT JOIN usuarios uc ON uc.id = a.creado_por
     LEFT JOIN usuarios ua ON ua.id = a.autorizado_por
     WHERE a.liquidacion_id = ? AND a.creado_por = ?
     ORDER BY a.created_at DESC LIMIT 1`,
    [data.liquidacion_id, data.creado_por],
  );
  return mapAjuste(rows[0]);
}

export async function autorizarAjuste(id: string, autorizadoPor: string): Promise<void> {
  await pool.execute(
    `UPDATE liquidacion_ajustes
     SET estado = 'AUTORIZADO', autorizado_por = ?, autorizado_en = NOW(), updated_at = NOW()
     WHERE id = ? AND estado = 'PENDIENTE' AND creado_por != ?`,
    [autorizadoPor, id, autorizadoPor] as string[],
  );
}

export async function rechazarAjuste(id: string, usuarioId: string, motivo: string): Promise<void> {
  await pool.execute(
    `UPDATE liquidacion_ajustes
     SET estado = 'RECHAZADO', autorizado_por = ?, autorizado_en = NOW(),
         motivo_rechazo = ?, updated_at = NOW()
     WHERE id = ? AND estado = 'PENDIENTE' AND creado_por != ?`,
    [usuarioId, motivo, id, usuarioId] as string[],
  );
}

export async function eliminarAjuste(id: string, creadoPor: string): Promise<void> {
  await pool.execute(
    `DELETE FROM liquidacion_ajustes WHERE id = ? AND creado_por = ? AND estado = 'PENDIENTE'`,
    [id, creadoPor] as string[],
  );
}

// Suma de ajustes autorizados para incluir en el total efectivo
export async function getMontoAjustesAutorizados(liquidacionId: string): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(valor_total), 0) AS total
     FROM liquidacion_ajustes
     WHERE liquidacion_id = ? AND estado = 'AUTORIZADO'`,
    [liquidacionId],
  );
  return Number(rows[0].total);
}
