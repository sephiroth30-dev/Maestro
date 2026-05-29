import { pool } from '../config/prisma.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import type { HonorariosProfesionalRow } from '../services/honorarios.service.js';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type EstadoLiquidacion = 'CALCULADO' | 'APROBADO' | 'PAGADO';

export interface LiquidacionDB {
  id: string;
  profesional_id: string;
  profesional_nombre: string;
  profesional_display: string;
  especialidad: string | null;
  fecha_desde: string;   // 'YYYY-MM-DD'
  fecha_hasta: string;
  estado: EstadoLiquidacion;
  monto_total: number;
  datos_snapshot: HonorariosProfesionalRow;
  aprobado_por: string | null;
  aprobado_por_nombre: string | null;
  aprobado_en: string | null;
  pagado_por: string | null;
  pagado_por_nombre: string | null;
  pagado_en: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const SELECT_LIQUIDACIONES = `
  SELECT
    l.id,
    l.profesional_id,
    p.nombre          AS profesional_nombre,
    COALESCE(p.nombre_completo, p.nombre) AS profesional_display,
    p.especialidad,
    DATE_FORMAT(l.fecha_desde, '%Y-%m-%d') AS fecha_desde,
    DATE_FORMAT(l.fecha_hasta, '%Y-%m-%d') AS fecha_hasta,
    l.estado,
    CAST(l.monto_total AS DECIMAL(15,2)) AS monto_total,
    l.datos_snapshot,
    l.aprobado_por,
    ua.nombre         AS aprobado_por_nombre,
    l.aprobado_en,
    l.pagado_por,
    up.nombre         AS pagado_por_nombre,
    l.pagado_en,
    l.notas,
    l.created_at,
    l.updated_at
  FROM liquidaciones l
  INNER JOIN profesionales p ON p.id = l.profesional_id
  LEFT  JOIN usuarios ua     ON ua.id = l.aprobado_por
  LEFT  JOIN usuarios up     ON up.id = l.pagado_por
`;

function mapRow(r: RowDataPacket): LiquidacionDB {
  return {
    id:                  r.id,
    profesional_id:      r.profesional_id,
    profesional_nombre:  r.profesional_nombre,
    profesional_display: r.profesional_display,
    especialidad:        r.especialidad ?? null,
    fecha_desde:         r.fecha_desde,
    fecha_hasta:         r.fecha_hasta,
    estado:              r.estado as EstadoLiquidacion,
    monto_total:         Number(r.monto_total),
    datos_snapshot:      typeof r.datos_snapshot === 'string'
                           ? JSON.parse(r.datos_snapshot)
                           : r.datos_snapshot,
    aprobado_por:        r.aprobado_por ?? null,
    aprobado_por_nombre: r.aprobado_por_nombre ?? null,
    aprobado_en:         r.aprobado_en ? new Date(r.aprobado_en).toISOString() : null,
    pagado_por:          r.pagado_por ?? null,
    pagado_por_nombre:   r.pagado_por_nombre ?? null,
    pagado_en:           r.pagado_en ? new Date(r.pagado_en).toISOString() : null,
    notas:               r.notas ?? null,
    created_at:          r.created_at,
    updated_at:          r.updated_at,
  };
}

export async function revertirEstado(
  id: string,
  _usuarioId: string,
  razon: string,
): Promise<void> {
  // Solo se puede revertir si está APROBADO (no PAGADO)
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, notas FROM liquidaciones WHERE id = ? AND estado = 'APROBADO'`,
    [id],
  );
  if (!rows.length) return;

  const notaAnterior = rows[0].notas as string | null;
  const entrada = `[Revertido a borrador — ${new Date().toLocaleDateString('es-CO')} — ${razon}]`;
  const nuevaNotas = notaAnterior ? `${notaAnterior}\n${entrada}` : entrada;

  await pool.execute(
    `UPDATE liquidaciones
     SET estado = 'CALCULADO', aprobado_por = NULL, aprobado_en = NULL,
         notas = ?, updated_at = NOW()
     WHERE id = ?`,
    [nuevaNotas, id] as string[],
  );
}

export async function getLiquidacionesByPeriodo(
  fechaDesde: string,
  fechaHasta: string,
): Promise<LiquidacionDB[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT_LIQUIDACIONES}
     WHERE l.fecha_desde = ? AND l.fecha_hasta = ?
     ORDER BY l.monto_total DESC`,
    [fechaDesde, fechaHasta],
  );
  return rows.map(mapRow);
}

