import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AuthService } from '../services/auth.service.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify);

  // POST /api/auth/login — rate limited: 5 requests per minute per IP
  fastify.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Invalid request body',
        statusCode: 400,
      });
      return;
    }

    const { email, password } = parsed.data;
    const result = await authService.login(email, password);
    await reply.status(200).send(result);
    }
  );

  // POST /api/auth/refresh
  fastify.post('/auth/refresh', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Invalid request body',
        statusCode: 400,
      });
      return;
    }

    const { refreshToken } = parsed.data;
    const result = await authService.refresh(refreshToken);
    await reply.status(200).send(result);
  });

  // POST /api/auth/logout
  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const parsed = logoutSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.status(400).send({
        error: 'Bad Request',
        message: parsed.error.issues[0]?.message ?? 'Invalid request body',
        statusCode: 400,
      });
      return;
    }

    const { refreshToken } = parsed.data;
    await authService.logout(refreshToken);
    await reply.status(200).send({ message: 'Logged out successfully' });
  });

  // GET /api/auth/me
  fastify.get(
    '/auth/me',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const usuario = await authService.getMe(request.authenticatedUser.id);
      await reply.status(200).send(usuario);
    }
  );
}
