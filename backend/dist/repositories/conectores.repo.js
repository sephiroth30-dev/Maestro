"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conectoresRepo = exports.ConectoresRepository = void 0;
const node_crypto_1 = require("node:crypto");
const prisma_js_1 = require("../config/prisma.js");
// ─── Helpers ──────────────────────────────────────────────────────────────────
function mapConector(row) {
    return {
        id: row.id,
        nombre: row.nombre,
        tipo: row.tipo,
        config: (typeof row.config === 'string' ? JSON.parse(row.config) : row.config),
        activo: Boolean(row.activo),
        frecuenciaSync: row.frecuencia_sync,
        ultimaSync: row.ultima_sync,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function mapSincronizacion(row) {
    return {
        id: row.id,
        conectorId: row.conector_id,
        estado: row.estado,
        filasLeidas: row.filas_leidas,
        filasNuevas: row.filas_nuevas,
        errores: row.errores !== null
            ? (typeof row.errores === 'string' ? JSON.parse(row.errores) : row.errores)
            : null,
        iniciadaAt: row.iniciada_at,
        finalizadaAt: row.finalizada_at,
    };
}
// ─── Repository ───────────────────────────────────────────────────────────────
class ConectoresRepository {
    // ─── Conector CRUD ────────────────────────────────────────────────────────
    async create(data) {
        const id = (0, node_crypto_1.randomUUID)();
        const frecuenciaSync = data.frecuenciaSync ?? 'daily';
        await prisma_js_1.pool.execute('INSERT INTO conectores (id, nombre, tipo, config, activo, frecuencia_sync, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())', [id, data.nombre, data.tipo, JSON.stringify(data.config), frecuenciaSync]);
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM conectores WHERE id = ? LIMIT 1', [id]);
        return mapConector(rows[0]);
    }
    async findAll() {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM conectores ORDER BY created_at DESC');
        return rows.map(mapConector);
    }
    async findAllActive() {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM conectores WHERE activo = 1 ORDER BY nombre ASC');
        return rows.map(mapConector);
    }
    async findById(id) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM conectores WHERE id = ? LIMIT 1', [id]);
        const row = rows[0];
        return row ? mapConector(row) : null;
    }
    async update(id, data) {
        const setClauses = [];
        const params = [];
        if (data.nombre !== undefined) {
            setClauses.push('nombre = ?');
            params.push(data.nombre);
        }
        if (data.config !== undefined) {
            setClauses.push('config = ?');
            params.push(JSON.stringify(data.config));
        }
        if (data.activo !== undefined) {
            setClauses.push('activo = ?');
            params.push(data.activo ? 1 : 0);
        }
        if (data.frecuenciaSync !== undefined) {
            setClauses.push('frecuencia_sync = ?');
            params.push(data.frecuenciaSync);
        }
        if (data.ultimaSync !== undefined) {
            setClauses.push('ultima_sync = ?');
            params.push(data.ultimaSync);
        }
        setClauses.push('updated_at = NOW()');
        params.push(id);
        await prisma_js_1.pool.execute(`UPDATE conectores SET ${setClauses.join(', ')} WHERE id = ?`, params);
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM conectores WHERE id = ? LIMIT 1', [id]);
        return mapConector(rows[0]);
    }
    async softDelete(id) {
        await prisma_js_1.pool.execute('DELETE FROM atenciones WHERE conector_id = ?', [id]);
        await prisma_js_1.pool.execute('DELETE FROM sincronizaciones WHERE conector_id = ?', [id]);
        await prisma_js_1.pool.execute('DELETE FROM conectores WHERE id = ?', [id]);
    }
    // ─── Sincronizaciones ─────────────────────────────────────────────────────
    async createSincronizacion(data) {
        const id = (0, node_crypto_1.randomUUID)();
        const filasLeidas = data.filasLeidas ?? 0;
        const filasNuevas = data.filasNuevas ?? 0;
        const errores = data.errores !== undefined ? JSON.stringify(data.errores) : null;
        const finalizadaAt = data.finalizadaAt ?? null;
        await prisma_js_1.pool.execute('INSERT INTO sincronizaciones (id, conector_id, estado, filas_leidas, filas_nuevas, errores, iniciada_at, finalizada_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)', [id, data.conectorId, data.estado, filasLeidas, filasNuevas, errores, finalizadaAt]);
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM sincronizaciones WHERE id = ? LIMIT 1', [id]);
        return mapSincronizacion(rows[0]);
    }
    async updateSincronizacion(id, data) {
        const setClauses = [];
        const params = [];
        if (data.estado !== undefined) {
            setClauses.push('estado = ?');
            params.push(data.estado);
        }
        if (data.filasLeidas !== undefined) {
            setClauses.push('filas_leidas = ?');
            params.push(data.filasLeidas);
        }
        if (data.filasNuevas !== undefined) {
            setClauses.push('filas_nuevas = ?');
            params.push(data.filasNuevas);
        }
        if (data.errores !== undefined) {
            setClauses.push('errores = ?');
            params.push(JSON.stringify(data.errores));
        }
        if (data.finalizadaAt !== undefined) {
            setClauses.push('finalizada_at = ?');
            params.push(data.finalizadaAt);
        }
        if (setClauses.length > 0) {
            params.push(id);
            await prisma_js_1.pool.execute(`UPDATE sincronizaciones SET ${setClauses.join(', ')} WHERE id = ?`, params);
        }
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM sincronizaciones WHERE id = ? LIMIT 1', [id]);
        return mapSincronizacion(rows[0]);
    }
    async findSincronizacionesByConector(conectorId, limit = 20) {
        const [rows] = await prisma_js_1.pool.query('SELECT * FROM sincronizaciones WHERE conector_id = ? ORDER BY iniciada_at DESC LIMIT ?', [conectorId, limit]);
        return rows.map(mapSincronizacion);
    }
}
exports.ConectoresRepository = ConectoresRepository;
exports.conectoresRepo = new ConectoresRepository();
//# sourceMappingURL=conectores.repo.js.map