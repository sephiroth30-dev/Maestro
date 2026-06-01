import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Rol } from '../types/index.js';

/**
 * Creates a preHandler that checks if the authenticated user has one of the
 * allowed roles. Must be used AFTER requireAuth.
 */
export function requireRole(...allowedRoles: Rol[]) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const user = request.authenticatedUser;

    if (!user) {
      await reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
        statusCode: 401,
      });
      return;
    }

    if (!allowedRoles.includes(user.rol as Rol)) {
      await reply.status(403).send({
        error: 'Forbidden',
        message: 'Insufficient permissions',
        statusCode: 403,
      });
      return;
    }
  };
}

/**
 * RBAC permission matrix for the Neurofic Dashboard.
 * Centralized so route files can import named permission groups.
 */
export const Permissions = {
  // Full system access
  ADMIN_ONLY: ['ADMIN'] as Rol[],

  // Administrative + management
  MANAGEMENT: ['ADMIN', 'GERENCIA', 'DIRECCION'] as Rol[],

  // Billing and related
  BILLING: ['ADMIN', 'GERENCIA', 'FACTURACION'] as Rol[],

  // All roles can view dashboards
  VIEW_DASHBOARD: [
    'ADMIN',
    'GERENCIA',
    'DIRECCION',
    'FACTURACION',
    'COORDINADORA',
    'ADMISIONES',
    'RECURSOS_HUMANOS',
  ] as Rol[],

  // Coordination roles
  COORDINATION: ['ADMIN', 'GERENCIA', 'DIRECCION', 'COORDINADORA'] as Rol[],

  // Admissions access
  ADMISSIONS: ['ADMIN', 'GERENCIA', 'DIRECCION', 'ADMISIONES'] as Rol[],

  // Honorarios / liquidaciones (RRHH manages payroll)
  HONORARIOS: ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'RECURSOS_HUMANOS'] as Rol[],
} as const;
