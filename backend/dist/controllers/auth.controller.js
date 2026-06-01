"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_service_js_1 = require("../services/auth.service.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
const usuarios_repo_js_1 = require("../repositories/usuarios.repo.js");
const auditoria_repo_js_1 = require("../repositories/auditoria.repo.js");
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const refreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
const logoutSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
async function authRoutes(fastify) {
    const authService = new auth_service_js_1.AuthService(fastify);
    // POST /api/auth/login — rate limited: 5 requests per minute per IP
    fastify.post('/auth/login', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '1 minute',
            },
        },
    }, async (request, reply) => {
        const parsed = loginSchema.safeParse(request.body);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues[0]?.message ?? 'Invalid request body',
                statusCode: 400,
            });
            return;
        }
        const { email, password } = parsed.data;
        try {
            const result = await authService.login(email, password);
            void auditoria_repo_js_1.auditoriaRepo.insert({ usuarioId: result.usuario.id, accion: auditoria_repo_js_1.ACCION.LOGIN, ip: request.ip, detalle: { rol: result.usuario.rol } }).catch(() => { });
            await reply.status(200).send(result);
        }
        catch (err) {
            void auditoria_repo_js_1.auditoriaRepo.insert({ accion: auditoria_repo_js_1.ACCION.LOGIN_FALLIDO, ip: request.ip, detalle: { email } }).catch(() => { });
            throw err;
        }
    });
    // POST /api/auth/refresh
    fastify.post('/auth/refresh', async (request, reply) => {
        const parsed = refreshSchema.safeParse(request.body);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues[0]?.message ?? 'Invalid request body',
                statusCode: 400,
            });
            return;
        }
        const { refreshToken } = parsed.data;
        const result = await authService.refresh(refreshToken);
        await reply.status(200).send(result);
    });
    // POST /api/auth/logout
    fastify.post('/auth/logout', async (request, reply) => {
        const parsed = logoutSchema.safeParse(request.body);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues[0]?.message ?? 'Invalid request body',
                statusCode: 400,
            });
            return;
        }
        const { refreshToken } = parsed.data;
        const { usuarioId } = await authService.logout(refreshToken);
        void auditoria_repo_js_1.auditoriaRepo.insert({ usuarioId, accion: auditoria_repo_js_1.ACCION.LOGOUT, ip: request.ip }).catch(() => { });
        await reply.status(200).send({ message: 'Logged out successfully' });
    });
    // GET /api/auth/me
    fastify.get('/auth/me', { preHandler: auth_middleware_js_1.requireAuth }, async (request, reply) => {
        const usuario = await authService.getMe(request.authenticatedUser.id);
        await reply.status(200).send(usuario);
    });
    // POST /api/auth/change-password — authenticated user changes their own password
    fastify.post('/auth/change-password', { preHandler: auth_middleware_js_1.requireAuth }, async (request, reply) => {
        const parsed = zod_1.z.object({
            currentPassword: zod_1.z.string().min(1, 'La contraseña actual es requerida'),
            newPassword: zod_1.z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
        }).safeParse(request.body);
        if (!parsed.success) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: parsed.error.issues.map((i) => i.message).join(', '),
                statusCode: 400,
            });
            return;
        }
        const userId = request.authenticatedUser.id;
        const usuario = await usuarios_repo_js_1.usuariosRepo.findById(userId);
        if (!usuario) {
            await reply.status(401).send({ error: 'Unauthorized', statusCode: 401 });
            return;
        }
        const valid = await bcryptjs_1.default.compare(parsed.data.currentPassword, usuario.passwordHash);
        if (!valid) {
            await reply.status(400).send({
                error: 'Bad Request',
                message: 'La contraseña actual es incorrecta',
                statusCode: 400,
            });
            return;
        }
        const newHash = await bcryptjs_1.default.hash(parsed.data.newPassword, 12);
        await usuarios_repo_js_1.usuariosRepo.updatePassword(userId, newHash);
        void auditoria_repo_js_1.auditoriaRepo.insert({ usuarioId: userId, accion: auditoria_repo_js_1.ACCION.CAMBIO_PASSWORD, ip: request.ip }).catch(() => { });
        await reply.status(200).send({ ok: true });
    });
}
//# sourceMappingURL=auth.controller.js.map