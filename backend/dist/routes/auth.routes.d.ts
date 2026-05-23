import type { FastifyInstance } from 'fastify';
/**
 * Registers all authentication routes under /api prefix.
 * Actual route definitions live in auth.controller.ts so the
 * controller file stays the single source of truth for paths.
 */
export declare function registerAuthRoutes(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=auth.routes.d.ts.map