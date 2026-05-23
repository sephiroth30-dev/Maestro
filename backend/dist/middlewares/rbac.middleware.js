"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissions = void 0;
exports.requireRole = requireRole;
/**
 * Creates a preHandler that checks if the authenticated user has one of the
 * allowed roles. Must be used AFTER requireAuth.
 */
function requireRole(...allowedRoles) {
    return async function (request, reply) {
        const user = request.authenticatedUser;
        if (!user) {
            await reply.status(401).send({
                error: 'Unauthorized',
                message: 'Authentication required',
                statusCode: 401,
            });
            return;
        }
        if (!allowedRoles.includes(user.rol)) {
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
exports.Permissions = {
    // Full system access
    ADMIN_ONLY: ['ADMIN'],
    // Administrative + management
    MANAGEMENT: ['ADMIN', 'GERENCIA', 'DIRECCION'],
    // Billing and related
    BILLING: ['ADMIN', 'GERENCIA', 'FACTURACION'],
    // All roles can view dashboards
    VIEW_DASHBOARD: [
        'ADMIN',
        'GERENCIA',
        'DIRECCION',
        'FACTURACION',
        'COORDINADORA',
        'ADMISIONES',
    ],
    // Coordination roles
    COORDINATION: ['ADMIN', 'GERENCIA', 'DIRECCION', 'COORDINADORA'],
    // Admissions access
    ADMISSIONS: ['ADMIN', 'GERENCIA', 'DIRECCION', 'ADMISIONES'],
};
//# sourceMappingURL=rbac.middleware.js.map