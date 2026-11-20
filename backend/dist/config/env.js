"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.correoConfigurado = correoConfigurado;
exports.remitenteCorreo = remitenteCorreo;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/** Variable opcional: vacía o solo espacios (p. ej. `SMTP_HOST=` en el .env) cuenta como no definida. */
const opcional = zod_1.z
    .string()
    .optional()
    .transform((v) => {
    const t = v?.trim();
    return t ? t : undefined;
});
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: zod_1.z
        .string()
        .min(32, 'JWT_SECRET must be at least 32 characters long'),
    JWT_EXPIRES_IN: zod_1.z.string().default('15m'),
    REFRESH_TOKEN_EXPIRES_IN: zod_1.z.string().default('7d'),
    PORT: zod_1.z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(zod_1.z.number().min(1).max(65535))
        .default('3001'),
    NODE_ENV: zod_1.z
        .enum(['development', 'production', 'test'])
        .default('development'),
    CORS_ORIGIN: zod_1.z.string().min(1).default('*'),
    LOG_LEVEL: zod_1.z
        .enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'])
        .default('info'),
    // ─── Correo saliente (restablecer contraseña). Todo opcional: sin esto el
    // restablecimiento no envía correos, pero el resto de la app funciona igual. ───
    /** URL pública de la app, sin barra final. ÚNICA base de los enlaces de los correos. */
    APP_URL: opcional.transform((v) => (v ? v.replace(/\/+$/, '') : undefined)),
    SMTP_HOST: opcional,
    SMTP_PORT: opcional
        .transform((v) => (v ? parseInt(v, 10) : 587))
        .pipe(zod_1.z.number().int().min(1).max(65535)),
    /** `true` para 465 (TLS directo). Por defecto `false`: STARTTLS (587). */
    SMTP_SECURE: opcional.transform((v) => v?.toLowerCase() === 'true'),
    SMTP_USER: opcional,
    SMTP_PASS: opcional,
    SMTP_FROM: opcional,
});
function validateEnv() {
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
exports.env = validateEnv();
/** ¿Hay SMTP suficiente para enviar correo? (servidor, usuario y contraseña). */
function correoConfigurado() {
    return Boolean(exports.env.SMTP_HOST && exports.env.SMTP_USER && exports.env.SMTP_PASS);
}
/** Remitente: `SMTP_FROM` o, por defecto, `Neurofic <SMTP_USER>`. */
function remitenteCorreo() {
    return exports.env.SMTP_FROM ?? `Neurofic <${exports.env.SMTP_USER ?? ''}>`;
}
//# sourceMappingURL=env.js.map