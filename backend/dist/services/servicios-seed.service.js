"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoSeedServicios = autoSeedServicios;
const prisma_js_1 = require("../config/prisma.js");
const logger_js_1 = require("../config/logger.js");
const SERVICIOS = [
    {
        nombre: 'CONSULTA PRIMERA VEZ',
        palabrasClave: ['CONSULTA PRIMERA VEZ'],
        tipoConteo: 'unidad',
        orden: 1,
    },
    {
        // Telemetría: cada fila = 1 hora → agrupar por fecha+paciente para contar sesiones
        nombre: 'MONITORIZACION EEG VIDEO-RADIO',
        palabrasClave: ['MONITORIZACION ELECTROENCEFALOG', 'TELEMETRIA'],
        tipoConteo: 'sesion',
        orden: 2,
    },
    {
        nombre: 'ELECTROENCEFALOGRAMA COMPUTARIZADO',
        palabrasClave: ['ELECTROENCEFALOGRAMA COMPUTARIZADO'],
        tipoConteo: 'unidad',
        orden: 3,
    },
    {
        nombre: 'ELECTROMIOGRAFIA',
        palabrasClave: ['ELECTROMIOGRAFIA'],
        tipoConteo: 'unidad',
        orden: 4,
    },
    {
        nombre: 'NEUROCONDUCCION',
        palabrasClave: ['NEUROCONDUCCION', 'CONDUCCION NERVIOSA'],
        tipoConteo: 'unidad',
        orden: 5,
    },
    {
        nombre: 'AGUJA MONOPOLAR',
        palabrasClave: ['AGUJA MONOPOLAR'],
        tipoConteo: 'unidad',
        orden: 6,
    },
    {
        nombre: 'TERAPIA ONDAS DE CHOQUE',
        palabrasClave: ['ONDAS CHOQUE'],
        tipoConteo: 'unidad',
        orden: 7,
    },
    {
        nombre: 'REFLEJO H',
        palabrasClave: ['REFLEJO H'],
        tipoConteo: 'unidad',
        orden: 8,
    },
    {
        nombre: 'INYECCION TOXINA BOTULINICA',
        palabrasClave: ['TOXINA BOTULINICA', 'MIORELAJANTE'],
        tipoConteo: 'unidad',
        orden: 9,
    },
    {
        nombre: 'JUNTA MEDICA INTERDISCIPLINARIA',
        palabrasClave: ['JUNTA MEDICA', 'EQUIPO INTERDISCIPLINARIO', 'PARTICIPACION JUNTA'],
        tipoConteo: 'unidad',
        orden: 10,
    },
    {
        // Polisomnografía: estudio nocturno completo, puede estar en varias filas
        nombre: 'POLISOMNOGRAFIA',
        palabrasClave: ['POLISOMNOGRAFIA', 'POLISOMNOGRAFICO'],
        tipoConteo: 'sesion',
        orden: 11,
    },
    {
        nombre: 'POTENCIALES EVOCADOS',
        palabrasClave: ['POTENCIALES EVOCADOS', 'POTENCIAL EVOCADO'],
        tipoConteo: 'unidad',
        orden: 12,
    },
];
async function autoSeedServicios() {
    let created = 0;
    let updated = 0;
    for (const s of SERVICIOS) {
        try {
            const [rows] = await prisma_js_1.pool.query('SELECT id FROM servicios WHERE nombre = ? LIMIT 1', [s.nombre]);
            const kwJson = JSON.stringify(s.palabrasClave);
            if (rows[0]) {
                await prisma_js_1.pool.execute('UPDATE servicios SET palabras_clave = ?, tipo_conteo = ?, orden = ? WHERE id = ?', [kwJson, s.tipoConteo, s.orden, rows[0].id]);
                updated++;
            }
            else {
                await prisma_js_1.pool.execute('INSERT INTO servicios (id, nombre, palabras_clave, tipo_conteo, orden) VALUES (UUID(), ?, ?, ?, ?)', [s.nombre, kwJson, s.tipoConteo, s.orden]);
                created++;
            }
        }
        catch (err) {
            logger_js_1.logger.warn('servicios-seed: error upserting servicio', {
                nombre: s.nombre,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    logger_js_1.logger.info('Servicios catalog synced', { total: SERVICIOS.length, created, updated });
}
//# sourceMappingURL=servicios-seed.service.js.map