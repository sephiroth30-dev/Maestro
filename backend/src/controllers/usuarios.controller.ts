import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { usuariosRepo } from '../repositories/usuarios.repo.js';
import { auditoriaRepo, ACCION } from '../repositories/auditoria.repo.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';

const BCRYPT_ROUNDS = 12;

const ROLES_VALIDOS = ['ADMIN', 'GERENCIA', 'DIRECCION', 'FACTURACION', 'COORDINADORA', 'ADMISIONES', 'RECURSOS_HUMANOS'] as const;

const MODULOS_VALIDOS = ['dashboard', 'reportes', 'honorarios', 'capacidad', 'auditoria', 'configuracion', 'aprobar'] as const;

const createSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Email inválido').max(191),
  rol: z.enum(ROLES_VALIDOS),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  modulos: z.array(z.enum(MODULOS_VALIDOS)).optional(),
});

const updateSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  email: z.string().email('Email inválido').max(191).optional(),
  rol: z.enum(ROLES_VALIDOS).optional(),
  modulos: z.array(z.enum(MODULOS_VALIDOS)).optional(),
  activo: z.boolean().optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), {
  message: 'Se requiere al menos un campo para actualizar',
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export async function usuariosRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/usuarios — list all users (ADMIN only)
  fastify.get(
    '/usuarios',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const usuarios = await usuariosRepo.listAll();
      return reply.send(
        usuarios.map((u) => ({
          id: u.id,
          nombre: u.nombre,
          email: u.email,
          rol: u.rol,
          modulos: u.modulos,
          activo: u.activo,
          createdAt: u.createdAt,
        }))
      );
    }
  );

  // POST /api/usuarios — create user (ADMIN only)
  fastify.post(
    '/usuarios',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const { nombre, email, rol, password, modulos } = parsed.data;

      const existing = await usuariosRepo.findByEmail(email);
      if (existing) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Ya existe un usuario con ese correo electrónico',
          statusCode: 409,
        });
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const usuario = await usuariosRepo.create({ nombre, email, passwordHash, rol, modulos });

      void auditoriaRepo.insert({ usuarioId: request.authenticatedUser.id, accion: ACCION.USUARIO_CREADO, entidadTipo: 'usuario', entidadId: usuario.id, ip: request.ip, detalle: { nombre, email, rol } }).catch(() => {});

      return reply.status(201).send({
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        modulos: usuario.modulos,
        activo: usuario.activo,
        createdAt: usuario.createdAt,
      });
    }
  );

  // PATCH /api/usuarios/:id — update user (ADMIN only)
  fastify.patch(
    '/usuarios/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      if (parsed.data.email) {
        const conflict = await usuariosRepo.findByEmailExcluding(parsed.data.email, id);
        if (conflict) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'Ya existe otro usuario con ese correo electrónico',
            statusCode: 409,
          });
        }
      }

      await usuariosRepo.update(id, parsed.data);
      void auditoriaRepo.insert({ usuarioId: request.authenticatedUser.id, accion: ACCION.USUARIO_ACTUALIZADO, entidadTipo: 'usuario', entidadId: id, ip: request.ip, detalle: parsed.data as Record<string, unknown> }).catch(() => {});
      return reply.status(200).send({ ok: true });
    }
  );

  // DELETE /api/usuarios/:id — soft delete (ADMIN only, cannot delete self)
  fastify.delete(
    '/usuarios/:id',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const selfId = request.authenticatedUser.id;

      if (id === selfId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No puedes eliminar tu propia cuenta',
          statusCode: 400,
        });
      }

      await usuariosRepo.softDelete(id);
      void auditoriaRepo.insert({ usuarioId: request.authenticatedUser.id, accion: ACCION.USUARIO_ELIMINADO, entidadTipo: 'usuario', entidadId: id, ip: request.ip }).catch(() => {});
      return reply.status(200).send({ ok: true });
    }
  );

  // POST /api/usuarios/:id/reset-password — admin resets any user's password
  fastify.post(
    '/usuarios/:id/reset-password',
    { preHandler: [requireAuth, requireRole('ADMIN')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = resetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues.map((i) => i.message).join(', '),
          statusCode: 400,
        });
      }

      const passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);
      await usuariosRepo.updatePassword(id, passwordHash);
      // Revoke all sessions so the user must re-login with the new password
      await usuariosRepo.revokeAllUserRefreshTokens(id);
      void auditoriaRepo.insert({ usuarioId: request.authenticatedUser.id, accion: ACCION.RESET_PASSWORD, entidadTipo: 'usuario', entidadId: id, ip: request.ip }).catch(() => {});
      return reply.status(200).send({ ok: true });
    }
  );
}
