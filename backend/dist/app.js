"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildApp = buildApp;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const rate_limit_1 = __importDefault(require("@fastify/rate-limit"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const static_1 = __importDefault(require("@fastify/static"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const env_js_1 = require("./config/env.js");
const logger_js_1 = require("./config/logger.js");
const error_middleware_js_1 = require("./middlewares/error.middleware.js");
const auth_routes_js_1 = require("./routes/auth.routes.js");
const connectors_routes_js_1 = require("./routes/connectors.routes.js");
const reportes_routes_js_1 = require("./routes/reportes.routes.js");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_VERSION = require('../../package.json').version;
// __dirname is reliable in CommonJS output regardless of cwd
// compiled file lives at backend/dist/app.js → ../../frontend/dist = frontend/dist
const FRONTEND_DIST = path_1.default.resolve(__dirname, '../../frontend/dist');
async function buildApp() {
    const fastify = (0, fastify_1.default)({
        logger: false, // We use Winston instead of Fastify's built-in logger
        requestIdHeader: 'x-request-id',
        genReqId: () => crypto.randomUUID(),
    });
    // ─── Request logging hook ─────────────────────────────────────────────────
    fastify.addHook('onRequest', async (request) => {
        logger_js_1.logger.info('Incoming request', {
            requestId: request.id,
            method: request.method,
            url: request.url,
            ip: request.ip,
        });
    });
    fastify.addHook('onResponse', async (request, reply) => {
        logger_js_1.logger.info('Request completed', {
            requestId: request.id,
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
        });
    });
    // ─── Security plugins ─────────────────────────────────────────────────────
    await fastify.register(helmet_1.default, {
        contentSecurityPolicy: false, // CSP is handled by the frontend
    });
    await fastify.register(cors_1.default, {
        origin: env_js_1.env.CORS_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
        credentials: true,
    });
    // ─── Rate limiting ────────────────────────────────────────────────────────
    await fastify.register(rate_limit_1.default, {
        global: false, // We apply rate limits per-route where needed
        max: 100,
        timeWindow: '1 minute',
        keyGenerator: (request) => request.ip,
        errorResponseBuilder: (_request, context) => ({
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Retry in ${Math.ceil(context.ttl / 1000)} seconds.`,
            statusCode: 429,
        }),
    });
    // ─── JWT ──────────────────────────────────────────────────────────────────
    await fastify.register(jwt_1.default, {
        secret: env_js_1.env.JWT_SECRET,
        sign: {
            expiresIn: env_js_1.env.JWT_EXPIRES_IN,
        },
    });
    // ─── Global error handler ─────────────────────────────────────────────────
    fastify.setErrorHandler(error_middleware_js_1.errorHandler);
    // ─── Version endpoint (public) ───────────────────────────────────────────
    fastify.get('/api/version', async (_request, reply) => {
        return reply.send({ version: APP_VERSION, env: env_js_1.env.NODE_ENV });
    });
    // ─── Routes ───────────────────────────────────────────────────────────────
    await (0, auth_routes_js_1.registerAuthRoutes)(fastify);
    await (0, connectors_routes_js_1.registerConnectorRoutes)(fastify);
    await (0, reportes_routes_js_1.registerReportesRoutes)(fastify);
    // ─── Static frontend (production) / JSON 404 (development) ───────────────
    const frontendReady = env_js_1.env.NODE_ENV === 'production' && fs_1.default.existsSync(path_1.default.join(FRONTEND_DIST, 'index.html'));
    console.log(`[BOOT] NODE_ENV=${env_js_1.env.NODE_ENV} | frontend dist: ${FRONTEND_DIST} | ready=${frontendReady}`);
    if (frontendReady) {
        await fastify.register(static_1.default, {
            root: FRONTEND_DIST,
            prefix: '/',
        });
        // SPA fallback — serve index.html for all non-API routes
        fastify.setNotFoundHandler((_req, reply) => {
            void reply.sendFile('index.html');
        });
    }
    else {
        fastify.setNotFoundHandler(async (_request, reply) => {
            await reply.status(404).send({
                error: 'Not Found',
                message: 'The requested resource does not exist',
                statusCode: 404,
            });
        });
    }
    return fastify;
}
//# sourceMappingURL=app.js.map