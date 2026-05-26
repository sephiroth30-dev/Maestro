import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import type { RowDataPacket } from 'mysql2';

// Catálogo completo de entidades — sincronizado automáticamente en cada arranque.
// Modifica esta lista para agregar/renombrar entidades sin necesidad de correr seed manualmente.

interface EntidadSeed {
  nombre: string;
  nombresRaw: string[];
  tipo: 'EPS' | 'CONVENIO' | 'PARTICULAR' | 'ARL' | 'OTRO';
  esGrupoCaja?: boolean;
}

const ENTIDADES: EntidadSeed[] = [
  // ── EPS principales ──────────────────────────────────────────────────────────
  { nombre: 'COMFAMILIAR',         nombresRaw: ['COMFAMILIAR', 'COMFAMILIAR RISARALDA'],                tipo: 'EPS' },
  { nombre: 'SANITAS',             nombresRaw: ['SANITAS', 'EPS SANITAS', 'ENTIDAD PROMOTORA DE SALUD SANITAS'], tipo: 'EPS' },
  { nombre: 'SURAMERICANA',        nombresRaw: ['SURAMERICANA', 'EPS SURA', 'SURAMERCIANA', 'EPS SURAMERICANA'], tipo: 'EPS' },
  { nombre: 'NUEVA EPS',           nombresRaw: ['NUEVA EPS', 'NUEVAEPS'],                              tipo: 'EPS' },
  { nombre: 'VIVA 1A',             nombresRaw: ['VIVA 1A', 'VIVA1A', 'VIVA'],                         tipo: 'EPS' },
  { nombre: 'COMPENSAR',           nombresRaw: ['COMPENSAR'],                                          tipo: 'EPS' },
  { nombre: 'FAMISANAR',           nombresRaw: ['FAMISANAR', 'CAJA DE COMPENSACION FAMILIAR FAMISANAR'], tipo: 'EPS' },
  { nombre: 'MEDIMAS',             nombresRaw: ['MEDIMAS', 'MÉDIMAS'],                                 tipo: 'EPS' },
  { nombre: 'SURA',                nombresRaw: ['SURA', 'EPS SURA'],                                   tipo: 'EPS' },
  { nombre: 'ALIANSALUD',          nombresRaw: ['ALIANSALUD', 'ALIAN SALUD'],                          tipo: 'EPS' },
  { nombre: 'COMFENALCO VALLE',    nombresRaw: ['COMFENALCO VALLE', 'COMFENALCO', 'CAJA DE COMPENSACION FAMILIAR DEL VALLE', 'CAJA COMPENSACION FAMILIAR DEL VALLE'], tipo: 'EPS' },
  { nombre: 'SALUD TOTAL',         nombresRaw: ['SALUD TOTAL', 'SALUD TOTAL SA'],                      tipo: 'EPS' },
  { nombre: 'EPS SERVICIO',        nombresRaw: ['EPS SERVICIO', 'ENTIDAD PROMOTORA DE SALUD SERVICIO C', 'ENTIDAD PROMOTORA DE SALUD SERVICIO'], tipo: 'EPS' },
  { nombre: 'UNISALUD',            nombresRaw: ['UNISALUD'],                                            tipo: 'EPS' },
  { nombre: 'ALIANZA EPS',         nombresRaw: ['ALIANZA EPS'],                                        tipo: 'EPS' },
  { nombre: 'MEDISANITAS',         nombresRaw: ['MEDISANITAS', 'MEDISANITAS SA'],                      tipo: 'EPS' },
  { nombre: 'COLSANITAS',          nombresRaw: ['COLSANITAS', 'COLSANITAS SA'],                        tipo: 'EPS' },
  // ── Seguros de vida / Medicina prepagada ─────────────────────────────────────
  { nombre: 'SEGUROS SURAMERICANA', nombresRaw: ['SEGUROS DE VIDA SURAMERICANA', 'SEGUROS SURAMERICANA', 'SURAMERICANA SEGUROS DE VIDA'], tipo: 'OTRO' },
  { nombre: 'COLMEDICA',           nombresRaw: ['COLMEDICA', 'COLMEDICA MEDICINA PREPAGADA SA', 'COLMEDICA MEDICINA PREPAGADA', 'COLMEDICA LINEA ESMERALDA', 'COLMEDICA LINEA RUBI', 'COLMEDICA LINEA ESMERALDA SA'], tipo: 'OTRO' },
  { nombre: 'COOMEVA',             nombresRaw: ['COOMEVA', 'COOMEVA MEDICINA PREPAGADA SA', 'COOMEVA MEDICINA PREPAGADA', 'COOMEVA EPS'], tipo: 'OTRO' },
  { nombre: 'MEDPLUS',             nombresRaw: ['MEDPLUS', 'MEDPLUS MEDICINA PREPAGADA SA', 'MEDPLUS MEDICINA PREPAGADA'], tipo: 'OTRO' },
  { nombre: 'AXA COLPATRIA',       nombresRaw: ['AXA COLPATRIA', 'AXA COLPATRIA MEDICINA PREPAGADA', 'AXA COLPATRIA SEGUROS DE VIDA SA', 'AXA COLPATRIA SEGUROS DE VIDA'], tipo: 'OTRO' },
  { nombre: 'SEGUROS BOLIVAR',     nombresRaw: ['SEGUROS BOLIVAR', 'COMPANIA DE SEGUROS BOLIVAR SA', 'COMPAÑIA DE SEGUROS BOLIVAR SA', 'SEGUROS BOLIVAR SA'], tipo: 'OTRO' },
  // ── Fondos / Convenios especiales ────────────────────────────────────────────
  { nombre: 'FOMAG',               nombresRaw: ['FOMAG', 'FIDUCIARIA LA PREVISORA SA FOMAG', 'FIDUCIARIA LA PREVISORA FOMAG', 'PREVISORA FOMAG'], tipo: 'CONVENIO' },
  { nombre: 'ECOPETROL',           nombresRaw: ['ECOPETROL', 'ECOPETROL SA'],                          tipo: 'CONVENIO' },
  { nombre: 'ALIANZAS VIP',        nombresRaw: ['ALIANZAS VIP'],                                       tipo: 'CONVENIO', esGrupoCaja: true },
  { nombre: 'INSTITUTO RELIGIOSAS SAN JOSE', nombresRaw: ['INSTITUTO DE RELIGIOSAS DE SAN JOSE', 'RELIGIOSAS SAN JOSE', 'INSTITUTO DE RELIGIOSAS DE SAN JOSE DE CLUNY'], tipo: 'CONVENIO' },
  { nombre: 'GLADYS GOMEZ BERMEO', nombresRaw: ['GLADYS GOMEZ BERMEO', 'GLADYS GOMEZ'],                tipo: 'CONVENIO' },
  { nombre: 'DALELA',              nombresRaw: ['DALELA'],                                              tipo: 'CONVENIO', esGrupoCaja: true },
  { nombre: 'CONVENIO EMPRESARIAL', nombresRaw: ['CONVENIO EMPRESARIAL', 'CONVENIO CM PLUS', 'CONVENIO CM'], tipo: 'CONVENIO', esGrupoCaja: true },
  { nombre: 'ALIANZA ESTRATEGICAS', nombresRaw: ['ALIANZA ESTRATEGICAS', 'ALIANZA ESTRATEGICAS EN SERVICIOS NACIONALES', 'ALIANZA ESTRATEGICAS EN SERVICIOS NACI', 'ALIANZA ESTRATEGICA EN SERVICIOS NACIONALES', 'ALIANZA ESTRATÉGICA EN SERVICIOS NACIONALES', 'ALIANZAS ESTRATEGICAS EN SERVICIOS NACIONALES'], tipo: 'CONVENIO', esGrupoCaja: true },
  { nombre: 'LA RIVERA CLUB DE DESCUENTOS', nombresRaw: ['LA RIVERA CLUB DE DESCUENTOS', 'RIVERA CLUB DE DESCUENTOS', 'LA RIVERA'], tipo: 'CONVENIO', esGrupoCaja: true },
  { nombre: 'CLINICA VALLE SALUD SANFERNANDO', nombresRaw: ['CLINICA VALLE SALUD SANFERNANDO SAS', 'CLINICA VALLE SALUD SANFERNANDO', 'CLINICA VALLE SALUD SAN FERNANDO', 'VALLE SALUD SANFERNANDO'], tipo: 'CONVENIO', esGrupoCaja: true },
  // ── IPS / Clínicas ───────────────────────────────────────────────────────────
  { nombre: 'CLINICA DE OCCIDENTE', nombresRaw: ['CLINICA DE OCCIDENTE', 'CLINICA DE OCCIDENTE SA'],  tipo: 'OTRO' },
  { nombre: 'CLINICA VERSALLES',   nombresRaw: ['CLINICA VERSALLES', 'CLINICA VERSALLES SA'],          tipo: 'OTRO' },
  { nombre: 'IPS SANTA CLARA',     nombresRaw: ['IPS SANTA CLARA', 'IPS OCUPACIONAL SANTA CLARA SAS', 'IPS OCUPACIONAL SANTA CLARA'], tipo: 'OTRO' },
  { nombre: 'MEDISALUD',           nombresRaw: ['MEDISALUD', 'CENTRO MEDICO MEDISALUD IPS SAS', 'CENTRO MEDICO MEDISALUD'], tipo: 'OTRO' },
  { nombre: 'IPS SOLUCIONES MEDICAS', nombresRaw: ['IPS SOLUCIONES MEDICAS', 'IPS SOLUCIONES MEDICAS EN SALUD SAS', 'IPS SOLUCIONES MEDICAS EN SALUD'], tipo: 'OTRO' },
  { nombre: 'ORGANIZACION ODONTOLOGICA', nombresRaw: ['ORGANIZACION MEDICO ODONTOLOGICA NACIONAL', 'ORGANIZACION MEDICO ODONTOLOGICA NAL', 'ORGANIZACION MEDICO ODONTOLOGICA'], tipo: 'OTRO' },
  { nombre: 'TARJETA LA MEDICA',   nombresRaw: ['TARJETA LA MEDICA', 'LA MEDICA'],                     tipo: 'OTRO', esGrupoCaja: true },
  { nombre: 'COSERSSA',            nombresRaw: ['COSERSSA'],                                            tipo: 'OTRO', esGrupoCaja: true },
  { nombre: 'TSERVIMOS',           nombresRaw: ['TSERVIMOS'],                                           tipo: 'OTRO' },
  // ── Salud ocupacional / ARL ──────────────────────────────────────────────────
  { nombre: 'UNIDAD SALUD OCUPACIONAL', nombresRaw: ['UNIDAD SALUD OCUPACIONAL', 'UNIDAD DE SALUD OCUPACIONAL SAS', 'UNIDAD DE SALUD OCUPACIONAL', 'UNIDAD DE SALUD OCUPACIONALSAS'], tipo: 'ARL' },
  { nombre: 'UNIDAD MEDICA LER',   nombresRaw: ['UNIDAD MEDICA LER', 'UNIDAD MÉDICA LER'],             tipo: 'OTRO', esGrupoCaja: true },
  { nombre: 'PROTEGEMOS',          nombresRaw: ['PROTEGEMOS'],                                         tipo: 'ARL', esGrupoCaja: true },
  // ── Particulares (unified — matches both PARTICULARES and PARTICULAR in sheets) ─
  { nombre: 'PARTICULARES', nombresRaw: ['PARTICULARES', 'PARTICULARES/CONVENIOS', 'PARTICULAR', 'PART'], tipo: 'PARTICULAR', esGrupoCaja: true },
];

