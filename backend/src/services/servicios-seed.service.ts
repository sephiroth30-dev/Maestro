import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import type { RowDataPacket } from 'mysql2';

// Catálogo de procedimientos de neurofisiología/rehabilitación.
// palabrasClave: tokens sin stopwords (DE, CON, POR, EN, Y…), sin acentos.
// Se comparan contra descripcion_norm, que ya es uppercase y sin acentos.

interface ServicioSeed {
  nombre: string;
  palabrasClave: string[];
  tipoConteo: 'unidad' | 'sesion';
  orden: number;
}

const SERVICIOS: ServicioSeed[] = [
  // ── Consultas específicas (orden bajo → se chequean antes que la genérica) ──
  {
    nombre: 'CONSULTA PRIMERA VEZ FISIATRA',
    palabrasClave: ['PRIMERA VEZ FISIATRA', 'CONSULTA FISIATRA', 'CONSULTA DE PRIMERA VEZ FISIATRA', 'FISIATRA'],
    tipoConteo: 'unidad',
    orden: 1,
  },
  {
    nombre: 'CONSULTA PRIMERA VEZ NEUROLOGIA',
    palabrasClave: ['PRIMERA VEZ NEUROLOG', 'CONSULTA NEUROLOG', 'CONSULTA DE PRIMERA VEZ NEUROLOG', 'NEUROLOG'],
    tipoConteo: 'unidad',
    orden: 2,
  },
  {
    nombre: 'CONSULTA DE CONTROL',
    palabrasClave: ['CONSULTA DE CONTROL', 'CONSULTA CONTROL', 'CONTROL NEUROLOGO', 'CONTROL FISIATRA', 'CONTROL MEDICO'],
    tipoConteo: 'unidad',
    orden: 3,
  },
  {
    // Catch-all para otras especialidades / consultas sin clasificar por especialidad
    nombre: 'CONSULTA PRIMERA VEZ',
    palabrasClave: ['CONSULTA PRIMERA VEZ'],
    tipoConteo: 'unidad',
    orden: 4,
  },
  {
    // Telemetría / Video-EEG: cada fila = 1 hora → agrupar por fecha+paciente para contar sesiones
    nombre: 'MONITORIZACION EEG VIDEO-RADIO',
    palabrasClave: [
      'MONITORIZACION ELECTROENCEFALOG', 'TELEMETRIA',
      'VIDEO EEG', 'VIDEOTELEMETRIA', 'VIDETELEMETRIA',
      'VIDEOTABIOMETRIA', 'VIDEO TABIOMETRIA', 'VIDEOENCEFALOGRAFIA',
      'MONITOREO CONTINUO EEG', 'MONITORIZACION CONTINUA',
    ],
    tipoConteo: 'sesion',
    orden: 5,
  },
  {
    nombre: 'ELECTROENCEFALOGRAMA COMPUTARIZADO',
    palabrasClave: ['ELECTROENCEFALOGRAMA COMPUTARIZADO'],
    tipoConteo: 'unidad',
    orden: 6,
  },
  {
    nombre: 'ELECTROMIOGRAFIA',
    palabrasClave: ['ELECTROMIOGRAFIA'],
    tipoConteo: 'unidad',
    orden: 7,
  },
  {
    nombre: 'NEUROCONDUCCION',
    palabrasClave: ['NEUROCONDUCCION', 'CONDUCCION NERVIOSA'],
    tipoConteo: 'unidad',
    orden: 8,
  },
  {
    nombre: 'AGUJA MONOPOLAR',
    palabrasClave: ['AGUJA MONOPOLAR'],
    tipoConteo: 'unidad',
    orden: 9,
  },
  {
    nombre: 'TERAPIA ONDAS DE CHOQUE',
    palabrasClave: ['ONDAS CHOQUE'],
    tipoConteo: 'unidad',
    orden: 10,
  },
  {
    nombre: 'REFLEJO H',
    palabrasClave: ['REFLEJO H'],
    tipoConteo: 'unidad',
    orden: 11,
  },
  {
    nombre: 'INYECCION TOXINA BOTULINICA',
    palabrasClave: ['TOXINA BOTULINICA', 'MIORELAJANTE'],
    tipoConteo: 'unidad',
    orden: 12,
  },
  {
    nombre: 'JUNTA MEDICA INTERDISCIPLINARIA',
    palabrasClave: ['JUNTA MEDICA', 'EQUIPO INTERDISCIPLINARIO', 'PARTICIPACION JUNTA'],
    tipoConteo: 'unidad',
    orden: 13,
  },
  {
    // Polisomnografía: estudio nocturno completo, puede estar en varias filas
    nombre: 'POLISOMNOGRAFIA',
    palabrasClave: ['POLISOMNOGRAFIA', 'POLISOMNOGRAFICO'],
    tipoConteo: 'sesion',
    orden: 14,
  },
  {
    nombre: 'POTENCIALES EVOCADOS',
    palabrasClave: ['POTENCIALES EVOCADOS', 'POTENCIAL EVOCADO'],
    tipoConteo: 'unidad',
    orden: 15,
  },
];

export async function autoSeedServicios(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const s of SERVICIOS) {
    try {
      const [rows] = await pool.query<(RowDataPacket & { id: string })[]>(
        'SELECT id FROM servicios WHERE nombre = ? LIMIT 1',
        [s.nombre]
      );
      const kwJson = JSON.stringify(s.palabrasClave);

      if (rows[0]) {
        // Do NOT update tipo_conteo — manual UI changes must survive restarts.
        // Only sync palabras_clave and orden from the seed.
        await pool.execute(
          'UPDATE servicios SET palabras_clave = ?, orden = ? WHERE id = ?',
          [kwJson, s.orden, rows[0].id]
        );
        updated++;
      } else {
        await pool.execute(
          'INSERT INTO servicios (id, nombre, palabras_clave, tipo_conteo, orden) VALUES (UUID(), ?, ?, ?, ?)',
          [s.nombre, kwJson, s.tipoConteo, s.orden]
        );
        created++;
      }
    } catch (err) {
      logger.warn('servicios-seed: error upserting servicio', {
        nombre: s.nombre,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('Servicios catalog synced', { total: SERVICIOS.length, created, updated });
}