export async function getLiquidacionById(id: string): Promise<LiquidacionDB | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${SELECT_LIQUIDACIONES} WHERE l.id = ?`,
    [id],
  );
  return rows.length ? mapRow(rows[0]) : null;
}

export async function upsertLiquidacion(data: {
  profesional_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  monto_total: number;
  datos_snapshot: HonorariosProfesionalRow;
}): Promise<string> {
  const snapshot = JSON.stringify(data.datos_snapshot);

  // Only upsert if not already APROBADO or PAGADO
  const [existing] = await pool.query<RowDataPacket[]>(
    `SELECT id, estado FROM liquidaciones WHERE profesional_id = ? AND fecha_desde = ? AND fecha_hasta = ?`,
    [data.profesional_id, data.fecha_desde, data.fecha_hasta],
  );

  if (existing.length && existing[0].estado !== 'CALCULADO') {
    return existing[0].id as string;
  }

  if (existing.length) {
    await pool.execute(
      `UPDATE liquidaciones SET monto_total = ?, datos_snapshot = ?, updated_at = NOW()
       WHERE id = ?`,
      [data.monto_total, snapshot, existing[0].id] as (string | number)[],
    );
    return existing[0].id as string;
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO liquidaciones (profesional_id, fecha_desde, fecha_hasta, monto_total, datos_snapshot)
     VALUES (?, ?, ?, ?, ?)`,
    [data.profesional_id, data.fecha_desde, data.fecha_hasta, data.monto_total, snapshot] as (string | number)[],
  );

  // Fetch the generated UUID
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM liquidaciones WHERE profesional_id = ? AND fecha_desde = ? AND fecha_hasta = ?`,
    [data.profesional_id, data.fecha_desde, data.fecha_hasta],
  );
  void result;
  return rows[0].id as string;
}

export async function actualizarEstado(
  id: string,
  estado: 'APROBADO' | 'PAGADO',
  usuarioId: string,
  notas?: string,
): Promise<void> {
  if (estado === 'APROBADO') {
    await pool.execute(
      `UPDATE liquidaciones SET estado = 'APROBADO', aprobado_por = ?, aprobado_en = NOW(), updated_at = NOW()
       WHERE id = ? AND estado = 'CALCULADO'`,
      [usuarioId, id] as string[],
    );
  } else {
    await pool.execute(
      `UPDATE liquidaciones SET estado = 'PAGADO', pagado_por = ?, pagado_en = NOW(),
       notas = COALESCE(?, notas), updated_at = NOW()
       WHERE id = ? AND estado = 'APROBADO'`,
      [usuarioId, notas ?? null, id] as (string | null)[],
    );
  }
}

export async function actualizarEstadoLote(
  ids: string[],
  estado: 'APROBADO' | 'PAGADO',
  usuarioId: string,
): Promise<void> {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  if (estado === 'APROBADO') {
    await pool.execute(
      `UPDATE liquidaciones SET estado = 'APROBADO', aprobado_por = ?, aprobado_en = NOW(), updated_at = NOW()
       WHERE id IN (${placeholders}) AND estado = 'CALCULADO'`,
      [usuarioId, ...ids] as string[],
    );
  } else {
    await pool.execute(
      `UPDATE liquidaciones SET estado = 'PAGADO', pagado_por = ?, pagado_en = NOW(), updated_at = NOW()
       WHERE id IN (${placeholders}) AND estado = 'APROBADO'`,
      [usuarioId, ...ids] as string[],
    );
  }
}
