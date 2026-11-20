/** Minutos de vigencia de un enlace de restablecimiento. */
export declare const RESET_VIGENCIA_MINUTOS = 30;
export interface SolicitudesRecientes {
    /** Solicitudes creadas en el último minuto (para el tope de 60 s entre correos). */
    ultimoMinuto: number;
    /** Solicitudes creadas en la última hora (para el tope por hora). */
    ultimaHora: number;
}
export interface CreatePasswordResetData {
    usuarioId: string;
    /** SHA-256 del token. El token en claro NUNCA llega aquí ni se guarda. */
    tokenHash: string;
    ip?: string | null;
}
export declare class PasswordResetsRepository {
    crear(data: CreatePasswordResetData): Promise<void>;
    /** Marca como usados todos los enlaces pendientes del usuario (el nuevo reemplaza a los anteriores). */
    invalidarPendientes(usuarioId: string): Promise<void>;
    /** Cuántas solicitudes tiene el usuario en el último minuto y en la última hora (usadas o no). */
    contarRecientes(usuarioId: string): Promise<SolicitudesRecientes>;
    /**
     * Consume el token de forma ATÓMICA: el `UPDATE` solo toca la fila si sigue sin usar y vigente,
     * así que con dos clics a la vez gana uno solo. Devuelve las filas afectadas: el llamador debe
     * exigir exactamente 1 antes de cambiar nada.
     */
    consumir(tokenHash: string): Promise<number>;
    usuarioDeToken(tokenHash: string): Promise<string | null>;
}
export declare const passwordResetsRepo: PasswordResetsRepository;
//# sourceMappingURL=password-resets.repo.d.ts.map