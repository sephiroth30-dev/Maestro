/** Tope de solicitudes por usuario: máximo 5 por hora (y mínimo 60 s entre una y otra, que aplica el repo). */
export declare const RESET_MAX_POR_HORA = 5;
export declare const RESET_MIN_PASSWORD = 8;
export declare const RESET_MAX_PASSWORD = 128;
/** Respuesta única para CUALQUIER token inexistente, usado, caducado o de un usuario inactivo. */
export declare const MSG_RESET_ENLACE_INVALIDO = "El enlace no es v\u00E1lido o ya caduc\u00F3. Solicita uno nuevo.";
/** Error 400 de restablecimiento (enlace inválido o contraseña no válida). */
export declare class ResetPasswordError extends Error {
    readonly statusCode = 400;
    constructor(message: string);
}
export declare class PasswordResetService {
    /**
     * «Olvidé mi contraseña». NUNCA lanza y no distingue casos hacia afuera: el controlador responde
     * lo mismo exista o no el correo, y lo llama sin esperarlo (segundo plano). Si el usuario no
     * existe, está inactivo o borrado, no hace nada; si pidió otro enlace hace menos de 60 s o ya
     * pidió 5 en la última hora, tampoco. El enlace se construye SOLO con APP_URL (nunca con el
     * Host de la petición) y ni el token ni el enlace se registran en ningún lado.
     */
    solicitar(email: string, ip: string | null): Promise<void>;
    private procesarSolicitud;
    /**
     * Fija la nueva contraseña con el token del correo. NO inicia sesión. Cualquier fallo del
     * token (desconocido, caducado, usado, usuario inactivo) lanza el mismo error.
     */
    restablecer(token: string, newPassword: string, ip: string | null): Promise<void>;
}
//# sourceMappingURL=password-reset.service.d.ts.map