/**
 * Liquidación de honorarios médicos — motor de reglas.
 *
 * Fuente de reglas: Reglas_de_liquidacion_General_1.xlsx (proporcionado por la clínica).
 * Cada profesional tiene tasas fijas (COP por consulta) o porcentuales (% del valor facturado)
 * según la categoría del servicio y si el paciente es de entidad o particular.
 */

import { getLineasHonorarios, getLineasHonorariosRango } from '../repositories/honorarios.repo.js';
import { findAllReglas, findAllReglasEspeciales } from '../repositories/reglas-honorarios.repo.js';

// ─── Categorías de honorarios ─────────────────────────────────────────────────
// Coinciden con las columnas del Informe de Honorarios del Excel de la clínica.

export type HonCat =
  | 'consulta'
  | 'emg_vcn'        // EMG + VCN + Reflejo H + Est. Repetitiva
  | 'infiltracion'   // Infiltración articular + Toxina botulínica
  | 'ecografia'      // Ecografía como guía para procedimiento
  | 'terapia_choque' // Terapia con ondas de choque
  | 'junta'          // Junta médica interdisciplinaria
  | 'eeg'            // EEG ambulatorio + EEG portátil/UCI
  | 'psg_lms'        // Polisomnografía ($80k) + Latencia múltiple ($75k)
  | 'tlm'            // Monitorización EEG / Video-EEG (Telemetría)
  | 'pe'             // Potenciales evocados
  | 'excluido'       // Sin honorario por acuerdo (aguja monopolar, derechos de sala)
  | 'sin_regla';     // Servicio sin regla definida para este profesional

// ─── Mapa servicio → categoría ────────────────────────────────────────────────

const SERVICIO_CAT: Record<string, HonCat> = {
  'CONSULTA PRIMERA VEZ FISIATRA':        'consulta',
  'CONSULTA PRIMERA VEZ NEUROLOGIA':      'consulta',
  'CONSULTA DE CONTROL NEUROLOGIA':       'consulta',
  'CONSULTA DE CONTROL FISIATRIA':        'consulta',
  'CONSULTA DE CONTROL':                  'consulta',
  'CONSULTA PRIMERA VEZ':                 'consulta',
  'ELECTROMIOGRAFIA':                     'emg_vcn',
  'NEUROCONDUCCION':                      'emg_vcn',
  'REFLEJO H':                            'emg_vcn',
  'PRUEBA ESTIMULO REPETITIVO':           'emg_vcn',
  'INFILTRACION':                         'infiltracion',
  'INYECCION TOXINA BOTULINICA':          'infiltracion',
  'ECOGRAFIA':                            'ecografia',
  'TERAPIA ONDAS DE CHOQUE':              'terapia_choque',
  'JUNTA MEDICA INTERDISCIPLINARIA':      'junta',
  'ELECTROENCEFALOGRAMA COMPUTARIZADO':   'eeg',
  'ELECTROENCEFALOGRAMA PORTATIL':        'eeg',
  'MONITORIZACION EEG VIDEO-RADIO':       'tlm',
  'POLISOMNOGRAFIA':                      'psg_lms',
  'PRUEBA DE LATENCIA MULTIPLE':          'psg_lms',
  'POTENCIALES EVOCADOS':                 'pe',
  'AGUJA MONOPOLAR':                      'excluido',  // excluida desde abril 2024
  'DERECHOS DE SALA':                     'excluido',
};

// ─── Reglas de liquidación por profesional ────────────────────────────────────
// tipo:'fijo'  → entidad/particular en COP por unidad o sesión
// tipo:'pct'   → entidad/particular como fracción del valor_bruto (0.0 – 1.0)

interface Tasa {
  tipo: 'fijo' | 'pct';
  entidad: number;
  particular: number;
}

// Reglas especiales para servicios con diferentes montos fijos dentro de la misma categoría
// psg_lms: PSG=$80.000, LMS=$75.000 → necesitamos diferenciar por servicio_nombre
const PSG_FIJO = 80_000;
const LMS_FIJO = 75_000;

