"use strict";
/**
 * Catálogo único de los grupos de capacidad instalada.
 *
 * Antes esto vivía duplicado como SQL crudo dentro de `capacidad.repo.ts`: la
 * lista de grupos y el `CASE` que clasifica cada servicio aparecían dos veces,
 * una por consulta. Cualquier ajuste a las reglas había que hacerlo en los dos
 * sitios y era cuestión de tiempo que se separaran.
 *
 * ## La base de conteo
 *
 * Un mismo mes admite dos cifras de demanda legítimas y muy distintas:
 *
 * - **pacientes** — visitas únicas (paciente + fecha). Un paciente al que se le
 *   hacen EMG y VCN en la misma cita ocupa *un* hueco de agenda.
 * - **estudios** — registros facturados. Ese mismo paciente generó *dos*.
 *
 * Cuál de las dos gobierna la ocupación depende de dónde esté el cuello de
 * botella de cada grupo, y eso lo dice su fórmula de recursos:
 *
 * - EMG / VCN: «3 salas × 3 pct/h × 8h × 5d × 4ss» → el límite son *pacientes*
 *   por hora de sala, así que la base es `pacientes`.
 * - Potenciales Evocados: el límite real es el estudio, no la cita. Una sola
 *   visita suele cubrir las modalidades visual, auditiva y somatosensorial, y
 *   cada una consume equipo y lectura por separado — de ahí que la operación
 *   reporte ~2,7 estudios por paciente. La base es `estudios`.
 *
 * `base` es solo el valor por omisión: `capacidad_instalada.base_conteo` lo
 * sobreescribe por grupo y mes sin necesidad de un despliegue.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_POR_GRUPO = exports.GRUPOS_ORDENADOS = exports.GRUPOS_CAPACIDAD = void 0;
exports.sqlCatalogoGrupos = sqlCatalogoGrupos;
exports.sqlClasificacionGrupo = sqlClasificacionGrupo;
exports.sqlOrdenGrupos = sqlOrdenGrupos;
exports.grupoDeNombre = grupoDeNombre;
/** En orden de presentación. */
exports.GRUPOS_CAPACIDAD = [
    {
        grupo: 'emg_vcn',
        nombre: 'EMG / VCN',
        base: 'pacientes',
        patrones: [
            'ELECTROMIOGRAFIA%',
            'NEUROCONDUCCION%',
            'REFLEJO H%',
            'PRUEBA ESTIMULO REPETITIVO%',
            'ONDA F%',
        ],
    },
    {
        grupo: 'eeg',
        nombre: 'Electroencefalograma',
        base: 'pacientes',
        patrones: ['ELECTROENCEFALOGRAMA%'],
    },
    {
        grupo: 'tlm',
        nombre: 'Videotelemetría (TLM)',
        base: 'pacientes',
        patrones: ['MONITORIZACION%', '%TELEMETRI%'],
    },
    {
        grupo: 'psg_lms',
        nombre: 'Polisomnografía / LMS',
        base: 'pacientes',
        patrones: ['POLISOMNOGRAFI%', 'PRUEBA%LATENCIA%', 'ESTUDIO%SUE%'],
    },
    {
        // La única con base en estudios: ver la nota de cabecera.
        grupo: 'pe',
        nombre: 'Potenciales Evocados',
        base: 'estudios',
        patrones: ['POTENCIALES EVOCADOS%', 'POTENCIAL EVOCADO%'],
    },
    {
        grupo: 'consulta_fisiatria',
        nombre: 'Consulta Medicina Física',
        base: 'pacientes',
        patrones: ['CONSULTA%FISIATRA%', 'CONSULTA%MEDICINA FISICA%', 'CONSULTA%REHABILITACION%'],
    },
    {
        grupo: 'consulta_neurologia',
        nombre: 'Consulta Neurología',
        base: 'pacientes',
        patrones: ['CONSULTA%NEUROLOG%'],
        prioridad: 60,
    },
    {
        grupo: 'consulta_neurologia_pediatrica',
        nombre: 'Consulta Neurología Pediátrica',
        base: 'pacientes',
        patrones: ['CONSULTA%NEUROLOG%PEDIATRI%', 'CONSULTA%PEDIATRI%NEUROLOG%'],
        prioridad: 10,
    },
    {
        grupo: 'infiltracion',
        nombre: 'Infiltración / Toxina',
        base: 'pacientes',
        patrones: ['INFILTRACION%', 'INYECCION%MIORELAJANTE%', 'INYECCION%TOXINA%'],
    },
    {
        grupo: 'junta',
        nombre: 'Junta de Profesionales',
        base: 'pacientes',
        patrones: ['JUNTA%', 'PARTICIPACION%JUNTA%'],
    },
    {
        grupo: 'terapia_choque',
        nombre: 'Terapia Ondas de Choque',
        base: 'pacientes',
        patrones: ['TERAPIA%CHOQUE%', '%ONDAS%CHOQUE%'],
    },
    {
        grupo: 'ecografia',
        nombre: 'Ecografía como Guía',
        base: 'pacientes',
        // 'ECOGRAFIA' exacto, sin comodín: el catálogo de servicios tiene una
        // entrada con ese nombre pelado que no encajaba en ninguno de los dos
        // patrones anteriores, así que el grupo nunca recibía nada. Se deja exacto y
        // no como 'ECOGRAFIA%' para no absorber ecografías diagnósticas, que no
        // consumen esta capacidad.
        patrones: ['ECOGRAFIA', 'ECOGRAFIA%GUIA%', 'ECOGRAFIA%PROCEDIMIENTO%'],
    },
];
// ─── Interpolación segura ─────────────────────────────────────────────────────
/**
 * Todo lo de este archivo se interpola literalmente en SQL, así que no puede
 * llevar comillas ni barras invertidas. Son constantes escritas a mano, no
 * entrada de usuario, pero el día que alguien añada un grupo con apóstrofo el
 * fallo debe salir al arrancar y no como un `SELECT` roto en producción.
 */
