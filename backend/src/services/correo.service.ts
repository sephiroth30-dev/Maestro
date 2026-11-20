import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env, remitenteCorreo } from '../config/env.js';

/** Tiempo máximo para conectar, saludar y enviar: un SMTP caído no debe dejar tareas colgadas. */
const TIMEOUT_MS = 10_000;

export interface CorreoSaliente {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

let transporte: Transporter | null = null;

function obtenerTransporte(): Transporter {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
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
export async function enviarCorreo(correo: CorreoSaliente): Promise<void> {
  await obtenerTransporte().sendMail({
    from: remitenteCorreo(),
    to: correo.para,
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html,
  });
}

/** Escapa un dato dinámico para incrustarlo en HTML (atributos y texto). */
export function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Cuerpo del correo de «Olvidé mi contraseña». `enlace` ya es la URL final. */
export function plantillaRestablecerPassword(
  enlace: string,
  vigenciaMinutos: number
): { asunto: string; texto: string; html: string } {
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
