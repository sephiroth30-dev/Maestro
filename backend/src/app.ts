import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerConnectorRoutes } from './routes/connectors.routes.js';
import { registerReportesRoutes } from './routes/reportes.routes.js';

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

  // ─── 404 handler ─────────────────────────────────────────────────────────
  fastify.setNotFoundHandler(async (_request, reply) => {
    await reply.status(404).send({
      error: 'Not Found',
      message: 'The requested resource does not exist',
      statusCode: 404,
    });
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  await registerAuthRoutes(fastify);
  await registerConnectorRoutes(fastify);
  await registerReportesRoutes(fastify);

  return fastify;
}
