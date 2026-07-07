import { randomUUID } from 'node:crypto';
import { pool } from '../config/prisma.js';
import type { RowDataPacket } from 'mysql2';

export interface ReglaHonorariosRow {
  id: string;
  profesional_nombre: string;
  categoria: string;
  tipo: 'fijo' | 'pct';
  valor_entidad: number;
  valor_particular: number;
  activo: boolean;
  notas: string | null;
}

export interface ReglaEspecialRow {
  id: string;
  tipo_regla: string;
  profesional_nombre: string;
  condicion: string | null;
  valor: number;
  descripcion: string | null;
  activo: boolean;
}

export async function findAllReglas(): Promise<ReglaHonorariosRow[]> {
  const [rows] = await pool.query<(RowDataPacket & ReglaHonorariosRow)[]>(
    `SELECT id, profesional_nombre, categoria, tipo,
            CAST(valor_entidad AS DECIMAL(15,4)) AS valor_entidad,
            CAST(valor_particular AS DECIMAL(15,4)) AS valor_particular,
            activo, notas
     FROM reglas_honorarios WHERE activo = 1
     ORDER BY profesional_nombre, categoria`
  );
  return rows.map((r) => ({
    ...r,
    valor_entidad: Number(r.valor_entidad),
    valor_particular: Number(r.valor_particular),
    activo: Boolean(r.activo),
  }));
}

export async function countReglas(): Promise<number> {
  const [rows] = await pool.query<(RowDataPacket & { cnt: number })[]>(
    'SELECT COUNT(*) AS cnt FROM reglas_honorarios'
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function upsertRegla(
  profesional_nombre: string,
  categoria: string,
  tipo: 'fijo' | 'pct',
  valor_entidad: number,
  valor_particular: number,
  notas?: string | null,
): Promise<void> {
  await pool.execute(
    `INSERT INTO reglas_honorarios
       (id, profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       tipo = VALUES(tipo),
       valor_entidad = VALUES(valor_entidad),
       valor_particular = VALUES(valor_particular),
       notas = VALUES(notas),
       updated_at = CURRENT_TIMESTAMP(3)`,
    [randomUUID(), profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas ?? null]
  );
}

export async function deleteRegla(id: string): Promise<void> {
  await pool.execute('UPDATE reglas_honorarios SET activo = 0 WHERE id = ?', [id]);
}

// ── Reglas especiales ─────────────────────────────────────────────────────────

export async function findAllReglasEspeciales(): Promise<ReglaEspecialRow[]> {
  const [rows] = await pool.query<(RowDataPacket & ReglaEspecialRow)[]>(
    `SELECT id, tipo_regla, profesional_nombre, condicion,
            CAST(valor AS DECIMAL(15,4)) AS valor, descripcion, activo
     FROM reglas_especiales_honorarios WHERE activo = 1
     ORDER BY tipo_regla, profesional_nombre`
  );
  return rows.map((r) => ({
    ...r,
    valor: Number(r.valor),
    activo: Boolean(r.activo),
  }));
}

export async function countReglasEspeciales(): Promise<number> {
  const [rows] = await pool.query<(RowDataPacket & { cnt: number })[]>(
    'SELECT COUNT(*) AS cnt FROM reglas_especiales_honorarios'
  );
  return Number(rows[0]?.cnt ?? 0);
}

export async function insertReglaEspecial(
  tipo_regla: string,
  profesional_nombre: string,
  condicion: string | null,
  valor: number,
  descripcion: string | null,
): Promise<void> {
  await pool.execute(
    `INSERT IGNORE INTO reglas_especiales_honorarios
       (id, tipo_regla, profesional_nombre, condicion, valor, descripcion)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), tipo_regla, profesional_nombre, condicion, valor, descripcion]
  );
}

export async function updateReglaEspecial(
  id: string,
  valor: number,
  descripcion: string | null,
): Promise<void> {
  await pool.execute(
    'UPDATE reglas_especiales_honorarios SET valor = ?, descripcion = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE id = ?',
    [valor, descripcion, id]
  );
}

export async function duplicarReglas(
  from: string,
  to: string,
): Promise<{ copiadas: number }> {
  const [rows] = await pool.query<(RowDataPacket & { categoria: string; tipo: string; valor_entidad: string; valor_particular: string; notas: string | null })[]>(
    'SELECT categoria, tipo, valor_entidad, valor_particular, notas FROM reglas_honorarios WHERE profesional_nombre = ? AND activo = 1',
    [from]
  );

  for (const row of rows) {
    await pool.execute(
      `INSERT INTO reglas_honorarios
         (id, profesional_nombre, categoria, tipo, valor_entidad, valor_particular, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tipo = VALUES(tipo),
         valor_entidad = VALUES(valor_entidad),
         valor_particular = VALUES(valor_particular),
         notas = VALUES(notas),
         activo = 1,
         updated_at = CURRENT_TIMESTAMP(3)`,
      [randomUUID(), to, row.categoria, row.tipo, Number(row.valor_entidad), Number(row.valor_particular), row.notas ?? null]
    );
  }

  return { copiadas: rows.length };
}
