"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enviarCorreo = enviarCorreo;
exports.escaparHtml = escaparHtml;
exports.plantillaRestablecerPassword = plantillaRestablecerPassword;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_js_1 = require("../config/env.js");
/** Tiempo máximo para conectar, saludar y enviar: un SMTP caído no debe dejar tareas colgadas. */
const TIMEOUT_MS = 10_000;
let transporte = null;
function obtenerTransporte() {
    if (!transporte) {
        transporte = nodemailer_1.default.createTransport({
            host: env_js_1.env.SMTP_HOST,
            port: env_js_1.env.SMTP_PORT,
            secure: env_js_1.env.SMTP_SECURE,
            auth: { user: env_js_1.env.SMTP_USER, pass: env_js_1.env.SMTP_PASS },
            connectionTimeout: TIMEOUT_MS,
            greetingTimeout: TIMEOUT_MS,
            socketTimeout: TIMEOUT_MS,
        });
    }
    return transporte;
}
/**
 * Envía un correo por SMTP. Lanza si falla: quien lo llama decide qué hacer (y qué registrar).
 * Aislado en su propio módulo para poder simularlo en las pruebas.
 */
async function enviarCorreo(correo) {
    await obtenerTransporte().sendMail({
        from: (0, env_js_1.remitenteCorreo)(),
        to: correo.para,
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
    });
}
/** Escapa un dato dinámico para incrustarlo en HTML (atributos y texto). */
function escaparHtml(valor) {
    return valor
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/** Cuerpo del correo de «Olvidé mi contraseña». `enlace` ya es la URL final. */
function plantillaRestablecerPassword(enlace, vigenciaMinutos) {
    const asunto = 'Restablece tu contraseña de Neurofic';
    const texto = [
        'Hola,',
        '',
        'Recibimos una solicitud para restablecer la contraseña de tu cuenta de Neurofic.',
        'Abre este enlace para elegir una nueva contraseña:',
        '',
        enlace,
        '',
        `El enlace caduca en ${vigenciaMinutos} minutos y solo se puede usar una vez.`,
        '',
        'Si no fuiste tú, ignora este mensaje; tu contraseña no cambia.',
        '',
        'Neurofic',
    ].join('\n');
    const href = escaparHtml(enlace);
    const html = `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:8px;padding:32px;">
            <tr>
              <td>
                <h1 style="margin:0 0 16px;font-size:20px;">Restablece tu contraseña</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">Recibimos una solicitud para restablecer la contraseña de tu cuenta de Neurofic.</p>
                <p style="margin:0 0 24px;">
                  <a href="${href}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:15px;">Elegir nueva contraseña</a>
                </p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4b5563;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:0 0 16px;font-size:13px;word-break:break-all;"><a href="${href}" style="color:#2563eb;">${href}</a></p>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#4b5563;">El enlace caduca en ${vigenciaMinutos} minutos y solo se puede usar una vez.</p>
                <p style="margin:0;font-size:13px;line-height:1.5;color:#4b5563;">Si no fuiste tú, ignora este mensaje; tu contraseña no cambia.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { asunto, texto, html };
}
//# sourceMappingURL=correo.service.js.map