"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetService = exports.ResetPasswordError = exports.MSG_RESET_ENLACE_INVALIDO = exports.RESET_MAX_PASSWORD = exports.RESET_MIN_PASSWORD = exports.RESET_MAX_POR_HORA = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const usuarios_repo_js_1 = require("../repositories/usuarios.repo.js");
const password_resets_repo_js_1 = require("../repositories/password-resets.repo.js");
const auditoria_repo_js_1 = require("../repositories/auditoria.repo.js");
const correo_service_js_1 = require("./correo.service.js");
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../config/logger.js");
const RESET_TOKEN_BYTES = 32;
const BCRYPT_ROUNDS = 12; // Igual que AuthService y el cambio de contraseña.
/** Tope de solicitudes por usuario: máximo 5 por hora (y mínimo 60 s entre una y otra, que aplica el repo). */
exports.RESET_MAX_POR_HORA = 5;
exports.RESET_MIN_PASSWORD = 8;
exports.RESET_MAX_PASSWORD = 128;
/** Respuesta única para CUALQUIER token inexistente, usado, caducado o de un usuario inactivo. */
exports.MSG_RESET_ENLACE_INVALIDO = 'El enlace no es válido o ya caducó. Solicita uno nuevo.';
/** Error 400 de restablecimiento (enlace inválido o contraseña no válida). */
class ResetPasswordError extends Error {
    statusCode = 400;
    constructor(message) {
        super(message);
        this.name = 'ResetPasswordError';
    }
}
exports.ResetPasswordError = ResetPasswordError;
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
/** Nombres (nunca valores) de lo que falta para poder enviar el correo. */
function variablesCorreoFaltantes() {
    const faltantes = [];
    if (!env_js_1.env.APP_URL || !/^https?:\/\//i.test(env_js_1.env.APP_URL))
        faltantes.push('APP_URL');
    if (!(0, env_js_1.correoConfigurado)())
        faltantes.push('SMTP_HOST/SMTP_USER/SMTP_PASS');
    return faltantes;
}
class PasswordResetService {
    /**
     * «Olvidé mi contraseña». NUNCA lanza y no distingue casos hacia afuera: el controlador responde
     * lo mismo exista o no el correo, y lo llama sin esperarlo (segundo plano). Si el usuario no
     * existe, está inactivo o borrado, no hace nada; si pidió otro enlace hace menos de 60 s o ya
     * pidió 5 en la última hora, tampoco. El enlace se construye SOLO con APP_URL (nunca con el
     * Host de la petición) y ni el token ni el enlace se registran en ningún lado.
     */
    async solicitar(email, ip) {
        try {
            await this.procesarSolicitud(email, ip);
        }
        catch (err) {
            logger_js_1.logger.error('Restablecer contraseña: no se pudo procesar la solicitud', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    async procesarSolicitud(email, ip) {
        const faltantes = variablesCorreoFaltantes();
        if (faltantes.length > 0) {
            logger_js_1.logger.warn('Restablecer contraseña: no se envía el correo porque falta configuración', {
                faltantes,
            });
            return;
        }
        // findByEmail solo devuelve usuarios con activo=1 y deleted_at IS NULL.
        const usuario = await usuarios_repo_js_1.usuariosRepo.findByEmail(email);
        if (!usuario)
            return;
        const recientes = await password_resets_repo_js_1.passwordResetsRepo.contarRecientes(usuario.id);
        if (recientes.ultimoMinuto > 0 || recientes.ultimaHora >= exports.RESET_MAX_POR_HORA) {
            logger_js_1.logger.info('Restablecer contraseña: solicitud omitida por límite', { usuarioId: usuario.id });
            return;
        }
        const token = crypto_1.default.randomBytes(RESET_TOKEN_BYTES).toString('hex');
        // El nuevo enlace reemplaza a los anteriores; en BD solo queda el hash del token.
        await password_resets_repo_js_1.passwordResetsRepo.invalidarPendientes(usuario.id);
        await password_resets_repo_js_1.passwordResetsRepo.crear({ usuarioId: usuario.id, tokenHash: hashToken(token), ip });
        void auditoria_repo_js_1.auditoriaRepo
            .insert({
            usuarioId: usuario.id,
            accion: auditoria_repo_js_1.ACCION.SOLICITUD_RESET_PASSWORD,
            ip,
            detalle: { email: usuario.email },
        })
            .catch(() => { });
        const enlace = `${env_js_1.env.APP_URL}/restablecer-contrasena?token=${token}`;
        const plantilla = (0, correo_service_js_1.plantillaRestablecerPassword)(enlace, password_resets_repo_js_1.RESET_VIGENCIA_MINUTOS);
        try {
            await (0, correo_service_js_1.enviarCorreo)({ para: usuario.email, ...plantilla });
            logger_js_1.logger.info('Restablecer contraseña: correo enviado', { usuarioId: usuario.id });
        }
        catch (err) {
            logger_js_1.logger.error('Restablecer contraseña: falló el envío del correo', {
                usuarioId: usuario.id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    /**
     * Fija la nueva contraseña con el token del correo. NO inicia sesión. Cualquier fallo del
     * token (desconocido, caducado, usado, usuario inactivo) lanza el mismo error.
     */
    async restablecer(token, newPassword, ip) {
        // La contraseña se valida ANTES de consumir el token: una contraseña floja no quema el enlace.
        if (newPassword.length < exports.RESET_MIN_PASSWORD) {
            throw new ResetPasswordError(`La nueva contraseña debe tener al menos ${exports.RESET_MIN_PASSWORD} caracteres`);
        }
        if (newPassword.length > exports.RESET_MAX_PASSWORD) {
            throw new ResetPasswordError(`La nueva contraseña no puede superar ${exports.RESET_MAX_PASSWORD} caracteres`);
        }
        const tokenHash = hashToken(token);
        // Consumo atómico: el UPDATE lo gana UNA sola petición. Nada cambia antes de comprobarlo.
        const filas = await password_resets_repo_js_1.passwordResetsRepo.consumir(tokenHash);
        if (filas !== 1) {
            throw new ResetPasswordError(exports.MSG_RESET_ENLACE_INVALIDO);
        }
        const usuarioId = await password_resets_repo_js_1.passwordResetsRepo.usuarioDeToken(tokenHash);
        const usuario = usuarioId ? await usuarios_repo_js_1.usuariosRepo.findById(usuarioId) : null;
        if (!usuario) {
            throw new ResetPasswordError(exports.MSG_RESET_ENLACE_INVALIDO);
        }
        const passwordHash = await bcryptjs_1.default.hash(newPassword, BCRYPT_ROUNDS);
        await usuarios_repo_js_1.usuariosRepo.updatePassword(usuario.id, passwordHash);
        // Cualquier otro enlace pendiente deja de servir y se cierran TODAS las sesiones abiertas.
        await password_resets_repo_js_1.passwordResetsRepo.invalidarPendientes(usuario.id);
        await usuarios_repo_js_1.usuariosRepo.revokeAllUserRefreshTokens(usuario.id);
        void auditoria_repo_js_1.auditoriaRepo
            .insert({ usuarioId: usuario.id, accion: auditoria_repo_js_1.ACCION.RESET_PASSWORD_AUTOSERVICIO, ip })
            .catch(() => { });
        logger_js_1.logger.info('Contraseña restablecida por enlace de correo', { usuarioId: usuario.id });
    }
}
exports.PasswordResetService = PasswordResetService;
//# sourceMappingURL=password-reset.service.js.map