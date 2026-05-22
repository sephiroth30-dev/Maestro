import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import type { JwtPayload, AuthenticatedUser } from '../types/index.js';

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

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as unknown as JwtPayload;

    request.authenticatedUser = {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
    };
  } catch {
    await reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401,
    });
  }
}

export function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    done();
    return;
  }

  request.jwtVerify().then(() => {
    const payload = request.user as unknown as JwtPayload;
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
