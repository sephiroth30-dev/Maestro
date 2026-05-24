import { randomUUID } from 'node:crypto';
import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// New entity definitions sourced from real Maestro data (all months 2026).
// Each entry: [nombre, nombres_raw JSON, tipo, es_grupo_caja]
const NEW_ENTITIES: Array<[string, string, string, number]> = [
  // EPS
  ['COMFENALCO VALLE',               '["COMFENALCO","COMFENALCO VALLE","CAJA DE COMPENSACION FAMILIAR DEL VALLE"]',                   'EPS',      0],
  ['SERVICIO OCCIDENTAL DE SALUD',   '["SERVICIO OCCIDENTAL","SOS SALUD","OCCIDENTAL DE SALUD"]',                                    'EPS',      0],
  ['SALUD TOTAL',                    '["SALUD TOTAL","SALUD TOTAL SA","SALUD TOTAL EPS"]',                                            'EPS',      0],
  // Medicina prepagada / seguros
  ['COLMEDICA',                      '["COLMEDICA","COLMEDICA MEDICINA PREPAGADA","COLMEDICA LINEA"]',                                'PREPAGADA',0],
  ['COOMEVA',                        '["COOMEVA","COOMEVA MEDICINA PREPAGADA","COOMEVA EPS"]',                                        'PREPAGADA',0],
  ['MEDISANITAS',                    '["MEDISANITAS","MEDISANITAS SA"]',                                                              'PREPAGADA',0],
  ['COLSANITAS',                     '["COLSANITAS","COLSANITAS SA"]',                                                               'PREPAGADA',0],
  ['AXA COLPATRIA',                  '["AXA COLPATRIA","COLPATRIA","AXA COLPATRIA MEDICINA PREPAGADA","AXA COLPATRIA SEGUROS"]',      'PREPAGADA',0],
  ['MEDPLUS',                        '["MEDPLUS","MEDPLUS MEDICINA PREPAGADA","MEDPLUS SA"]',                                         'PREPAGADA',0],
  ['PROTEGEMOS',                     '["PROTEGEMOS","PROTEGEMOS SA"]',                                                               'PREPAGADA',0],
  ['SEGUROS BOLIVAR',                '["SEGUROS BOLIVAR","COMPANIA DE SEGUROS BOLIVAR","BOLIVAR SEGUROS"]',                          'PREPAGADA',0],
  // Convenios
  ['ALIANZA ESTRATEGICAS',           '["ALIANZA ESTRATEGICAS","ALIANZA ESTRATEG","ALIANZAS ESTRATEGICAS EN SERVICIOS"]',             'CONVENIO', 0],
  ['ALIANZAS VIP',                   '["ALIANZAS VIP","ALIANZA VIP"]',                                                              'CONVENIO', 0],
  ['CLINICA DE OCCIDENTE',           '["CLINICA DE OCCIDENTE","CLINICA OCCIDENTE","CLINICA DE OCCIDENTE SA"]',                       'CONVENIO', 0],
  ['CLINICA VERSALLES',              '["CLINICA VERSALLES","VERSALLES SA","CLINICA VERSALLES SA"]',                                  'CONVENIO', 0],
  ['UNISALUD UNAL',                  '["UNISALUD","UNISALUD UNAL","UNISALUD UNIVERSIDAD"]',                                          'CONVENIO', 0],
  ['ECOPETROL',                      '["ECOPETROL","ECOPETROL SA"]',                                                                'CONVENIO', 0],
  ['UNIDAD SALUD OCUPACIONAL',       '["UNIDAD DE SALUD OCUPACIONAL","OCUPACIONALSAS","UNIDAD SALUD OCUPACIONAL"]',                  'CONVENIO', 0],
  ['UNIDAD MEDICA LER',              '["UNIDAD MEDICA LER","MEDICA LER"]',                                                          'CONVENIO', 0],
  ['INSTITUTO RELIGIOSAS SAN JOSE',  '["INSTITUTO DE RELIGIOSAS","SAN JOSE DE GERONA","RELIGIOSAS SAN JOSE"]',                       'CONVENIO', 0],
  ['IPS SOLUCIONES MEDICAS',         '["IPS SOLUCIONES MEDICAS","SOLUCIONES MEDICAS EN SALUD"]',                                    'CONVENIO', 0],
  ['IPS OCUPACIONAL SANTA CLARA',    '["OCUPACIONAL SANTA CLARA","IPS OCUPACIONAL SANTA CLARA"]',                                   'CONVENIO', 0],
  ['CENTRO MEDICO MEDISALUD',        '["MEDISALUD IPS","CENTRO MEDICO MEDISALUD","MEDISALUD SAS"]',                                 'CONVENIO', 0],
  ['OMNI SALUD',                     '["MEDICO ODONTOLOGICA NACIONAL","OMNI","ORGANIZACION MEDICO ODONTOLOGICA"]',                   'CONVENIO', 0],
  ['FIDUCIARIA PREVISORA FOMAG',     '["FIDUCIARIA LA PREVISORA","FOMAG","PREVISORA SA FOMAG"]',                                    'CONVENIO', 0],
  ['TARJETA LA MEDICA',              '["TARJETA LA MEDICA","LA MEDICA TARJETA"]',                                                   'CONVENIO', 0],
  ['COSERSSA',                       '["COSERSSA"]',                                                                                'CONVENIO', 0],
  ['TSERVIMOS',                      '["TSERVIMOS"]',                                                                               'CONVENIO', 0],
  ['GLADYS GOMEZ BERMEO',            '["GLADYS GOMEZ BERMEO","GLADYS GOMEZ"]',                                                      'CONVENIO', 0],
];

