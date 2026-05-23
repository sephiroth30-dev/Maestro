import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Rol } from '../types/index.js';
/**
 * Creates a preHandler that checks if the authenticated user has one of the
 * allowed roles. Must be used AFTER requireAuth.
 */
export declare function requireRole(...allowedRoles: Rol[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
/**
 * RBAC permission matrix for the Neurofic Dashboard.
 * Centralized so route files can import named permission groups.
 */
export declare const Permissions: {
    readonly ADMIN_ONLY: Rol[];
    readonly MANAGEMENT: Rol[];
    readonly BILLING: Rol[];
    readonly VIEW_DASHBOARD: Rol[];
    readonly COORDINATION: Rol[];
    readonly ADMISSIONS: Rol[];
};
//# sourceMappingURL=rbac.middleware.d.ts.map