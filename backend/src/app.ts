import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerConnectorRoutes } from './routes/connectors.routes.js';
import { registerReportesRoutes } from './routes/reportes.routes.js';
import { registerUsuariosRoutes } from './routes/usuarios.routes.js';
import { registerAuditoriaRoutes } from './routes/auditoria.routes.js';
import { registerCapacidadRoutes } from './routes/capacidad.routes.js';
import { registerReglasHonorariosRoutes } from './controllers/reglas-honorarios.controller.js';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const APP_VERSION: string = (require('../../package.json') as { version: string }).version;

// __dirname is reliable in CommonJS output regardless of cwd
// compiled file lives at backend/dist/app.js → ../../frontend/dist = frontend/dist
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // We use Winston instead of Fastify's built-in logger
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // ─── Request logging hook ─────────────────────────────────────────────────
  fastify.addHook('onRequest', async (request) => {
    logger.info('Incoming request', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info('Request completed', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
    });
  });

  // ─── Security plugins ─────────────────────────────────────────────────────
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false, // CSP is handled by the frontend
  });

  await fastify.register(fastifyCors, {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    credentials: true,
  });

  // ─── Rate limiting ────────────────────────────────────────────────────────
  await fastify.register(fastifyRateLimit, {
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
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  // ─── Global error handler ─────────────────────────────────────────────────
  fastify.setErrorHandler(errorHandler);

  // ─── Version endpoint (public) ───────────────────────────────────────────
  fastify.get('/api/version', async (_request, reply) => {
    return reply.send({ version: APP_VERSION, commit: process.env.COMMIT_SHA ?? 'local', env: env.NODE_ENV });
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  await registerAuthRoutes(fastify);
  await registerConnectorRoutes(fastify);
  await registerReportesRoutes(fastify);
  await registerUsuariosRoutes(fastify);
  await registerAuditoriaRoutes(fastify);
  await registerCapacidadRoutes(fastify);
  await registerReglasHonorariosRoutes(fastify);

  // ─── Static frontend (production) / JSON 404 (development) ───────────────
  const frontendReady = env.NODE_ENV === 'production' && fs.existsSync(path.join(FRONTEND_DIST, 'index.html'));

  console.log(`[BOOT] NODE_ENV=${env.NODE_ENV} | frontend dist: ${FRONTEND_DIST} | ready=${frontendReady}`);

  if (frontendReady) {
    await fastify.register(fastifyStatic, {
      root: FRONTEND_DIST,
      prefix: '/',
    });

    // SPA fallback — serve index.html for all non-API routes
    fastify.setNotFoundHandler((_req, reply) => {
      void reply.sendFile('index.html');
    });
  } else {
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
