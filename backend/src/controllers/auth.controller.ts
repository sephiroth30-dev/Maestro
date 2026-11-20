import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AuthService } from '../services/auth.service.js';
import {
  PasswordResetService,
  ResetPasswordError,
  RESET_MIN_PASSWORD,
  RESET_MAX_PASSWORD,
} from '../services/password-reset.service.js';
import { logger } from '../config/logger.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { usuariosRepo } from '../repositories/usuarios.repo.js';
import { auditoriaRepo, ACCION } from '../repositories/auditoria.repo.js';

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

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Ingresa un correo válido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'El enlace no es válido o ya caducó. Solicita uno nuevo.').max(512),
  newPassword: z
    .string()
    .min(RESET_MIN_PASSWORD, `La nueva contraseña debe tener al menos ${RESET_MIN_PASSWORD} caracteres`)
    .max(RESET_MAX_PASSWORD, `La nueva contraseña no puede superar ${RESET_MAX_PASSWORD} caracteres`),
});

/** Respuesta genérica de «olvidé mi contraseña»: idéntica exista o no el correo (anti-enumeración). */
const MSG_FORGOT_PASSWORD = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  const authService = new AuthService(fastify);
  const passwordResetService = new PasswordResetService();

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
    try {
      const result = await authService.login(email, password);
      void auditoriaRepo.insert({ usuarioId: result.usuario.id, accion: ACCION.LOGIN, ip: request.ip, detalle: { rol: result.usuario.rol } }).catch(() => {});
      await reply.status(200).send(result);
    } catch (err) {
      void auditoriaRepo.insert({ accion: ACCION.LOGIN_FALLIDO, ip: request.ip, detalle: { email } }).catch(() => {});
      throw err;
    }
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
    const { usuarioId } = await authService.logout(refreshToken);
    void auditoriaRepo.insert({ usuarioId, accion: ACCION.LOGOUT, ip: request.ip }).catch(() => {});
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

  // POST /api/auth/change-password — authenticated user changes their own password
  fastify.post(
    '/auth/change-password',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = z.object({
        currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
        newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
      }).safeParse(request.body);

      if (!parsed.success) {
        await reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
        return;
      }

      const userId = request.authenticatedUser.id;
      const usuario = await usuariosRepo.findById(userId);
      if (!usuario) {
        await reply.status(401).send({ error: 'Unauthorized', statusCode: 401 });
        return;
      }

      const valid = await bcrypt.compare(parsed.data.currentPassword, usuario.passwordHash);
      if (!valid) {
        await reply.status(400).send({
          error: 'Bad Request',
          message: 'La contraseña actual es incorrecta',
          statusCode: 400,
        });
        return;
      }

      const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await usuariosRepo.updatePassword(userId, newHash);
      void auditoriaRepo.insert({ usuarioId: userId, accion: ACCION.CAMBIO_PASSWORD, ip: request.ip }).catch(() => {});
      await reply.status(200).send({ ok: true });
    }
  );

  // POST /api/auth/forgot-password — pública. SIEMPRE 200 con el mismo cuerpo (exista o no el
  // correo, falle o no el SMTP) y sin esperar el envío: así ni el contenido ni el tiempo de
  // respuesta delatan si un correo está registrado. Límite: 5 por 15 min por IP.
  fastify.post(
    '/auth/forgot-password',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = forgotPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        const mensaje = parsed.error.issues[0]?.message ?? 'Solicitud no válida';
        await reply.status(400).send({ error: mensaje, message: mensaje, statusCode: 400 });
        return;
      }

      // Segundo plano: `solicitar` no lanza, pero el catch es el último cinturón.
      void passwordResetService.solicitar(parsed.data.email, request.ip).catch((err: unknown) => {
        logger.error('Restablecer contraseña: error inesperado en segundo plano', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
      await reply.status(200).send({ message: MSG_FORGOT_PASSWORD });
    }
  );

  // POST /api/auth/reset-password — pública. Cambia la contraseña con el token del correo; NO inicia
  // sesión. Cualquier fallo del token responde igual (400). Límite: 10 por 15 min por IP.
  fastify.post(
    '/auth/reset-password',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        const mensaje = parsed.error.issues[0]?.message ?? 'Solicitud no válida';
        await reply.status(400).send({ error: mensaje, message: mensaje, statusCode: 400 });
        return;
      }

      try {
        await passwordResetService.restablecer(parsed.data.token, parsed.data.newPassword, request.ip);
      } catch (err) {
        if (err instanceof ResetPasswordError) {
          await reply.status(400).send({ error: err.message, message: err.message, statusCode: 400 });
          return;
        }
        throw err;
      }
      await reply.status(200).send({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    }
  );
}