// ─── Reglas desde BD (cargadas dinámicamente) ────────────────────────────────

async function cargarReglas(): Promise<{
  reglas: Record<string, Partial<Record<HonCat, Tasa>>>;
  especiales: { consulta_reducida: { profs: Set<string>; entidades: Set<string>; valor: number };
                 override_global: Array<{ prof: string; entidad: string; pct: number }>;
                 psg_fijo: number; lms_fijo: number };
}> {
  try {
    const dbReglas    = await findAllReglas();
    const dbEspeciales = await findAllReglasEspeciales();

    if (dbReglas.length > 0) {
      const reglas: Record<string, Partial<Record<HonCat, Tasa>>> = {};
      for (const r of dbReglas) {
        if (!reglas[r.profesional_nombre]) reglas[r.profesional_nombre] = {};
        reglas[r.profesional_nombre][r.categoria as HonCat] = {
          tipo: r.tipo,
          entidad: r.valor_entidad,
          particular: r.valor_particular,
        };
      }

      const consulta_reducida = { profs: new Set<string>(), entidades: new Set<string>(), valor: 36_000 };
      const override_global: Array<{ prof: string; entidad: string; pct: number }> = [];
      let psg_fijo = PSG_FIJO;
      let lms_fijo = LMS_FIJO;

      for (const e of dbEspeciales) {
        if (e.tipo_regla === 'consulta_reducida') {
          consulta_reducida.profs.add(e.profesional_nombre);
          consulta_reducida.valor = e.valor;
          (e.condicion ?? '').split(',').map((s) => s.trim()).filter(Boolean)
            .forEach((ent) => consulta_reducida.entidades.add(ent));
        } else if (e.tipo_regla === 'override_global_pct') {
          override_global.push({ prof: e.profesional_nombre, entidad: e.condicion ?? '', pct: e.valor });
        } else if (e.tipo_regla === 'psg_diferenciado') {
          psg_fijo = e.valor;
        } else if (e.tipo_regla === 'lms_diferenciado') {
          lms_fijo = e.valor;
        }
      }

      return { reglas, especiales: { consulta_reducida, override_global, psg_fijo, lms_fijo } };
    }
  } catch {
    // fallback to hardcoded if DB unavailable
  }

  // ── Fallback: reglas hardcoded ─────────────────────────────────────────────
  return {
    reglas: REGLAS_HARDCODED,
    especiales: {
      consulta_reducida: { profs: PROFESIONALES_CONSULTA_REDUCIDA, entidades: ENTIDADES_CONSULTA_REDUCIDA, valor: 36_000 },
      override_global: [{ prof: 'LAVERDE', entidad: 'DALELA', pct: 0.80 }],
      psg_fijo: PSG_FIJO,
      lms_fijo: LMS_FIJO,
    },
  };
}

