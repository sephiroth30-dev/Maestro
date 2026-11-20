import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/prisma.js';

/** Minutos de vigencia de un enlace de restablecimiento. */
export const RESET_VIGENCIA_MINUTOS = 30;

export interface SolicitudesRecientes {
  /** Solicitudes creadas en el último minuto (para el tope de 60 s entre correos). */
  ultimoMinuto: number;
  /** Solicitudes creadas en la última hora (para el tope por hora). */
  ultimaHora: number;
}

export interface CreatePasswordResetData {
  usuarioId: string;
  /** SHA-256 del token. El token en claro NUNCA llega aquí ni se guarda. */
  tokenHash: string;
  ip?: string | null;
}

// Todas las fechas se calculan EN SQL con NOW() (misma hora del servidor de BD para crear,
// caducar y consumir): comparar fechas en JS contra texto de la BD no es fiable
// (el pool devuelve las fechas como texto, ver `usuarios.repo.ts`).
export class PasswordResetsRepository {
  async crear(data: CreatePasswordResetData): Promise<void> {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO password_resets (id, usuario_id, token_hash, created_at, expires_at, ip)
       VALUES (?, ?, ?, NOW(3), NOW(3) + INTERVAL ${RESET_VIGENCIA_MINUTOS} MINUTE, ?)`,
      [randomUUID(), data.usuarioId, data.tokenHash, data.ip ?? null]
    );
  }

  /** Marca como usados todos los enlaces pendientes del usuario (el nuevo reemplaza a los anteriores). */
  async invalidarPendientes(usuarioId: string): Promise<void> {
    await pool.execute<ResultSetHeader>(
      'UPDATE password_resets SET used_at = NOW(3) WHERE usuario_id = ? AND used_at IS NULL',
      [usuarioId]
    );
  }

  /** Cuántas solicitudes tiene el usuario en el último minuto y en la última hora (usadas o no). */
  async contarRecientes(usuarioId: string): Promise<SolicitudesRecientes> {
    const [rows] = await pool.execute<(RowDataPacket & { ultimo_minuto: string | number | null; ultima_hora: string | number | null })[]>(
      `SELECT SUM(created_at >= NOW(3) - INTERVAL 60 SECOND) AS ultimo_minuto,
              SUM(created_at >= NOW(3) - INTERVAL 1 HOUR)    AS ultima_hora
         FROM password_resets
        WHERE usuario_id = ?`,
      [usuarioId]
    );
    return {
      ultimoMinuto: Number(rows[0]?.ultimo_minuto ?? 0),
      ultimaHora: Number(rows[0]?.ultima_hora ?? 0),
    };
  }

  /**
   * Consume el token de forma ATÓMICA: el `UPDATE` solo toca la fila si sigue sin usar y vigente,
   * así que con dos clics a la vez gana uno solo. Devuelve las filas afectadas: el llamador debe
   * exigir exactamente 1 antes de cambiar nada.
   */
  async consumir(tokenHash: string): Promise<number> {
    const [res] = await pool.execute<ResultSetHeader>(
      'UPDATE password_resets SET used_at = NOW(3) WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW(3)',
      [tokenHash]
    );
    return res.affectedRows;
  }

  async usuarioDeToken(tokenHash: string): Promise<string | null> {
    const [rows] = await pool.execute<(RowDataPacket & { usuario_id: string })[]>(
      'SELECT usuario_id FROM password_resets WHERE token_hash = ? LIMIT 1',
      [tokenHash]
    );
    return rows[0]?.usuario_id ?? null;
  }
}

export const passwordResetsRepo = new PasswordResetsRepository();
