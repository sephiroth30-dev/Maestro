"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usuariosRoutes = usuariosRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const usuarios_repo_js_1 = require("../repositories/usuarios.repo.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const rbac_middleware_js_1 = require("../middlewares/rbac.middleware.js");
const BCRYPT_ROUNDS = 12;
const ROLES_VALIDOS = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA', 'ADMISIONES'];
const createSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
    email: zod_1.z.string().email('Email inválido').max(191),
    rol: zod_1.z.enum(ROLES_VALIDOS),
    password: zod_1.z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});
const updateSchema = zod_1.z.object({
    nombre: zod_1.z.string().min(2).max(100).optional(),
    email: zod_1.z.string().email('Email inválido').max(191).optional(),
    rol: zod_1.z.enum(ROLES_VALIDOS).optional(),
    activo: zod_1.z.boolean().optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Se requiere al menos un campo para actualizar',
});
const resetPasswordSchema = zod_1.z.object({
    newPassword: zod_1.z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});
async function usuariosRoutes(fastify) {
    // GET /api/usuarios — list all users (ADMIN only)
    fastify.get('/usuarios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (_request, reply) => {
        const usuarios = await usuarios_repo_js_1.usuariosRepo.listAll();
        return reply.send(usuarios.map((u) => ({
            id: u.id,
            nombre: u.nombre,
            email: u.email,
            rol: u.rol,
            activo: u.activo,
            createdAt: u.createdAt,
        })));
    });
    // POST /api/usuarios — create user (ADMIN only)
    fastify.post('/usuarios', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const parsed = createSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const { nombre, email, rol, password } = parsed.data;
        const existing = await usuarios_repo_js_1.usuariosRepo.findByEmail(email);
        if (existing) {
            return reply.status(409).send({
                error: 'Conflict',
                message: 'Ya existe un usuario con ese correo electrónico',
                statusCode: 409,
            });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, BCRYPT_ROUNDS);
        const usuario = await usuarios_repo_js_1.usuariosRepo.create({ nombre, email, passwordHash, rol });
        return reply.status(201).send({
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            activo: usuario.activo,
            createdAt: usuario.createdAt,
        });
    });
    // PATCH /api/usuarios/:id — update user (ADMIN only)
    fastify.patch('/usuarios/:id', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = updateSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        if (parsed.data.email) {
            const conflict = await usuarios_repo_js_1.usuariosRepo.findByEmailExcluding(parsed.data.email, id);
            if (conflict) {
                return reply.status(409).send({
                    error: 'Conflict',
                    message: 'Ya existe otro usuario con ese correo electrónico',
                    statusCode: 409,
                });
            }
        }
        await usuarios_repo_js_1.usuariosRepo.update(id, parsed.data);
        return reply.status(200).send({ ok: true });
    });
    // DELETE /api/usuarios/:id — soft delete (ADMIN only, cannot delete self)
    fastify.delete('/usuarios/:id', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { id } = request.params;
        const selfId = request.authenticatedUser.id;
        if (id === selfId) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: 'No puedes eliminar tu propia cuenta',
                statusCode: 400,
            });
        }
        await usuarios_repo_js_1.usuariosRepo.softDelete(id);
        return reply.status(200).send({ ok: true });
    });
    // POST /api/usuarios/:id/reset-password — admin resets any user's password
    fastify.post('/usuarios/:id/reset-password', { preHandler: [auth_middleware_js_1.requireAuth, (0, rbac_middleware_js_1.requireRole)('ADMIN')] }, async (request, reply) => {
        const { id } = request.params;
        const parsed = resetPasswordSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
        }
        const passwordHash = await bcryptjs_1.default.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
        await usuarios_repo_js_1.usuariosRepo.updatePassword(id, passwordHash);
        // Revoke all sessions so the user must re-login with the new password
        await usuarios_repo_js_1.usuariosRepo.revokeAllUserRefreshTokens(id);
        return reply.status(200).send({ ok: true });
    });
}
//# sourceMappingURL=usuarios.controller.js.map