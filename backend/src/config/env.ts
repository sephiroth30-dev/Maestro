import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

/** Variable opcional: vacía o solo espacios (p. ej. `SMTP_HOST=` en el .env) cuenta como no definida. */
const opcional = z
  .string()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : undefined;
  });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().min(1).max(65535))
    .default('3001'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  CORS_ORIGIN: z.string().min(1).default('*'),
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
    .default('info'),
  // ─── Correo saliente (restablecer contraseña). Todo opcional: sin esto el
  // restablecimiento no envía correos, pero el resto de la app funciona igual. ───
  /** URL pública de la app, sin barra final. ÚNICA base de los enlaces de los correos. */
  APP_URL: opcional.transform((v) => (v ? v.replace(/\/+$/, '') : undefined)),
  SMTP_HOST: opcional,
  SMTP_PORT: opcional
    .transform((v) => (v ? parseInt(v, 10) : 587))
    .pipe(z.number().int().min(1).max(65535)),
  /** `true` para 465 (TLS directo). Por defecto `false`: STARTTLS (587). */
  SMTP_SECURE: opcional.transform((v) => v?.toLowerCase() === 'true'),
  SMTP_USER: opcional,
  SMTP_PASS: opcional,
  SMTP_FROM: opcional,
});

type EnvConfig = z.infer<typeof envSchema>;

function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }

  return result.data;
}

export const env = validateEnv();
export type { EnvConfig };

/** ¿Hay SMTP suficiente para enviar correo? (servidor, usuario y contraseña). */
export function correoConfigurado(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

/** Remitente: `SMTP_FROM` o, por defecto, `Neurofic <SMTP_USER>`. */
export function remitenteCorreo(): string {
  return env.SMTP_FROM ?? `Neurofic <${env.SMTP_USER ?? ''}>`;
}
