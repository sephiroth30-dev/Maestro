"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
async function requireAuth(request, reply) {
    try {
        await request.jwtVerify();
        const payload = request.user;
        request.authenticatedUser = {
            id: payload.sub,
            email: payload.email,
            rol: payload.rol,
        };
    }
    catch {
        await reply.status(401).send({
            error: 'Unauthorized',
            message: 'Authentication required',
            statusCode: 401,
        });
    }
}
function optionalAuth(request, _reply, done) {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        done();
        return;
    }
    request.jwtVerify().then(() => {
        const payload = request.user;
        request.authenticatedUser = {
            id: payload.sub,
            email: payload.email,
            rol: payload.rol,
        };
        done();
    }).catch(() => {
        done();
    });
}
//# sourceMappingURL=auth.middleware.js.map