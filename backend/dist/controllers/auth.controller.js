"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_service_js_1 = require("../services/auth.service.js");
const password_reset_service_js_1 = require("../services/password-reset.service.js");
const logger_js_1 = require("../config/logger.js");
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
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Ingresa un correo válido'),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'El enlace no es válido o ya caducó. Solicita uno nuevo.').max(512),
    newPassword: zod_1.z
        .string()
        .min(password_reset_service_js_1.RESET_MIN_PASSWORD, `La nueva contraseña debe tener al menos ${password_reset_service_js_1.RESET_MIN_PASSWORD} caracteres`)
        .max(password_reset_service_js_1.RESET_MAX_PASSWORD, `La nueva contraseña no puede superar ${password_reset_service_js_1.RESET_MAX_PASSWORD} caracteres`),
});
/** Respuesta genérica de «olvidé mi contraseña»: idéntica exista o no el correo (anti-enumeración). */
const MSG_FORGOT_PASSWORD = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';
async function authRoutes(fastify) {
    const authService = new auth_service_js_1.AuthService(fastify);
    const passwordResetService = new password_reset_service_js_1.PasswordResetService();
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
    // POST /api/auth/forgot-password — pública. SIEMPRE 200 con el mismo cuerpo (exista o no el
    // correo, falle o no el SMTP) y sin esperar el envío: así ni el contenido ni el tiempo de
    // respuesta delatan si un correo está registrado. Límite: 5 por 15 min por IP.
    fastify.post('/auth/forgot-password', {
        config: {
            rateLimit: {
                max: 5,
                timeWindow: '15 minutes',
            },
        },
    }, async (request, reply) => {
        const parsed = forgotPasswordSchema.safeParse(request.body);
        if (!parsed.success) {
            const mensaje = parsed.error.issues[0]?.message ?? 'Solicitud no válida';
            await reply.status(400).send({ error: mensaje, message: mensaje, statusCode: 400 });
            return;
        }
        // Segundo plano: `solicitar` no lanza, pero el catch es el último cinturón.
        void passwordResetService.solicitar(parsed.data.email, request.ip).catch((err) => {
            logger_js_1.logger.error('Restablecer contraseña: error inesperado en segundo plano', {
                error: err instanceof Error ? err.message : String(err),
            });
        });
        await reply.status(200).send({ message: MSG_FORGOT_PASSWORD });
    });
    // POST /api/auth/reset-password — pública. Cambia la contraseña con el token del correo; NO inicia
    // sesión. Cualquier fallo del token responde igual (400). Límite: 10 por 15 min por IP.
    fastify.post('/auth/reset-password', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '15 minutes',
            },
        },
    }, async (request, reply) => {
        const parsed = resetPasswordSchema.safeParse(request.body);
        if (!parsed.success) {
            const mensaje = parsed.error.issues[0]?.message ?? 'Solicitud no válida';
            await reply.status(400).send({ error: mensaje, message: mensaje, statusCode: 400 });
            return;
        }
        try {
            await passwordResetService.restablecer(parsed.data.token, parsed.data.newPassword, request.ip);
        }
        catch (err) {
            if (err instanceof password_reset_service_js_1.ResetPasswordError) {
                await reply.status(400).send({ error: err.message, message: err.message, statusCode: 400 });
                return;
            }
            throw err;
        }
        await reply.status(200).send({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    });
}
//# sourceMappingURL=auth.controller.js.map