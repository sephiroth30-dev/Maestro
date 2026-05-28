"use strict";
/**
 * Liquidación de honorarios médicos — motor de reglas.
 *
 * Fuente de reglas: Reglas_de_liquidacion_General_1.xlsx (proporcionado por la clínica).
 * Cada profesional tiene tasas fijas (COP por consulta) o porcentuales (% del valor facturado)
 * según la categoría del servicio y si el paciente es de entidad o particular.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calcularHonorarios = calcularHonorarios;
const honorarios_repo_js_1 = require("../repositories/honorarios.repo.js");
// ─── Mapa servicio → categoría ────────────────────────────────────────────────
const SERVICIO_CAT = {
    'CONSULTA PRIMERA VEZ FISIATRA': 'consulta',
    'CONSULTA PRIMERA VEZ NEUROLOGIA': 'consulta',
    'CONSULTA DE CONTROL NEUROLOGIA': 'consulta',
    'CONSULTA DE CONTROL FISIATRIA': 'consulta',
    'CONSULTA DE CONTROL': 'consulta',
    'CONSULTA PRIMERA VEZ': 'consulta',
    'ELECTROMIOGRAFIA': 'emg_vcn',
    'NEUROCONDUCCION': 'emg_vcn',
    'REFLEJO H': 'emg_vcn',
    'PRUEBA ESTIMULO REPETITIVO': 'emg_vcn',
    'INFILTRACION': 'infiltracion',
    'INYECCION TOXINA BOTULINICA': 'infiltracion',
    'ECOGRAFIA': 'ecografia',
    'TERAPIA ONDAS DE CHOQUE': 'terapia_choque',
    'JUNTA MEDICA INTERDISCIPLINARIA': 'junta',
    'ELECTROENCEFALOGRAMA COMPUTARIZADO': 'eeg',
    'ELECTROENCEFALOGRAMA PORTATIL': 'eeg',
    'MONITORIZACION EEG VIDEO-RADIO': 'tlm',
    'POLISOMNOGRAFIA': 'psg_lms',
    'PRUEBA DE LATENCIA MULTIPLE': 'psg_lms',
    'POTENCIALES EVOCADOS': 'pe',
    'AGUJA MONOPOLAR': 'excluido', // excluida desde abril 2024
    'DERECHOS DE SALA': 'excluido',
};
// Reglas especiales para servicios con diferentes montos fijos dentro de la misma categoría
// psg_lms: PSG=$80.000, LMS=$75.000 → necesitamos diferenciar por servicio_nombre
const PSG_FIJO = 80_000;
const LMS_FIJO = 75_000;
const REGLAS = {
    PERLAZA: {
        consulta: { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
        infiltracion: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
        junta: { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
    },
    LAVERDE: {
        consulta: { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
        emg_vcn: { tipo: 'pct', entidad: 0.47, particular: 0.47 },
        infiltracion: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
        ecografia: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
        terapia_choque: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
        junta: { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
        // eeg: no aplica para LAVERDE
        // aguja: excluida (se captura en SERVICIO_CAT → 'excluido')
    },
    ESCOBAR: {
        consulta: { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
        emg_vcn: { tipo: 'pct', entidad: 0.47, particular: 0.47 },
        infiltracion: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
        junta: { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
    },
    TERAN: {
        consulta: { tipo: 'fijo', entidad: 38_000, particular: 106_000 },
        emg_vcn: { tipo: 'pct', entidad: 0.47, particular: 0.47 },
        infiltracion: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
        junta: { tipo: 'fijo', entidad: 60_000, particular: 60_000 },
    },
    MONTAÑO: {
        consulta: { tipo: 'fijo', entidad: 54_000, particular: 130_000 },
        infiltracion: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
    },
    PARADA: {
        consulta: { tipo: 'fijo', entidad: 54_000, particular: 130_000 },
        infiltracion: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
    },
    YOLIMA: {
        pe: { tipo: 'pct', entidad: 0.25, particular: 0.25 },
    },
    CRUZ: {
        consulta: { tipo: 'fijo', entidad: 65_000, particular: 133_000 },
        eeg: { tipo: 'pct', entidad: 0.30, particular: 0.30 },
        tlm: { tipo: 'pct', entidad: 0.15, particular: 0.15 },
    },
    CONCHA: {
        consulta: { tipo: 'fijo', entidad: 54_000, particular: 130_000 },
        infiltracion: { tipo: 'pct', entidad: 0.70, particular: 0.70 },
        eeg: { tipo: 'pct', entidad: 0.30, particular: 0.30 },
        tlm: { tipo: 'pct', entidad: 0.15, particular: 0.15 },
        psg_lms: { tipo: 'fijo', entidad: PSG_FIJO, particular: PSG_FIJO }, // default PSG; LMS overridden below
    },
};
// Entidades con tarifa de consulta reducida ($36.000 en lugar de $38.000)
// Aplica a PERLAZA, LAVERDE, ESCOBAR, TERAN (acuerdo contractual Nueva EPS / Viva 1A)
const ENTIDADES_CONSULTA_REDUCIDA = new Set(['NUEVA EPS', 'VIVA 1A']);
const PROFESIONALES_CONSULTA_REDUCIDA = new Set(['PERLAZA', 'LAVERDE', 'ESCOBAR', 'TERAN']);
// ─── Motor de cálculo ─────────────────────────────────────────────────────────
function nuevaCelda() { return { monto: 0, cnt: 0 }; }
function nuevaFila(profesional_id, nombre) {
    return {
        profesional_id, nombre,
        consulta: nuevaCelda(),
        emg_vcn: nuevaCelda(),
        infiltracion: nuevaCelda(),
        ecografia: nuevaCelda(),
        terapia_choque: nuevaCelda(),
        junta: nuevaCelda(),
        eeg: nuevaCelda(),
        psg_lms: nuevaCelda(),
        tlm: nuevaCelda(),
        pe: nuevaCelda(),
        total: 0,
        sin_regla: nuevaCelda(),
    };
}
function acumular(fila, cat, monto, cnt) {
    if (cat === 'excluido' || cat === 'sin_regla') {
        if (cat === 'sin_regla') {
            fila.sin_regla.monto += monto;
            fila.sin_regla.cnt += cnt;
        }
        return;
    }
    const celda = fila[cat];
    celda.monto += monto;
    celda.cnt += cnt;
    fila.total += monto;
}
async function calcularHonorarios(mesIdx, anio) {
    const lineas = await (0, honorarios_repo_js_1.getLineasHonorarios)(mesIdx, anio);
    const mapaFilas = new Map();
    for (const l of lineas) {
        // Obtener o crear la fila del profesional
        let fila = mapaFilas.get(l.profesional_id);
        if (!fila) {
            fila = nuevaFila(l.profesional_id, l.profesional_display);
            mapaFilas.set(l.profesional_id, fila);
        }
        const cat = l.servicio_nombre ? (SERVICIO_CAT[l.servicio_nombre] ?? 'sin_regla') : 'sin_regla';
        // ── Servicios excluidos (aguja monopolar, derechos de sala) ──
        if (cat === 'excluido')
            continue;
        // ── Sin categoría → diagnóstico ──
        if (cat === 'sin_regla') {
            acumular(fila, 'sin_regla', l.total_valor, l.cnt);
            continue;
        }
        const isParticular = l.entidad_tipo === 'PARTICULAR';
        const isSesion = l.servicio_tipo_conteo === 'sesion';
        // ── Override DALELA para LAVERDE (80% en todo) ──
        if (l.profesional_nombre === 'LAVERDE' && l.entidad_nombre === 'DALELA') {
            const monto = l.total_valor * 0.80;
            const cnt = isSesion ? l.cnt_sesiones : l.cnt;
            acumular(fila, cat, monto, cnt);
            continue;
        }
        // ── Lookup de la regla estándar ──
        const regla = REGLAS[l.profesional_nombre]?.[cat];
        if (!regla) {
            acumular(fila, 'sin_regla', l.total_valor, l.cnt);
            continue;
        }
        let monto = 0;
        let cnt = isSesion ? l.cnt_sesiones : l.cnt;
        if (regla.tipo === 'fijo') {
            // PSG vs LMS tienen montos fijos distintos dentro de la misma categoría psg_lms
            let valorFijo;
            if (cat === 'psg_lms') {
                valorFijo = l.servicio_nombre === 'PRUEBA DE LATENCIA MULTIPLE' ? LMS_FIJO : PSG_FIJO;
            }
            else if (cat === 'consulta' &&
                !isParticular &&
                PROFESIONALES_CONSULTA_REDUCIDA.has(l.profesional_nombre) &&
                l.entidad_nombre !== null &&
                ENTIDADES_CONSULTA_REDUCIDA.has(l.entidad_nombre)) {
                // Tarifa reducida Nueva EPS / Viva 1A
                valorFijo = 36_000;
            }
            else {
                valorFijo = isParticular ? regla.particular : regla.entidad;
            }
            monto = cnt * valorFijo;
        }
        else {
            // tipo === 'pct'
            const pct = isParticular ? regla.particular : regla.entidad;
            monto = l.total_valor * pct;
            // Para servicios porcentuales en modo sesión, cnt_display = sesiones
            // (ya calculado arriba con isSesion)
        }
        acumular(fila, cat, monto, cnt);
    }
    // ── Construir array ordenado por total desc ──
    const rows = [...mapaFilas.values()].sort((a, b) => b.total - a.total);
    // ── Totales ──
    const totales = nuevaFila('__totales__', 'TOTAL');
    for (const r of rows) {
        const cats = ['consulta', 'emg_vcn', 'infiltracion', 'ecografia', 'terapia_choque', 'junta', 'eeg', 'psg_lms', 'tlm', 'pe'];
        for (const c of cats) {
            const src = r[c];
            const dst = totales[c];
            dst.monto += src.monto;
            dst.cnt += src.cnt;
        }
        totales.total += r.total;
        totales.sin_regla.monto += r.sin_regla.monto;
        totales.sin_regla.cnt += r.sin_regla.cnt;
    }
    const { profesional_id: _pid, nombre: _n, ...totalesSinId } = totales;
    void _pid;
    void _n;
    return { year: anio, month: mesIdx, rows, totales: totalesSinId };
}
//# sourceMappingURL=honorarios.service.js.map