export async function autoSeedEntidades(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const entidad of ENTIDADES) {
    try {
      const [rows] = await pool.query<(RowDataPacket & { id: string })[]>(
        'SELECT id FROM entidades WHERE nombre = ? LIMIT 1',
        [entidad.nombre]
      );
      const nombresJson = JSON.stringify(entidad.nombresRaw);
      const esGrupo = entidad.esGrupoCaja ? 1 : 0;

      if (rows[0]) {
        await pool.execute(
          'UPDATE entidades SET nombres_raw = ?, tipo = ?, es_grupo_caja = ?, activa = 1 WHERE id = ?',
          [nombresJson, entidad.tipo, esGrupo, rows[0].id]
        );
        updated++;
      } else {
        await pool.execute(
          'INSERT INTO entidades (id, nombre, nombres_raw, tipo, es_grupo_caja, activa) VALUES (UUID(), ?, ?, ?, ?, 1)',
          [entidad.nombre, nombresJson, entidad.tipo, esGrupo]
        );
        created++;
      }
    } catch (err) {
      logger.warn('entity-seed: error upserting entidad', {
        nombre: entidad.nombre,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Merge duplicate "PARTICULAR" entity (old entry) into "PARTICULARES"
  try {
    const [[particulares], [particular]] = await Promise.all([
      pool.query<(RowDataPacket & { id: string })[]>('SELECT id FROM entidades WHERE nombre = ? LIMIT 1', ['PARTICULARES']),
      pool.query<(RowDataPacket & { id: string })[]>('SELECT id FROM entidades WHERE nombre = ? LIMIT 1', ['PARTICULAR']),
    ]);
    if (particulares[0] && particular[0]) {
      // Reassign atenciones that pointed to old "PARTICULAR" entity → "PARTICULARES"
      await pool.execute('UPDATE atenciones SET entidad_id = ? WHERE entidad_id = ?', [particulares[0].id, particular[0].id]);
      await pool.execute('DELETE FROM entidades WHERE id = ?', [particular[0].id]);
      logger.info('entity-seed: merged PARTICULAR → PARTICULARES');
    }
  } catch (err) {
    logger.warn('entity-seed: merge PARTICULAR failed (non-fatal)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('Entity catalog synced', { total: ENTIDADES.length, created, updated });
}
