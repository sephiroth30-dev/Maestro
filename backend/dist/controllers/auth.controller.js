"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const zod_1 = require("zod");
const auth_service_js_1 = require("../services/auth.service.js");
const auth_middleware_js_1 = require("../middlewares/auth.middleware.js");
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
    // GET /api/health
    fastify.get('/health', async (_request, reply) => {
        const response = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '0.1.0',
        };
        await reply.status(200).send(response);
    });
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
        const result = await authService.login(email, password);
        await reply.status(200).send(result);
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
        await authService.logout(refreshToken);
        await reply.status(200).send({ message: 'Logged out successfully' });
    });
    // GET /api/auth/me
    fastify.get('/auth/me', { preHandler: auth_middleware_js_1.requireAuth }, async (request, reply) => {
        const usuario = await authService.getMe(request.authenticatedUser.id);
        await reply.status(200).send(usuario);
    });
}
//# sourceMappingURL=auth.controller.js.map