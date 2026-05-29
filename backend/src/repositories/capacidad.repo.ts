import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/prisma.js';

// ─── Row shapes from DB ───────────────────────────────────────────────────────

interface CapacidadRow extends RowDataPacket {
  id: string;
  grupo: string;
  nombre: string;
  anio: number;
  mes_idx: number;
  capacidad: number;
  recursos: string | null;
  created_at: string;
  updated_at: string;
}

interface UtilizacionRow extends RowDataPacket {
  grupo: string;
  nombre: string;
  capacidad: number | null;
  sesiones: number;
  pct_ocupacion: number | null;
  disponible: number | null;
}

// ─── Mapped return types ──────────────────────────────────────────────────────

export interface CapacidadMapped {
  id: string;
  grupo: string;
  nombre: string;
  anio: number;
  mesIdx: number;
  capacidad: number;
  recursos: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UtilizacionMapped {
  grupo: string;
  nombre: string;
  capacidad: number | null;
  sesiones: number;
  pctOcupacion: number | null;
  disponible: number | null;
}

export interface UpsertCapacidadData {
  grupo: string;
  nombre: string;
  anio: number;
  mesIdx: number;
  capacidad: number;
  recursos?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCapacidad(row: CapacidadRow): CapacidadMapped {
  return {
    id: row.id,
    grupo: row.grupo,
    nombre: row.nombre,
    anio: row.anio,
    mesIdx: row.mes_idx,
    capacidad: row.capacidad,
    recursos: row.recursos,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUtilizacion(row: UtilizacionRow): UtilizacionMapped {
  return {
    grupo: row.grupo,
    nombre: row.nombre,
    capacidad: row.capacidad,
    sesiones: Number(row.sesiones),
    pctOcupacion: row.pct_ocupacion != null ? Number(row.pct_ocupacion) : null,
    disponible: row.disponible != null ? Number(row.disponible) : null,
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class CapacidadRepository {
  async upsert(data: UpsertCapacidadData): Promise<CapacidadMapped> {
    const id = randomUUID();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO capacidad_instalada (id, grupo, nombre, anio, mes_idx, capacidad, recursos, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         capacidad = VALUES(capacidad),
         recursos = VALUES(recursos),
         updated_at = NOW(3)`,
      [id, data.grupo, data.nombre, data.anio, data.mesIdx, data.capacidad, data.recursos ?? null]
    );
    // Fetch the upserted row
    const [rows] = await pool.query<CapacidadRow[]>(
      'SELECT * FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ? LIMIT 1',
      [data.grupo, data.anio, data.mesIdx]
    );
    return mapCapacidad(rows[0]!);
  }

  async findByAnio(anio: number): Promise<CapacidadMapped[]> {
    const [rows] = await pool.query<CapacidadRow[]>(
      'SELECT * FROM capacidad_instalada WHERE anio = ? ORDER BY mes_idx ASC',
      [anio]
    );
    return rows.map(mapCapacidad);
  }

  async deleteOne(grupo: string, anio: number, mesIdx: number): Promise<void> {
    await pool.execute<ResultSetHeader>(
      'DELETE FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ?',
      [grupo, anio, mesIdx]
    );
  }

  async getUtilizacion(anio: number, mesIdx: number): Promise<UtilizacionMapped[]> {
    const [rows] = await pool.query<UtilizacionRow[]>(
      `SELECT
        g.grupo,
        g.nombre,
        ci.capacidad,
        COALESCE(s.sesiones, 0) AS sesiones,
        CASE WHEN ci.capacidad > 0 THEN ROUND((COALESCE(s.sesiones,0) / ci.capacidad) * 100, 1) ELSE NULL END AS pct_ocupacion,
        CASE WHEN ci.capacidad > 0 THEN ci.capacidad - COALESCE(s.sesiones,0) ELSE NULL END AS disponible
      FROM (
        SELECT 'emg_vcn' AS grupo, 'EMG / VCN' AS nombre
        UNION ALL SELECT 'eeg', 'Electroencefalograma'
        UNION ALL SELECT 'tlm', 'Videotelemetría (TLM)'
        UNION ALL SELECT 'psg_lms', 'Polisomnografía / LMS'
        UNION ALL SELECT 'pe', 'Potenciales Evocados'
        UNION ALL SELECT 'consulta_fisiatria', 'Consulta Medicina Física'
        UNION ALL SELECT 'consulta_neurologia', 'Consulta Neurología'
        UNION ALL SELECT 'consulta_neurologia_pediatrica', 'Consulta Neurología Pediátrica'
        UNION ALL SELECT 'infiltracion', 'Infiltración / Toxina'
        UNION ALL SELECT 'junta', 'Junta de Profesionales'
        UNION ALL SELECT 'terapia_choque', 'Terapia Ondas de Choque'
        UNION ALL SELECT 'ecografia', 'Ecografía como Guía'
      ) g
      LEFT JOIN capacidad_instalada ci ON ci.grupo = g.grupo AND ci.anio = ? AND ci.mes_idx = ?
      LEFT JOIN (
        SELECT
          CASE
            WHEN sv.nombre LIKE 'ELECTROMIOGRAFIA%' OR sv.nombre LIKE 'NEUROCONDUCCION%' OR sv.nombre LIKE 'REFLEJO H%' OR sv.nombre LIKE 'PRUEBA ESTIMULO REPETITIVO%' OR sv.nombre LIKE 'ONDA F%' THEN 'emg_vcn'
            WHEN sv.nombre LIKE 'ELECTROENCEFALOGRAMA%' THEN 'eeg'
            WHEN sv.nombre LIKE 'MONITORIZACION%' OR sv.nombre LIKE '%TELEMETRI%' THEN 'tlm'
            WHEN sv.nombre LIKE 'POLISOMNOGRAFI%' OR sv.nombre LIKE 'PRUEBA%LATENCIA%' OR sv.nombre LIKE 'ESTUDIO%SUE%' THEN 'psg_lms'
            WHEN sv.nombre LIKE 'POTENCIALES EVOCADOS%' OR sv.nombre LIKE 'POTENCIAL EVOCADO%' THEN 'pe'
            WHEN sv.nombre LIKE 'CONSULTA%NEUROLOG%PEDIATRI%' OR sv.nombre LIKE 'CONSULTA%PEDIATRI%NEUROLOG%' THEN 'consulta_neurologia_pediatrica'
            WHEN sv.nombre LIKE 'CONSULTA%NEUROLOG%' THEN 'consulta_neurologia'
            WHEN sv.nombre LIKE 'CONSULTA%FISIATRA%' OR sv.nombre LIKE 'CONSULTA%MEDICINA FISICA%' OR sv.nombre LIKE 'CONSULTA%REHABILITACION%' THEN 'consulta_fisiatria'
            WHEN sv.nombre LIKE 'INFILTRACION%' OR sv.nombre LIKE 'INYECCION%MIORELAJANTE%' OR sv.nombre LIKE 'INYECCION%TOXINA%' THEN 'infiltracion'
            WHEN sv.nombre LIKE 'JUNTA%' OR sv.nombre LIKE 'PARTICIPACION%JUNTA%' THEN 'junta'
            WHEN sv.nombre LIKE 'TERAPIA%CHOQUE%' OR sv.nombre LIKE '%ONDAS%CHOQUE%' THEN 'terapia_choque'
            WHEN sv.nombre LIKE 'ECOGRAFIA%GUIA%' OR sv.nombre LIKE 'ECOGRAFIA%PROCEDIMIENTO%' THEN 'ecografia'
            ELSE NULL
          END AS grupo,
          COUNT(DISTINCT CONCAT(DATE(a.fecha_dia), '|', COALESCE(a.paciente_nombre,''), '|', COALESCE(a.paciente_documento,''))) AS sesiones
        FROM atenciones a
        JOIN servicios sv ON sv.id = a.servicio_id
        WHERE a.mes_idx = ? AND a.anio = ?
        GROUP BY grupo
        HAVING grupo IS NOT NULL
      ) s ON s.grupo = g.grupo
      ORDER BY FIELD(g.grupo,'emg_vcn','eeg','tlm','psg_lms','pe','consulta_fisiatria','consulta_neurologia','consulta_neurologia_pediatrica','infiltracion','junta','terapia_choque','ecografia')`,
      [anio, mesIdx, mesIdx, anio]
    );
    return rows.map(mapUtilizacion);
  }
}

export const capacidadRepo = new CapacidadRepository();
