export interface CorreoSaliente {
    para: string;
    asunto: string;
    texto: string;
    html: string;
}
/**
 * Envía un correo por SMTP. Lanza si falla: quien lo llama decide qué hacer (y qué registrar).
 * Aislado en su propio módulo para poder simularlo en las pruebas.
 */
export declare function enviarCorreo(correo: CorreoSaliente): Promise<void>;
/** Escapa un dato dinámico para incrustarlo en HTML (atributos y texto). */
export declare function escaparHtml(valor: string): string;
/** Cuerpo del correo de «Olvidé mi contraseña». `enlace` ya es la URL final. */
export declare function plantillaRestablecerPassword(enlace: string, vigenciaMinutos: number): {
    asunto: string;
    texto: string;
    html: string;
};
//# sourceMappingURL=correo.service.d.ts.map