// Updated nombres_raw for existing entries (nombre → new JSON).
const UPDATED_ENTITIES: Array<[string, string]> = [
  ['SANITAS',           '["SANITAS","EPS SANITAS","ENTIDAD PROMOTORA DE SALUD SANITAS","SASEN"]'],
  ['SURAMERICANA',      '["SURAMERICANA","EPS SURAMERICANA","EPS SURAMERICANA SA","SEGUROS DE VIDA SURAMERICANA","SURAMERCIANA","EPS SURA"]'],
  ['NUEVA EPS',         '["NUEVA EPS","NUEVAEPS","NUEVA EPS SA"]'],
  ['COMPENSAR',         '["COMPENSAR","COMPENSAR EPS"]'],
  ['FAMISANAR',         '["FAMISANAR","FAMISANAR LTDA"]'],
  ['MEDIMAS',           '["MEDIMAS","MÉDIMAS","MEDIMAS EPS"]'],
  ['ALIANSALUD',        '["ALIANSALUD","ALIAN SALUD","ALIANSALUD EPS"]'],
  ['COMFAMILIAR',       '["COMFAMILIAR","COMFAMILIAR RISARALDA","CAJA DE COMPENSACION FAMILIAR DE RISARALDA"]'],
  ['VIVA 1A',           '["VIVA 1A","VIVA1A","VIVA","VIVA 1A EPS"]'],
  ['PARTICULARES',      '["PARTICULARES","PARTICULAR","PART","PARTICULARES/CONVENIOS","PACIENTE PARTICULAR"]'],
  ['CONVENIO EMPRESARIAL','["CONVENIO EMPRESARIAL","CONVENIO","CONVENIO CM","CONVENIO CM PLUS","CONVENIOS"]'],
  ['DALELA',            '["DALELA","DALELA1130","DALELA IPS"]'],
];

export async function runEntityMigration(): Promise<void> {
  try {
    // 1. Update nombres_raw for existing entities
    for (const [nombre, nombresRaw] of UPDATED_ENTITIES) {
      await pool.execute<ResultSetHeader>(
        'UPDATE entidades SET nombres_raw = ? WHERE nombre = ?',
        [nombresRaw, nombre]
      );
    }

    // 2. Remove duplicate 'PARTICULAR' entry if it exists alongside 'PARTICULARES'
    const [particularRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM entidades WHERE nombre = 'PARTICULAR' LIMIT 1"
    );
    const [particularesRows] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM entidades WHERE nombre = 'PARTICULARES' LIMIT 1"
    );
    if (particularRows.length > 0 && particularesRows.length > 0) {
      await pool.execute<ResultSetHeader>(
        "DELETE FROM entidades WHERE nombre = 'PARTICULAR'"
      );
    }

    // 3. Insert new entities (skip if nombre already exists)
    const [existing] = await pool.query<(RowDataPacket & { nombre: string })[]>(
      'SELECT nombre FROM entidades'
    );
    const existingNames = new Set(existing.map((r) => r.nombre.toUpperCase()));

    let inserted = 0;
    for (const [nombre, nombresRaw, tipo, esGrupoCaja] of NEW_ENTITIES) {
      if (!existingNames.has(nombre.toUpperCase())) {
        await pool.execute<ResultSetHeader>(
          'INSERT INTO entidades (id, nombre, nombres_raw, tipo, es_grupo_caja, activa, created_at) VALUES (?, ?, ?, ?, ?, 1, NOW())',
          [randomUUID(), nombre, nombresRaw, tipo, esGrupoCaja]
        );
        inserted++;
      }
    }

    logger.info('Entity migration complete', { inserted, updated: UPDATED_ENTITIES.length });
  } catch (err) {
    logger.error('Entity migration failed', { error: (err as Error).message });
  }
}