const REGLAS_HARDCODED: Record<string, Partial<Record<HonCat, Tasa>>> = {
  PERLAZA: {
    consulta:    { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
    infiltracion:{ tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
    junta:       { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
  },
  LAVERDE: {
    consulta:      { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
    emg_vcn:       { tipo: 'pct',  entidad: 0.47,   particular: 0.47 },
    infiltracion:  { tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
    ecografia:     { tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
    terapia_choque:{ tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
    junta:         { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
    // eeg: no aplica para LAVERDE
    // aguja: excluida (se captura en SERVICIO_CAT → 'excluido')
  },
  ESCOBAR: {
    consulta:    { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
    emg_vcn:     { tipo: 'pct',  entidad: 0.47,   particular: 0.47 },
    infiltracion:{ tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
    junta:       { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
  },
  TERAN: {
    consulta:    { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
    emg_vcn:     { tipo: 'pct',  entidad: 0.47,   particular: 0.47 },
    infiltracion:{ tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
    junta:       { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
  },
  MONTAÑO: {
    consulta:    { tipo: 'fijo', entidad: 54_000, particular: 130_000 },
    infiltracion:{ tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  },
  PARADA: {
    consulta:    { tipo: 'fijo', entidad: 54_000, particular: 130_000 },
    infiltracion:{ tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
  },
  YOLIMA: {
    pe: { tipo: 'pct', entidad: 0.25, particular: 0.25 },
  },
  CRUZ: {
    consulta:    { tipo: 'fijo', entidad: 65_000, particular: 133_000 },
    eeg:         { tipo: 'pct',  entidad: 0.30,   particular: 0.30 },
    tlm:         { tipo: 'pct',  entidad: 0.15,   particular: 0.15 },
  },
  CONCHA: {
    consulta:    { tipo: 'fijo', entidad: 54_000, particular: 130_000 },
    infiltracion:{ tipo: 'pct',  entidad: 0.70,   particular: 0.70 },
    eeg:         { tipo: 'pct',  entidad: 0.30,   particular: 0.30 },
    tlm:         { tipo: 'pct',  entidad: 0.15,   particular: 0.15 },
    psg_lms:     { tipo: 'fijo', entidad: PSG_FIJO, particular: PSG_FIJO }, // default PSG; LMS overridden below
  },
};

// Fallback hardcoded — se usa cuando la BD no tiene reglas cargadas aún
const ENTIDADES_CONSULTA_REDUCIDA = new Set(['NUEVA EPS', 'VIVA 1A']);
const PROFESIONALES_CONSULTA_REDUCIDA = new Set(['PERLAZA', 'LAVERDE', 'ESCOBAR', 'TERAN']);

// ─── Tipos de resultado ───────────────────────────────────────────────────────

export interface HonorariosCeldas {
  monto: number;
  cnt: number;
}

export interface HonorariosProfesionalRow {
  profesional_id: string;
  nombre: string;
  es_nomina: boolean;
  consulta:       HonorariosCeldas;
  emg_vcn:        HonorariosCeldas;
  infiltracion:   HonorariosCeldas;
  ecografia:      HonorariosCeldas;
  terapia_choque: HonorariosCeldas;
  junta:          HonorariosCeldas;
  eeg:            HonorariosCeldas;
  psg_lms:        HonorariosCeldas;
  tlm:            HonorariosCeldas;
  pe:             HonorariosCeldas;
  total: number;
  sin_regla: HonorariosCeldas;  // valor facturado sin regla aplicable (diagnóstico)
}

export interface HonorariosResult {
  year: number;
  month: number;
  rows: HonorariosProfesionalRow[];
  totales: Omit<HonorariosProfesionalRow, 'profesional_id' | 'nombre'>;
}

// ─── Motor de cálculo ─────────────────────────────────────────────────────────

function nuevaCelda(): HonorariosCeldas { return { monto: 0, cnt: 0 }; }

function nuevaFila(profesional_id: string, nombre: string, esNomina = false): HonorariosProfesionalRow {
  return {
    profesional_id, nombre, es_nomina: esNomina,
    consulta:       nuevaCelda(),
    emg_vcn:        nuevaCelda(),
    infiltracion:   nuevaCelda(),
    ecografia:      nuevaCelda(),
    terapia_choque: nuevaCelda(),
    junta:          nuevaCelda(),
    eeg:            nuevaCelda(),
    psg_lms:        nuevaCelda(),
    tlm:            nuevaCelda(),
    pe:             nuevaCelda(),
    total:          0,
    sin_regla:      nuevaCelda(),
  };
}

function acumular(
  fila: HonorariosProfesionalRow,
  cat: HonCat,
  monto: number,
  cnt: number,
): void {
  if (cat === 'excluido' || cat === 'sin_regla') {
    if (cat === 'sin_regla') {
      fila.sin_regla.monto += monto;
      fila.sin_regla.cnt   += cnt;
    }
    return;
  }
  const celda = fila[cat] as HonorariosCeldas;
  celda.monto += monto;
  celda.cnt   += cnt;
  fila.total  += monto;
}

export async function calcularHonorarios(
  mesIdx: number,
  anio: number,
): Promise<HonorariosResult> {
  const [lineas, { reglas: REGLAS, especiales }] = await Promise.all([
    getLineasHonorarios(mesIdx, anio),
    cargarReglas(),
  ]);

  const mapaFilas = new Map<string, HonorariosProfesionalRow>();

  for (const l of lineas) {
    let fila = mapaFilas.get(l.profesional_id);
    if (!fila) {
      fila = nuevaFila(l.profesional_id, l.profesional_display, l.es_nomina);
      mapaFilas.set(l.profesional_id, fila);
    }

    const cat: HonCat = l.servicio_nombre ? (SERVICIO_CAT[l.servicio_nombre] ?? 'sin_regla') : 'sin_regla';

    if (cat === 'excluido') continue;

    if (cat === 'sin_regla') {
      acumular(fila, 'sin_regla', l.total_valor, l.cnt);
      continue;
    }

    const isParticular = l.entidad_tipo === 'PARTICULAR';
    const isSesion     = l.servicio_tipo_conteo === 'sesion';

    // ── Override global (ej. LAVERDE + DALELA → 80%) ──
    const override = especiales.override_global.find(
      (o) => o.prof === l.profesional_nombre && l.entidad_nombre === o.entidad
    );
    if (override) {
      acumular(fila, cat, l.total_valor * override.pct, isSesion ? l.cnt_sesiones : l.cnt);
      continue;
    }

    const regla = REGLAS[l.profesional_nombre]?.[cat];
    if (!regla) {
      acumular(fila, 'sin_regla', l.total_valor, l.cnt);
      continue;
    }

    let monto = 0;
    const cnt = isSesion ? l.cnt_sesiones : l.cnt;

    if (regla.tipo === 'fijo') {
      let valorFijo: number;
      if (cat === 'psg_lms') {
        valorFijo = l.servicio_nombre === 'PRUEBA DE LATENCIA MULTIPLE'
          ? especiales.lms_fijo : especiales.psg_fijo;
      } else if (
        cat === 'consulta' && !isParticular &&
        especiales.consulta_reducida.profs.has(l.profesional_nombre) &&
        l.entidad_nombre !== null &&
        especiales.consulta_reducida.entidades.has(l.entidad_nombre)
      ) {
        valorFijo = especiales.consulta_reducida.valor;
      } else {
        valorFijo = isParticular ? regla.particular : regla.entidad;
      }
      monto = cnt * valorFijo;
    } else {
      monto = l.total_valor * (isParticular ? regla.particular : regla.entidad);
    }

    acumular(fila, cat, monto, cnt);
  }

  // ── Construir array ordenado por total desc ──
  const rows = [...mapaFilas.values()].sort((a, b) => b.total - a.total);

  // ── Totales ──
  const totales = nuevaFila('__totales__', 'TOTAL');
  for (const r of rows) {
    type RowCat = 'consulta' | 'emg_vcn' | 'infiltracion' | 'ecografia' | 'terapia_choque' | 'junta' | 'eeg' | 'psg_lms' | 'tlm' | 'pe';
    const cats: RowCat[] = ['consulta','emg_vcn','infiltracion','ecografia','terapia_choque','junta','eeg','psg_lms','tlm','pe'];
    for (const c of cats) {
      const src = r[c] as HonorariosCeldas;
      const dst = totales[c] as HonorariosCeldas;
      dst.monto += src.monto;
      dst.cnt   += src.cnt;
    }
    totales.total          += r.total;
    totales.sin_regla.monto += r.sin_regla.monto;
    totales.sin_regla.cnt  += r.sin_regla.cnt;
  }

  const { profesional_id: _pid, nombre: _n, ...totalesSinId } = totales;
  void _pid; void _n;

  return { year: anio, month: mesIdx, rows, totales: totalesSinId };
}

// ─── Motor compartido (acepta líneas ya cargadas) ─────────────────────────────

function aplicarReglasSync(
  lineas: import('../repositories/honorarios.repo.js').HonorariosLineaDB[],
  REGLAS: Record<string, Partial<Record<HonCat, Tasa>>>,
  especiales: Awaited<ReturnType<typeof cargarReglas>>['especiales'],
): Map<string, HonorariosProfesionalRow> {
  const mapaFilas = new Map<string, HonorariosProfesionalRow>();

  for (const l of lineas) {
    let fila = mapaFilas.get(l.profesional_id);
    if (!fila) {
      fila = nuevaFila(l.profesional_id, l.profesional_display, l.es_nomina);
      mapaFilas.set(l.profesional_id, fila);
    }

    const cat: HonCat = l.servicio_nombre ? (SERVICIO_CAT[l.servicio_nombre] ?? 'sin_regla') : 'sin_regla';
    if (cat === 'excluido') continue;
    if (cat === 'sin_regla') { acumular(fila, 'sin_regla', l.total_valor, l.cnt); continue; }

    const isParticular = l.entidad_tipo === 'PARTICULAR';
    const isSesion     = l.servicio_tipo_conteo === 'sesion';

    const override = especiales.override_global.find(
      (o) => o.prof === l.profesional_nombre && l.entidad_nombre === o.entidad
    );
    if (override) {
      acumular(fila, cat, l.total_valor * override.pct, isSesion ? l.cnt_sesiones : l.cnt);
      continue;
    }

    const regla = REGLAS[l.profesional_nombre]?.[cat];
    if (!regla) { acumular(fila, 'sin_regla', l.total_valor, l.cnt); continue; }

    let monto = 0;
    const cnt = isSesion ? l.cnt_sesiones : l.cnt;

    if (regla.tipo === 'fijo') {
      let valorFijo: number;
      if (cat === 'psg_lms') {
        valorFijo = l.servicio_nombre === 'PRUEBA DE LATENCIA MULTIPLE'
          ? especiales.lms_fijo : especiales.psg_fijo;
      } else if (
        cat === 'consulta' && !isParticular &&
        especiales.consulta_reducida.profs.has(l.profesional_nombre) &&
        l.entidad_nombre !== null && especiales.consulta_reducida.entidades.has(l.entidad_nombre)
      ) {
        valorFijo = especiales.consulta_reducida.valor;
      } else {
        valorFijo = isParticular ? regla.particular : regla.entidad;
      }
      monto = cnt * valorFijo;
    } else {
      monto = l.total_valor * (isParticular ? regla.particular : regla.entidad);
    }
    acumular(fila, cat, monto, cnt);
  }

  return mapaFilas;
}

export async function calcularHonorariosRango(
  fechaDesde: string,
  fechaHasta: string,
): Promise<HonorariosResult> {
  const [lineas, { reglas: REGLAS, especiales }] = await Promise.all([
    getLineasHonorariosRango(fechaDesde, fechaHasta),
    cargarReglas(),
  ]);
  const mapaFilas = aplicarReglasSync(lineas, REGLAS, especiales);

  const rows = [...mapaFilas.values()].sort((a, b) => b.total - a.total);

  const totales = nuevaFila('__totales__', 'TOTAL');
  for (const r of rows) {
    type RowCat = 'consulta' | 'emg_vcn' | 'infiltracion' | 'ecografia' | 'terapia_choque' | 'junta' | 'eeg' | 'psg_lms' | 'tlm' | 'pe';
    const cats: RowCat[] = ['consulta','emg_vcn','infiltracion','ecografia','terapia_choque','junta','eeg','psg_lms','tlm','pe'];
    for (const c of cats) {
      (totales[c] as HonorariosCeldas).monto += (r[c] as HonorariosCeldas).monto;
      (totales[c] as HonorariosCeldas).cnt   += (r[c] as HonorariosCeldas).cnt;
    }
    totales.total           += r.total;
    totales.sin_regla.monto += r.sin_regla.monto;
    totales.sin_regla.cnt   += r.sin_regla.cnt;
  }

  const { profesional_id: _pid, nombre: _n, ...totalesSinId } = totales;
  void _pid; void _n;

  const [y, m] = fechaDesde.split('-').map(Number);
  return { year: y, month: m, rows, totales: totalesSinId };
}
