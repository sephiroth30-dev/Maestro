import { logger } from '../config/logger.js';
import {
  countReglas, countReglasEspeciales,
  upsertRegla, insertReglaEspecial,
} from '../repositories/reglas-honorarios.repo.js';

// Reglas actuales del archivo Reglas_de_liquidacion_General_1.xlsx
// tipo:'fijo' → valor en COP por unidad/sesión
// tipo:'pct'  → fracción del valor_bruto (0.0 – 1.0)

const REGLAS_SEED: Array<{
  prof: string;
  cat: string;
  tipo: 'fijo' | 'pct';
  entidad: number;
  particular: number;
  notas?: string;
}> = [
  // PERLAZA
  { prof: 'PERLAZA', cat: 'consulta',    tipo: 'fijo', entidad: 38_000,  particular: 106_000 },
  { prof: 'PERLAZA', cat: 'infiltracion',tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  { prof: 'PERLAZA', cat: 'junta',       tipo: 'fijo', entidad: 60_000,  particular: 60_000 },
  // LAVERDE
  { prof: 'LAVERDE', cat: 'consulta',      tipo: 'fijo', entidad: 38_000,  particular: 106_000 },
  { prof: 'LAVERDE', cat: 'emg_vcn',       tipo: 'pct',  entidad: 0.47,   particular: 0.47 },
  { prof: 'LAVERDE', cat: 'infiltracion',  tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  { prof: 'LAVERDE', cat: 'ecografia',     tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  { prof: 'LAVERDE', cat: 'terapia_choque',tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  { prof: 'LAVERDE', cat: 'junta',         tipo: 'fijo', entidad: 60_000,  particular: 60_000 },
  // ESCOBAR
  { prof: 'ESCOBAR', cat: 'consulta',    tipo: 'fijo', entidad: 38_000,  particular: 106_000 },
  { prof: 'ESCOBAR', cat: 'emg_vcn',     tipo: 'pct',  entidad: 0.47,   particular: 0.47 },
  { prof: 'ESCOBAR', cat: 'infiltracion',tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  { prof: 'ESCOBAR', cat: 'junta',       tipo: 'fijo', entidad: 60_000,  particular: 60_000 },
  // TERAN
  { prof: 'TERAN', cat: 'consulta',    tipo: 'fijo', entidad: 38_000,  particular: 106_000 },
  { prof: 'TERAN', cat: 'emg_vcn',     tipo: 'pct',  entidad: 0.47,   particular: 0.47 },
  { prof: 'TERAN', cat: 'infiltracion',tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  { prof: 'TERAN', cat: 'junta',       tipo: 'fijo', entidad: 60_000,  particular: 60_000 },
  // MONTAÑO
  { prof: 'MONTAÑO', cat: 'consulta',    tipo: 'fijo', entidad: 54_000,  particular: 130_000 },
  { prof: 'MONTAÑO', cat: 'infiltracion',tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  // PARADA
  { prof: 'PARADA', cat: 'consulta',    tipo: 'fijo', entidad: 54_000,  particular: 130_000 },
  { prof: 'PARADA', cat: 'infiltracion',tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  // YOLIMA
  { prof: 'YOLIMA', cat: 'pe', tipo: 'pct', entidad: 0.25, particular: 0.25 },
  // CRUZ
  { prof: 'CRUZ', cat: 'consulta', tipo: 'fijo', entidad: 65_000,  particular: 133_000 },
  { prof: 'CRUZ', cat: 'eeg',      tipo: 'pct',  entidad: 0.30,   particular: 0.30 },
  { prof: 'CRUZ', cat: 'tlm',      tipo: 'pct',  entidad: 0.15,   particular: 0.15 },
  // CONCHA
  { prof: 'CONCHA', cat: 'consulta',    tipo: 'fijo', entidad: 54_000,  particular: 130_000 },
  { prof: 'CONCHA', cat: 'infiltracion',tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  { prof: 'CONCHA', cat: 'eeg',         tipo: 'pct',  entidad: 0.30,   particular: 0.30 },
  { prof: 'CONCHA', cat: 'tlm',         tipo: 'pct',  entidad: 0.15,   particular: 0.15 },
  { prof: 'CONCHA', cat: 'psg_lms',     tipo: 'fijo', entidad: 80_000,  particular: 80_000,
    notas: 'PSG=$80.000 / LMS=$75.000 (diferenciado por nombre de servicio)' },
];

const ESPECIALES_SEED: Array<{
  tipo_regla: string;
  prof: string;
  condicion: string | null;
  valor: number;
  descripcion: string;
}> = [
  // Tarifa reducida consulta NUEVA EPS / VIVA 1A
  { tipo_regla: 'consulta_reducida', prof: 'PERLAZA', condicion: 'NUEVA EPS,VIVA 1A', valor: 36_000, descripcion: 'Consulta $36.000 para NUEVA EPS y VIVA 1A' },
  { tipo_regla: 'consulta_reducida', prof: 'LAVERDE', condicion: 'NUEVA EPS,VIVA 1A', valor: 36_000, descripcion: 'Consulta $36.000 para NUEVA EPS y VIVA 1A' },
  { tipo_regla: 'consulta_reducida', prof: 'ESCOBAR', condicion: 'NUEVA EPS,VIVA 1A', valor: 36_000, descripcion: 'Consulta $36.000 para NUEVA EPS y VIVA 1A' },
  { tipo_regla: 'consulta_reducida', prof: 'TERAN',   condicion: 'NUEVA EPS,VIVA 1A', valor: 36_000, descripcion: 'Consulta $36.000 para NUEVA EPS y VIVA 1A' },
  // Override global LAVERDE + DALELA (80% del facturado)
  { tipo_regla: 'override_global_pct', prof: 'LAVERDE', condicion: 'DALELA', valor: 0.80, descripcion: 'DALELA: 80% del valor facturado en todos los servicios' },
  // PSG vs LMS diferenciado (CONCHA)
  { tipo_regla: 'psg_diferenciado', prof: 'CONCHA', condicion: 'POLISOMNOGRAFIA',       valor: 80_000, descripcion: 'PSG: $80.000 fijo por sesión' },
  { tipo_regla: 'lms_diferenciado', prof: 'CONCHA', condicion: 'PRUEBA DE LATENCIA MULTIPLE', valor: 75_000, descripcion: 'LMS: $75.000 fijo por sesión' },
];

export async function autoSeedReglasHonorarios(): Promise<void> {
  const existingReglas    = await countReglas();
  const existingEspeciales = await countReglasEspeciales();

  if (existingReglas >= REGLAS_SEED.length && existingEspeciales >= ESPECIALES_SEED.length) {
    logger.info('Reglas honorarios seed: ya está completo, omitiendo');
    return;
  }

  if (existingReglas < REGLAS_SEED.length) {
    for (const r of REGLAS_SEED) {
      await upsertRegla(r.prof, r.cat, r.tipo, r.entidad, r.particular, r.notas ?? null);
    }
    logger.info(`Reglas honorarios seed: ${REGLAS_SEED.length} reglas insertadas/actualizadas`);
  }

  if (existingEspeciales < ESPECIALES_SEED.length) {
    for (const e of ESPECIALES_SEED) {
      await insertReglaEspecial(e.tipo_regla, e.prof, e.condicion, e.valor, e.descripcion);
    }
    logger.info(`Reglas especiales seed: ${ESPECIALES_SEED.length} reglas especiales insertadas`);
  }
}
