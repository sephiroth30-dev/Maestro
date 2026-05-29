import { randomUUID } from 'node:crypto';
import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import type { RowDataPacket } from 'mysql2';

// Capacidad instalada 2026 — extraída del documento TH002_CAPACIDAD_INSTALA_2026.xlsx
// Se inserta automáticamente en el primer arranque si la tabla está vacía.
// Usar INSERT IGNORE para que sea idempotente (la UNIQUE KEY evita duplicados).

interface CapacidadSeed {
  grupo: string;
  nombre: string;
  capacidad: number;
  recursos: string;
}

const CAPACIDAD_2026: CapacidadSeed[] = [
  {
    grupo:     'emg_vcn',
    nombre:    'EMG / VCN',
    capacidad: 1440,
    recursos:  '3 salas × 3 pct/h × 8h × 5d × 4ss',
  },
  {
    grupo:     'eeg',
    nombre:    'Electroencefalograma',
    capacidad: 2880,
    recursos:  '9 equipos × 2 pct/h × 8h × 5d × 4ss',
  },
  {
    grupo:     'psg_lms',
    nombre:    'Polisomnografía / LMS',
    capacidad: 200,
    recursos:  '10 equipos × 5 noches × 4ss',
  },
  {
    grupo:     'pe',
    nombre:    'Potenciales Evocados',
    capacidad: 160,
    recursos:  '1 equipo × 1 pct/h × 8h × 5d × 4ss',
  },
  {
    grupo:     'consulta_fisiatria',
    nombre:    'Consulta Medicina Física',
    capacidad: 1440,
    recursos:  '3 consultorios × 3 pct/h × 8h × 5d × 4ss',
  },
  {
    grupo:     'consulta_neurologia',
    nombre:    'Consulta Neurología',
    capacidad: 480,
    recursos:  '1 consultorio × 3 pct/h × 8h × 5d × 4ss',
  },
  {
    grupo:     'consulta_neurologia_pediatrica',
    nombre:    'Consulta Neurología Pediátrica',
    capacidad: 480,
    recursos:  '1 consultorio × 3 pct/h × 8h × 5d × 4ss',
  },
  {
    grupo:     'infiltracion',
    nombre:    'Infiltración / Toxina',
    capacidad: 320,
    recursos:  '2 pct/h × 8h × 5d × 4ss',
  },
];

export async function autoSeedCapacidad(): Promise<void> {
  const [rows] = await pool.query<(RowDataPacket & { cnt: number })[]>(
    'SELECT COUNT(*) AS cnt FROM capacidad_instalada WHERE anio = 2026'
  );
  const existing = Number(rows[0]?.cnt ?? 0);

  if (existing >= CAPACIDAD_2026.length * 12) {
    logger.info('Capacidad seed 2026: ya está completa, omitiendo');
    return;
  }

  let inserted = 0;
  for (const seed of CAPACIDAD_2026) {
    for (let mes = 1; mes <= 12; mes++) {
      await pool.execute(
        `INSERT IGNORE INTO capacidad_instalada
           (id, grupo, nombre, anio, mes_idx, capacidad, recursos)
         VALUES (?, ?, ?, 2026, ?, ?, ?)`,
        [randomUUID(), seed.grupo, seed.nombre, mes, seed.capacidad, seed.recursos]
      );
      inserted++;
    }
  }

  logger.info(`Capacidad seed 2026: ${inserted} filas insertadas (${CAPACIDAD_2026.length} servicios × 12 meses)`);
}