function lit(valor) {
    if (/['\\]/.test(valor)) {
        throw new Error(`Valor no interpolable en SQL de capacidad: ${valor}`);
    }
    return `'${valor}'`;
}
for (const g of exports.GRUPOS_CAPACIDAD) {
    lit(g.grupo);
    lit(g.nombre);
    g.patrones.forEach(lit);
}
// ─── Fragmentos SQL ───────────────────────────────────────────────────────────
/** Tabla derivada con un renglón por grupo: `grupo`, `nombre`, `base_def`. */
function sqlCatalogoGrupos() {
    return exports.GRUPOS_CAPACIDAD
        .map((g, i) => {
        const cols = i === 0
            ? `${lit(g.grupo)} AS grupo, ${lit(g.nombre)} AS nombre, ${lit(g.base)} AS base_def`
            : `${lit(g.grupo)}, ${lit(g.nombre)}, ${lit(g.base)}`;
        return `${i === 0 ? 'SELECT' : 'UNION ALL SELECT'} ${cols}`;
    })
        .join('\n          ');
}
/**
 * Los grupos en el orden en que se EVALÚAN: menor prioridad primero y, a igual
 * prioridad, el de la lista. Lo usan tanto el `CASE` de SQL como
 * `grupoDeNombre`, a propósito: si cada uno calculara su propio orden, un grupo
 * nuevo con `prioridad` los separaría y el mismo servicio caería en grupos
 * distintos según se clasificara en la base o en memoria.
 */
exports.GRUPOS_ORDENADOS = [...exports.GRUPOS_CAPACIDAD]
    .map((g, i) => ({ g, i }))
    .sort((a, b) => (a.g.prioridad ?? 50) - (b.g.prioridad ?? 50) || a.i - b.i)
    .map(({ g }) => g);
/**
 * `CASE` que traduce el nombre del servicio a su grupo, o NULL si no encaja en
 * ninguno. `col` es la columna a inspeccionar, p. ej. `sv.nombre`.
 */
function sqlClasificacionGrupo(col) {
    const ordenados = exports.GRUPOS_ORDENADOS;
    const ramas = ordenados.map((g) => {
        const cond = g.patrones.map((p) => `${col} LIKE ${lit(p)}`).join(' OR ');
        return `            WHEN ${cond} THEN ${lit(g.grupo)}`;
    });
    return `CASE\n${ramas.join('\n')}\n            ELSE NULL\n          END`;
}
/** `FIELD(...)` para ordenar por presentación. */
function sqlOrdenGrupos(col) {
    return `FIELD(${col},${exports.GRUPOS_CAPACIDAD.map((g) => lit(g.grupo)).join(',')})`;
}
/** Base por omisión de cada grupo, para resolver en memoria. */
exports.BASE_POR_GRUPO = Object.fromEntries(exports.GRUPOS_CAPACIDAD.map((g) => [g.grupo, g.base]));
// ─── Clasificación en memoria ─────────────────────────────────────────────────
//
// Existe porque a una CITA hay que asignarle su grupo en JavaScript (todavía no
// es una fila de `atenciones` con `servicio_id`), con las MISMAS reglas que usa
// el `CASE` de arriba para las atenciones ya facturadas.
//
// El `LIKE` de MySQL con `utf8mb4_unicode_ci` ignora mayúsculas Y TILDES, así que
// «ELECTROMIOGRAFÍA» casa con `ELECTROMIOGRAFIA%` en la base. La versión en
// memoria normaliza igual; sin eso, el mismo servicio quedaría clasificado en
// SQL y sin clasificar aquí.
function normalizarParaLike(s) {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}
/** `%` = cualquier secuencia, `_` = un carácter, como en `LIKE`. */
function likeARegex(patron) {
    const esc = normalizarParaLike(patron)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
    return new RegExp(`^${esc}$`, 's');
}
const REGEX_POR_GRUPO = exports.GRUPOS_ORDENADOS.map((g) => ({
    grupo: g.grupo,
    regex: g.patrones.map(likeARegex),
}));
/**
 * Grupo de capacidad de un servicio según su nombre, o `null` si no encaja en
 * ninguno. Equivale al `CASE` de `sqlClasificacionGrupo`.
 */
function grupoDeNombre(nombre) {
    if (!nombre)
        return null;
    const n = normalizarParaLike(nombre);
    for (const { grupo, regex } of REGEX_POR_GRUPO) {
        if (regex.some((r) => r.test(n)))
            return grupo;
    }
    return null;
}
//# sourceMappingURL=capacidad-grupos.js.map