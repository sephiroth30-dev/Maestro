import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { AuthenticatedUser } from '../types/index.js';
/**
 * We extend FastifyRequest to carry a typed `authenticatedUser` field
 * rather than fighting the module augmentation conflict with @fastify/jwt
 * which declares `user` as `string | object | Buffer`.
 */
declare module 'fastify' {
    interface FastifyRequest {
        authenticatedUser: AuthenticatedUser;
    }
}
export declare function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function optionalAuth(request: FastifyRequest, _reply: FastifyReply, done: HookHandlerDoneFunction): void;
//# sourceMappingURL=auth.middleware.d.ts.map