import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { usuariosRepo } from '../repositories/usuarios.repo.js';
import { passwordResetsRepo, RESET_VIGENCIA_MINUTOS } from '../repositories/password-resets.repo.js';
import { auditoriaRepo, ACCION } from '../repositories/auditoria.repo.js';
import { enviarCorreo, plantillaRestablecerPassword } from './correo.service.js';
import { env, correoConfigurado } from '../config/env.js';
import { logger } from '../config/logger.js';

const RESET_TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 12; // Igual que AuthService y el cambio de contraseña.

/** Tope de solicitudes por usuario: máximo 5 por hora (y mínimo 60 s entre una y otra, que aplica el repo). */
export const RESET_MAX_POR_HORA = 5;

export const RESET_MIN_PASSWORD = 8;
export const RESET_MAX_PASSWORD = 128;

/** Respuesta única para CUALQUIER token inexistente, usado, caducado o de un usuario inactivo. */
export const MSG_RESET_ENLACE_INVALIDO = 'El enlace no es válido o ya caducó. Solicita uno nuevo.';

/** Error 400 de restablecimiento (enlace inválido o contraseña no válida). */
export class ResetPasswordError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ResetPasswordError';
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Nombres (nunca valores) de lo que falta para poder enviar el correo. */
function variablesCorreoFaltantes(): string[] {
  const faltantes: string[] = [];
  if (!env.APP_URL || !/^https?:\/\//i.test(env.APP_URL)) faltantes.push('APP_URL');
  if (!correoConfigurado()) faltantes.push('SMTP_HOST/SMTP_USER/SMTP_PASS');
  return faltantes;
}

export class PasswordResetService {
  /**
   * «Olvidé mi contraseña». NUNCA lanza y no distingue casos hacia afuera: el controlador responde
   * lo mismo exista o no el correo, y lo llama sin esperarlo (segundo plano). Si el usuario no
   * existe, está inactivo o borrado, no hace nada; si pidió otro enlace hace menos de 60 s o ya
   * pidió 5 en la última hora, tampoco. El enlace se construye SOLO con APP_URL (nunca con el
   * Host de la petición) y ni el token ni el enlace se registran en ningún lado.
   */
  async solicitar(email: string, ip: string | null): Promise<void> {
    try {
      await this.procesarSolicitud(email, ip);
    } catch (err) {
      logger.error('Restablecer contraseña: no se pudo procesar la solicitud', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async procesarSolicitud(email: string, ip: string | null): Promise<void> {
    const faltantes = variablesCorreoFaltantes();
    if (faltantes.length > 0) {
      logger.warn('Restablecer contraseña: no se envía el correo porque falta configuración', {
        faltantes,
      });
      return;
    }

    // findByEmail solo devuelve usuarios con activo=1 y deleted_at IS NULL.
    const usuario = await usuariosRepo.findByEmail(email);
    if (!usuario) return;

    const recientes = await passwordResetsRepo.contarRecientes(usuario.id);
    if (recientes.ultimoMinuto > 0 || recientes.ultimaHora >= RESET_MAX_POR_HORA) {
      logger.info('Restablecer contraseña: solicitud omitida por límite', { usuarioId: usuario.id });
      return;
    }

    const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
    // El nuevo enlace reemplaza a los anteriores; en BD solo queda el hash del token.
    await passwordResetsRepo.invalidarPendientes(usuario.id);
    await passwordResetsRepo.crear({ usuarioId: usuario.id, tokenHash: hashToken(token), ip });

    void auditoriaRepo
      .insert({
        usuarioId: usuario.id,
        accion: ACCION.SOLICITUD_RESET_PASSWORD,
        ip,
        detalle: { email: usuario.email },
      })
      .catch(() => {});

    const enlace = `${env.APP_URL}/restablecer-contrasena?token=${token}`;
    const plantilla = plantillaRestablecerPassword(enlace, RESET_VIGENCIA_MINUTOS);
    try {
      await enviarCorreo({ para: usuario.email, ...plantilla });
      logger.info('Restablecer contraseña: correo enviado', { usuarioId: usuario.id });
    } catch (err) {
      logger.error('Restablecer contraseña: falló el envío del correo', {
        usuarioId: usuario.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Fija la nueva contraseña con el token del correo. NO inicia sesión. Cualquier fallo del
   * token (desconocido, caducado, usado, usuario inactivo) lanza el mismo error.
   */
  async restablecer(token: string, newPassword: string, ip: string | null): Promise<void> {
    // La contraseña se valida ANTES de consumir el token: una contraseña floja no quema el enlace.
    if (newPassword.length < RESET_MIN_PASSWORD) {
      throw new ResetPasswordError(`La nueva contraseña debe tener al menos ${RESET_MIN_PASSWORD} caracteres`);
    }
    if (newPassword.length > RESET_MAX_PASSWORD) {
      throw new ResetPasswordError(`La nueva contraseña no puede superar ${RESET_MAX_PASSWORD} caracteres`);
    }

    const tokenHash = hashToken(token);

    // Consumo atómico: el UPDATE lo gana UNA sola petición. Nada cambia antes de comprobarlo.
    const filas = await passwordResetsRepo.consumir(tokenHash);
    if (filas !== 1) {
      throw new ResetPasswordError(MSG_RESET_ENLACE_INVALIDO);
    }

    const usuarioId = await passwordResetsRepo.usuarioDeToken(tokenHash);
    const usuario = usuarioId ? await usuariosRepo.findById(usuarioId) : null;
    if (!usuario) {
      throw new ResetPasswordError(MSG_RESET_ENLACE_INVALIDO);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await usuariosRepo.updatePassword(usuario.id, passwordHash);
    // Cualquier otro enlace pendiente deja de servir y se cierran TODAS las sesiones abiertas.
    await passwordResetsRepo.invalidarPendientes(usuario.id);
    await usuariosRepo.revokeAllUserRefreshTokens(usuario.id);

    void auditoriaRepo
      .insert({ usuarioId: usuario.id, accion: ACCION.RESET_PASSWORD_AUTOSERVICIO, ip })
      .catch(() => {});
    logger.info('Contraseña restablecida por enlace de correo', { usuarioId: usuario.id });
  }
}
