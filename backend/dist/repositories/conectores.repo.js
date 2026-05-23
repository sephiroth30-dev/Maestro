"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conectoresRepo = exports.ConectoresRepository = void 0;
const prisma_js_1 = require("../config/prisma.js");
// ─── Explicit select shapes ───────────────────────────────────────────────────
const conectorSelect = {
    id: true,
    nombre: true,
    tipo: true,
    config: true,
    activo: true,
    frecuenciaSync: true,
    ultimaSync: true,
    createdAt: true,
    updatedAt: true,
};
const sincronizacionSelect = {
    id: true,
    conectorId: true,
    estado: true,
    filasLeidas: true,
    filasNuevas: true,
    errores: true,
    iniciadaAt: true,
    finalizadaAt: true,
};
// ─── Repository ───────────────────────────────────────────────────────────────
class ConectoresRepository {
    // ─── Conector CRUD ────────────────────────────────────────────────────────
    async create(data) {
        return prisma_js_1.prisma.conector.create({
            data: {
                nombre: data.nombre,
                tipo: data.tipo,
                config: data.config,
                frecuenciaSync: data.frecuenciaSync ?? 'daily',
            },
            select: conectorSelect,
        });
    }
    async findAll() {
        return prisma_js_1.prisma.conector.findMany({
            select: conectorSelect,
            orderBy: { createdAt: 'desc' },
        });
    }
    async findAllActive() {
        return prisma_js_1.prisma.conector.findMany({
            where: { activo: true },
            select: conectorSelect,
            orderBy: { nombre: 'asc' },
        });
    }
    async findById(id) {
        return prisma_js_1.prisma.conector.findUnique({
            where: { id },
            select: conectorSelect,
        });
    }
    async update(id, data) {
        const updateData = {};
        if (data.nombre !== undefined)
            updateData['nombre'] = data.nombre;
        if (data.config !== undefined)
            updateData['config'] = data.config;
        if (data.activo !== undefined)
            updateData['activo'] = data.activo;
        if (data.frecuenciaSync !== undefined)
            updateData['frecuenciaSync'] = data.frecuenciaSync;
        if (data.ultimaSync !== undefined)
            updateData['ultimaSync'] = data.ultimaSync;
        return prisma_js_1.prisma.conector.update({
            where: { id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: updateData,
            select: conectorSelect,
        });
    }
    async softDelete(id) {
        await prisma_js_1.prisma.conector.update({
            where: { id },
            data: { activo: false },
        });
    }
    // ─── Sincronizaciones ─────────────────────────────────────────────────────
    async createSincronizacion(data) {
        return prisma_js_1.prisma.sincronizacion.create({
            data: {
                conectorId: data.conectorId,
                estado: data.estado,
                filasLeidas: data.filasLeidas ?? 0,
                filasNuevas: data.filasNuevas ?? 0,
                errores: data.errores !== undefined ? data.errores : undefined,
                finalizadaAt: data.finalizadaAt,
            },
            select: sincronizacionSelect,
        });
    }
    async updateSincronizacion(id, data) {
        const updateData = {};
        if (data.estado !== undefined)
            updateData['estado'] = data.estado;
        if (data.filasLeidas !== undefined)
            updateData['filasLeidas'] = data.filasLeidas;
        if (data.filasNuevas !== undefined)
            updateData['filasNuevas'] = data.filasNuevas;
        if (data.errores !== undefined)
            updateData['errores'] = data.errores;
        if (data.finalizadaAt !== undefined)
            updateData['finalizadaAt'] = data.finalizadaAt;
        return prisma_js_1.prisma.sincronizacion.update({
            where: { id },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: updateData,
            select: sincronizacionSelect,
        });
    }
    async findSincronizacionesByConector(conectorId, limit = 20) {
        return prisma_js_1.prisma.sincronizacion.findMany({
            where: { conectorId },
            select: sincronizacionSelect,
            orderBy: { iniciadaAt: 'desc' },
            take: limit,
        });
    }
}
exports.ConectoresRepository = ConectoresRepository;
exports.conectoresRepo = new ConectoresRepository();
//# sourceMappingURL=conectores.repo.js.map