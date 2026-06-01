"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capacidadRepo = exports.CapacidadRepository = void 0;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapCapacidad(row) {
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
function mapUtilizacion(row) {
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
class CapacidadRepository {
    async upsert(data) {
        const id = (0, node_crypto_1.randomUUID)();
        await prisma_js_1.pool.execute(`INSERT INTO capacidad_instalada (id, grupo, nombre, anio, mes_idx, capacidad, recursos, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         capacidad = VALUES(capacidad),
         recursos = VALUES(recursos),
         updated_at = NOW(3)`, [id, data.grupo, data.nombre, data.anio, data.mesIdx, data.capacidad, data.recursos ?? null]);
        // Fetch the upserted row
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ? LIMIT 1', [data.grupo, data.anio, data.mesIdx]);
        return mapCapacidad(rows[0]);
    }
    async findByAnio(anio) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM capacidad_instalada WHERE anio = ? ORDER BY mes_idx ASC', [anio]);
        return rows.map(mapCapacidad);
    }
    async deleteOne(grupo, anio, mesIdx) {
        await prisma_js_1.pool.execute('DELETE FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ?', [grupo, anio, mesIdx]);
    }
    async getUtilizacion(anio, mesIdx) {
        const [rows] = await prisma_js_1.pool.query(`SELECT
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
      ORDER BY FIELD(g.grupo,'emg_vcn','eeg','tlm','psg_lms','pe','consulta_fisiatria','consulta_neurologia','consulta_neurologia_pediatrica','infiltracion','junta','terapia_choque','ecografia')`, [anio, mesIdx, mesIdx, anio]);
        return rows.map(mapUtilizacion);
    }
}
exports.CapacidadRepository = CapacidadRepository;
exports.capacidadRepo = new CapacidadRepository();
//# sourceMappingURL=capacidad.repo.js.map