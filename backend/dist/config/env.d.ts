import { z } from 'zod';
declare const envSchema: z.ZodObject<{
    DATABASE_URL: z.ZodString;
    JWT_SECRET: z.ZodString;
    JWT_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    REFRESH_TOKEN_EXPIRES_IN: z.ZodDefault<z.ZodString>;
    PORT: z.ZodDefault<z.ZodPipeline<z.ZodEffects<z.ZodString, number, string>, z.ZodNumber>>;
    NODE_ENV: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    CORS_ORIGIN: z.ZodDefault<z.ZodString>;
    LOG_LEVEL: z.ZodDefault<z.ZodEnum<["error", "warn", "info", "http", "verbose", "debug", "silly"]>>;
    /** URL pública de la app, sin barra final. ÚNICA base de los enlaces de los correos. */
    APP_URL: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>, string | undefined, string | undefined>;
    SMTP_HOST: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    SMTP_PORT: z.ZodPipeline<z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>, number, string | undefined>, z.ZodNumber>;
    /** `true` para 465 (TLS directo). Por defecto `false`: STARTTLS (587). */
    SMTP_SECURE: z.ZodEffects<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>, boolean, string | undefined>;
    SMTP_USER: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    SMTP_PASS: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    SMTP_FROM: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    REFRESH_TOKEN_EXPIRES_IN: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
    CORS_ORIGIN: string;
    LOG_LEVEL: "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";
    SMTP_PORT: number;
    SMTP_SECURE: boolean;
    APP_URL?: string | undefined;
    SMTP_HOST?: string | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASS?: string | undefined;
    SMTP_FROM?: string | undefined;
}, {
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN?: string | undefined;
    REFRESH_TOKEN_EXPIRES_IN?: string | undefined;
    PORT?: string | undefined;
    NODE_ENV?: "development" | "production" | "test" | undefined;
    CORS_ORIGIN?: string | undefined;
    LOG_LEVEL?: "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly" | undefined;
    APP_URL?: string | undefined;
    SMTP_HOST?: string | undefined;
    SMTP_PORT?: string | undefined;
    SMTP_SECURE?: string | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASS?: string | undefined;
    SMTP_FROM?: string | undefined;
}>;
type EnvConfig = z.infer<typeof envSchema>;
export declare const env: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_EXPIRES_IN: string;
    REFRESH_TOKEN_EXPIRES_IN: string;
    PORT: number;
    NODE_ENV: "development" | "production" | "test";
    CORS_ORIGIN: string;
    LOG_LEVEL: "error" | "warn" | "info" | "http" | "verbose" | "debug" | "silly";
    SMTP_PORT: number;
    SMTP_SECURE: boolean;
    APP_URL?: string | undefined;
    SMTP_HOST?: string | undefined;
    SMTP_USER?: string | undefined;
    SMTP_PASS?: string | undefined;
    SMTP_FROM?: string | undefined;
};
export type { EnvConfig };
/** ¿Hay SMTP suficiente para enviar correo? (servidor, usuario y contraseña). */
export declare function correoConfigurado(): boolean;
/** Remitente: `SMTP_FROM` o, por defecto, `Neurofic <SMTP_USER>`. */
export declare function remitenteCorreo(): string;
//# sourceMappingURL=env.d.ts.map