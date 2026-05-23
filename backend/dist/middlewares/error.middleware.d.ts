import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
/**
 * Global Fastify error handler.
 * - Never exposes stack traces in production.
 * - Normalises all errors to a consistent JSON shape.
 */
export declare function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply): void;
//# sourceMappingURL=error.middleware.d.ts.map