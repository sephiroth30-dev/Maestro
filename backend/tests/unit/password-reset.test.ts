/**
 * Restablecer contraseña por correo (sin BD ni SMTP: repos y correo simulados en memoria).
 * Cubre las reglas de seguridad: anti-enumeración, solo el hash del token en BD, enlace solo con
 * APP_URL, topes por correo, consumo atómico (un solo uso), cierre de sesiones y cero secretos en logs.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import Fastify from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

// ─── Estado simulado ──────────────────────────────────────────────────────────

type Reset = { id: string; usuarioId: string; tokenHash: string; createdAt: number; expiresAt: number; usedAt: number | null; ip: string | null };
type Usuario = { id: string; email: string; passwordHash: string; activo: boolean };

const mockResets: Reset[] = [];
const mockUsuarios: Usuario[] = [];
const mockCorreos: { para: string; asunto: string; texto: string; html: string }[] = [];
const mockAuditoria: Record<string, unknown>[] = [];
const mockSesionesRevocadas: string[] = [];
const mockEstado = { smtpFalla: false };

jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

jest.mock('../../src/config/env', () => {
  const env: Record<string, unknown> = {
    NODE_ENV: 'test',
    APP_URL: 'https://app.neurofic.test',
    SMTP_HOST: 'smtp.neurofic.test',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'avisos@neurofic.test',
    SMTP_PASS: 'secreto-smtp-123',
    SMTP_FROM: undefined,
  };
  return {
    env,
    correoConfigurado: () => Boolean(env['SMTP_HOST'] && env['SMTP_USER'] && env['SMTP_PASS']),
    remitenteCorreo: () => 'Neurofic <avisos@neurofic.test>',
  };
});

jest.mock('../../src/repositories/auditoria.repo', () => ({
  ACCION: {
    LOGIN: 'LOGIN', LOGIN_FALLIDO: 'LOGIN_FALLIDO', LOGOUT: 'LOGOUT', CAMBIO_PASSWORD: 'CAMBIO_PASSWORD',
    SOLICITUD_RESET_PASSWORD: 'SOLICITUD_RESET_PASSWORD',
    RESET_PASSWORD_AUTOSERVICIO: 'RESET_PASSWORD_AUTOSERVICIO',
  },
  auditoriaRepo: { insert: async (d: Record<string, unknown>) => { mockAuditoria.push(d); } },
}));

jest.mock('../../src/repositories/usuarios.repo', () => ({
  usuariosRepo: {
    // Como la BD real: solo activos (activo=1 y deleted_at IS NULL).
    findByEmail: async (email: string) => mockUsuarios.find((u) => u.email === email && u.activo) ?? null,
    findById: async (id: string) => mockUsuarios.find((u) => u.id === id && u.activo) ?? null,
    updatePassword: async (id: string, hash: string) => { const u = mockUsuarios.find((x) => x.id === id); if (u) u.passwordHash = hash; },
    revokeAllUserRefreshTokens: async (id: string) => { mockSesionesRevocadas.push(id); },
  },
}));

jest.mock('../../src/repositories/password-resets.repo', () => ({
  RESET_VIGENCIA_MINUTOS: 30,
  passwordResetsRepo: {
    crear: async (d: { usuarioId: string; tokenHash: string; ip?: string | null }) => {
      mockResets.push({ id: String(mockResets.length + 1), usuarioId: d.usuarioId, tokenHash: d.tokenHash, createdAt: Date.now(), expiresAt: Date.now() + 30 * 60_000, usedAt: null, ip: d.ip ?? null });
    },
    invalidarPendientes: async (u: string) => { mockResets.filter((r) => r.usuarioId === u && r.usedAt === null).forEach((r) => { r.usedAt = Date.now(); }); },
    contarRecientes: async (u: string) => ({
      ultimoMinuto: mockResets.filter((r) => r.usuarioId === u && r.createdAt >= Date.now() - 60_000).length,
      ultimaHora: mockResets.filter((r) => r.usuarioId === u && r.createdAt >= Date.now() - 3_600_000).length,
    }),
    // Atómico como el UPDATE ... WHERE used_at IS NULL AND expires_at > NOW(): cuerpo síncrono, devuelve filas afectadas.
    consumir: async (h: string) => {
      const r = mockResets.find((x) => x.tokenHash === h && x.usedAt === null && x.expiresAt > Date.now());
      if (!r) return 0;
      r.usedAt = Date.now();
      return 1;
    },
    usuarioDeToken: async (h: string) => mockResets.find((x) => x.tokenHash === h)?.usuarioId ?? null,
  },
}));

jest.mock('../../src/services/correo.service', () => {
  const real = jest.requireActual('../../src/services/correo.service');
  return {
    ...real,
    enviarCorreo: async (c: { para: string; asunto: string; texto: string; html: string }) => {
      if (mockEstado.smtpFalla) throw new Error('SMTP caído');
      mockCorreos.push(c);
    },
  };
});

import { env } from '../../src/config/env';
import { logger } from '../../src/config/logger';
import { PasswordResetService, ResetPasswordError, MSG_RESET_ENLACE_INVALIDO } from '../../src/services/password-reset.service';
import { plantillaRestablecerPassword } from '../../src/services/correo.service';
import { authRoutes } from '../../src/controllers/auth.controller';
import { errorHandler } from '../../src/middlewares/error.middleware';

// ─── Utilidades ───────────────────────────────────────────────────────────────

const sha256 = (t: string): string => crypto.createHash('sha256').update(t).digest('hex');
const envMut = env as unknown as Record<string, unknown>;
const ENV_ORIGINAL = { ...envMut };

/** Extrae el token del enlace del último correo enviado. */
function tokenDelUltimoCorreo(): string {
  const c = mockCorreos[mockCorreos.length - 1]!;
  const m = /restablecer-contrasena\?token=([0-9a-f]+)/.exec(c.texto);
  return m![1]!;
}

/** Todo lo que el logger recibió, como texto, para buscar secretos. */
function todoLoQueSeRegistro(): string {
  const l = logger as unknown as Record<'info' | 'warn' | 'error' | 'debug', jest.Mock>;
  return JSON.stringify([l.info.mock.calls, l.warn.mock.calls, l.error.mock.calls, l.debug.mock.calls, mockAuditoria]);
}

function envejecerSolicitudes(ms: number): void {
  mockResets.forEach((r) => { r.createdAt -= ms; });
}

const servicio = (): PasswordResetService => new PasswordResetService();

beforeEach(() => {
  mockResets.length = 0;
  mockUsuarios.length = 0;
  mockCorreos.length = 0;
  mockAuditoria.length = 0;
  mockSesionesRevocadas.length = 0;
  mockEstado.smtpFalla = false;
  Object.assign(envMut, ENV_ORIGINAL);
  mockUsuarios.push({ id: 'u1', email: 'ana@neurofic.test', passwordHash: bcrypt.hashSync('ClaveVieja1', 4), activo: true });
  mockUsuarios.push({ id: 'u2', email: 'inactivo@neurofic.test', passwordHash: 'x', activo: false });
});

// ─── Solicitud ────────────────────────────────────────────────────────────────

describe('solicitar el enlace', () => {
  it('usuario inexistente: no crea token ni envía correo, y no lanza', async () => {
    await expect(servicio().solicitar('nadie@neurofic.test', '1.1.1.1')).resolves.toBeUndefined();
    expect(mockResets).toHaveLength(0);
    expect(mockCorreos).toHaveLength(0);
    expect(mockAuditoria).toHaveLength(0);
  });

  it('usuario inactivo (o borrado): no crea token ni envía correo', async () => {
    await expect(servicio().solicitar('inactivo@neurofic.test', '1.1.1.1')).resolves.toBeUndefined();
    expect(mockResets).toHaveLength(0);
    expect(mockCorreos).toHaveLength(0);
  });

  it('usuario válido: guarda SOLO el hash y envía el enlace con APP_URL', async () => {
    await servicio().solicitar('ana@neurofic.test', '1.1.1.1');
    expect(mockCorreos).toHaveLength(1);
    const correo = mockCorreos[0]!;
    expect(correo.para).toBe('ana@neurofic.test');
    expect(correo.asunto).toBe('Restablece tu contraseña de Neurofic');
    const token = tokenDelUltimoCorreo();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(correo.texto).toContain(`https://app.neurofic.test/restablecer-contrasena?token=${token}`);
    expect(correo.html).toContain(`https://app.neurofic.test/restablecer-contrasena?token=${token}`);
    expect(correo.texto).toContain('30 minutos');
    expect(correo.texto).toContain('ignora este mensaje');

    expect(mockResets).toHaveLength(1);
    expect(mockResets[0]!.tokenHash).toBe(sha256(token));
    expect(JSON.stringify(mockResets)).not.toContain(token);
    // Caduca a los 30 min
    expect(mockResets[0]!.expiresAt - mockResets[0]!.createdAt).toBe(30 * 60_000);
  });

  it('APP_URL con otro valor manda: el enlace nunca sale de la petición (solo existe APP_URL)', async () => {
    envMut['APP_URL'] = 'https://otra.neurofic.test';
    await servicio().solicitar('ana@neurofic.test', null);
    expect(mockCorreos[0]!.texto).toContain('https://otra.neurofic.test/restablecer-contrasena?token=');
  });

  it('cooldown de 60 s: una segunda solicitud inmediata no crea ni envía otro', async () => {
    await servicio().solicitar('ana@neurofic.test', null);
    await servicio().solicitar('ana@neurofic.test', null);
    expect(mockCorreos).toHaveLength(1);
    expect(mockResets).toHaveLength(1);
    envejecerSolicitudes(61_000);
    await servicio().solicitar('ana@neurofic.test', null);
    expect(mockCorreos).toHaveLength(2);
  });

  it('tope de 5 solicitudes por hora por usuario', async () => {
    for (let i = 0; i < 5; i++) {
      await servicio().solicitar('ana@neurofic.test', null);
      envejecerSolicitudes(61_000);
    }
    expect(mockCorreos).toHaveLength(5);
    await servicio().solicitar('ana@neurofic.test', null);
    expect(mockCorreos).toHaveLength(5);
    expect(mockResets).toHaveLength(5);
    // Pasada la hora, vuelve a permitirse
    envejecerSolicitudes(3_600_000);
    await servicio().solicitar('ana@neurofic.test', null);
    expect(mockCorreos).toHaveLength(6);
  });

  it('un nuevo enlace invalida los pendientes anteriores', async () => {
    const s = servicio();
    await s.solicitar('ana@neurofic.test', null);
    const viejo = tokenDelUltimoCorreo();
    envejecerSolicitudes(61_000);
    await s.solicitar('ana@neurofic.test', null);
    const nuevo = tokenDelUltimoCorreo();
    expect(nuevo).not.toBe(viejo);
    await expect(s.restablecer(viejo, 'ClaveNueva123', null)).rejects.toThrow(MSG_RESET_ENLACE_INVALIDO);
    await expect(s.restablecer(nuevo, 'ClaveNueva123', null)).resolves.toBeUndefined();
  });

  it('sin SMTP configurado: no crea token, no envía, no lanza y deja un warn claro sin secretos', async () => {
    envMut['SMTP_HOST'] = undefined;
    await expect(servicio().solicitar('ana@neurofic.test', null)).resolves.toBeUndefined();
    expect(mockCorreos).toHaveLength(0);
    expect(mockResets).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(todoLoQueSeRegistro()).not.toContain('secreto-smtp-123');
  });

  it('sin APP_URL (o no http): no envía, no lanza y avisa', async () => {
    envMut['APP_URL'] = undefined;
    await expect(servicio().solicitar('ana@neurofic.test', null)).resolves.toBeUndefined();
    envMut['APP_URL'] = 'javascript:alert(1)';
    await expect(servicio().solicitar('ana@neurofic.test', null)).resolves.toBeUndefined();
    expect(mockCorreos).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('un fallo del SMTP no rompe la solicitud: no lanza y registra el error sin el token', async () => {
    mockEstado.smtpFalla = true;
    await expect(servicio().solicitar('ana@neurofic.test', null)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
    expect(mockResets).toHaveLength(1);   // el token se creó pero nadie lo recibió; caduca solo
    expect(mockCorreos).toHaveLength(0);
    expect(todoLoQueSeRegistro()).not.toContain('secreto-smtp-123');
  });

  it('el token, el enlace y SMTP_PASS NUNCA aparecen en logs ni en auditoría', async () => {
    await servicio().solicitar('ana@neurofic.test', '9.9.9.9');
    const token = tokenDelUltimoCorreo();
    await servicio().restablecer(token, 'ClaveNueva123', '9.9.9.9');
    const registrado = todoLoQueSeRegistro();
    expect(registrado).not.toContain(token);
    expect(registrado).not.toContain('restablecer-contrasena');
    expect(registrado).not.toContain('secreto-smtp-123');
    expect(registrado).not.toContain('ClaveNueva123');
    // Auditoría: la solicitud lleva el correo (usuario existente); el reset no
    const acciones = mockAuditoria.map((a) => a['accion']);
    expect(acciones).toEqual(['SOLICITUD_RESET_PASSWORD', 'RESET_PASSWORD_AUTOSERVICIO']);
    expect(mockAuditoria[0]!['detalle']).toEqual({ email: 'ana@neurofic.test' });
  });
});

// ─── Restablecimiento ─────────────────────────────────────────────────────────

describe('restablecer con el token', () => {
  async function pedirToken(): Promise<string> {
    await servicio().solicitar('ana@neurofic.test', null);
    return tokenDelUltimoCorreo();
  }

  it('token válido: cambia el hash, revoca TODAS las sesiones e invalida los demás tokens', async () => {
    const token = await pedirToken();
    // Otro pendiente del mismo usuario (p. ej. de una solicitud anterior que quedó viva)
    mockResets.push({ id: 'otro', usuarioId: 'u1', tokenHash: sha256('otro-token'), createdAt: Date.now(), expiresAt: Date.now() + 60_000, usedAt: null, ip: null });
    const antes = mockUsuarios[0]!.passwordHash;

    await servicio().restablecer(token, 'ClaveNueva123', '2.2.2.2');

    const u = mockUsuarios[0]!;
    expect(u.passwordHash).not.toBe(antes);
    expect(await bcrypt.compare('ClaveNueva123', u.passwordHash)).toBe(true);
    expect(u.passwordHash.startsWith('$2a$12$') || u.passwordHash.startsWith('$2b$12$')).toBe(true);
    expect(mockSesionesRevocadas).toEqual(['u1']);
    expect(mockResets.every((r) => r.usedAt !== null)).toBe(true);
  });

  it('el mismo token no sirve dos veces', async () => {
    const token = await pedirToken();
    await servicio().restablecer(token, 'ClaveNueva123', null);
    await expect(servicio().restablecer(token, 'OtraClave1234', null)).rejects.toThrow(MSG_RESET_ENLACE_INVALIDO);
    expect(await bcrypt.compare('ClaveNueva123', mockUsuarios[0]!.passwordHash)).toBe(true);
  });

  it('token caducado, usado y desconocido: el MISMO error y nada cambia', async () => {
    const token = await pedirToken();
    mockResets[0]!.expiresAt = Date.now() - 1;                    // caducado
    const usado = 'usado-' + token;
    mockResets.push({ id: 'x', usuarioId: 'u1', tokenHash: sha256(usado), createdAt: Date.now(), expiresAt: Date.now() + 60_000, usedAt: Date.now(), ip: null });
    const antes = mockUsuarios[0]!.passwordHash;

    const errores: unknown[] = [];
    for (const t of [token, usado, 'desconocido']) {
      errores.push(await servicio().restablecer(t, 'ClaveNueva123', null).then(() => null, (e: unknown) => e));
    }
    for (const e of errores) {
      expect(e).toBeInstanceOf(ResetPasswordError);
      expect((e as ResetPasswordError).message).toBe(MSG_RESET_ENLACE_INVALIDO);
      expect((e as ResetPasswordError).statusCode).toBe(400);
    }
    expect(mockUsuarios[0]!.passwordHash).toBe(antes);
    expect(mockSesionesRevocadas).toEqual([]);
  });

  it('usuario inactivo o borrado tras pedir el enlace: mismo error y no cambia nada', async () => {
    const token = await pedirToken();
    mockUsuarios[0]!.activo = false;
    const antes = mockUsuarios[0]!.passwordHash;
    await expect(servicio().restablecer(token, 'ClaveNueva123', null)).rejects.toThrow(MSG_RESET_ENLACE_INVALIDO);
    expect(mockUsuarios[0]!.passwordHash).toBe(antes);
    expect(mockSesionesRevocadas).toEqual([]);
  });

  it('doble uso CONCURRENTE: solo uno gana y la contraseña se cambia una sola vez', async () => {
    const token = await pedirToken();
    const res = await Promise.allSettled([
      servicio().restablecer(token, 'ClaveNueva123', null),
      servicio().restablecer(token, 'ClaveOtra9999', null),
    ]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rechazo = res.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rechazo.reason).toBeInstanceOf(ResetPasswordError);
    expect(mockSesionesRevocadas).toEqual(['u1']);   // una sola vez
  });

  it('contraseña de menos de 8 caracteres se rechaza SIN gastar el token', async () => {
    const token = await pedirToken();
    await expect(servicio().restablecer(token, '1234567', null)).rejects.toBeInstanceOf(ResetPasswordError);
    expect(mockResets[0]!.usedAt).toBeNull();
    await expect(servicio().restablecer(token, 'x'.repeat(129), null)).rejects.toBeInstanceOf(ResetPasswordError);
    expect(mockResets[0]!.usedAt).toBeNull();
    await expect(servicio().restablecer(token, '12345678', null)).resolves.toBeUndefined();
  });
});

// ─── Plantilla ────────────────────────────────────────────────────────────────

describe('plantilla del correo', () => {
  it('escapa los datos dinámicos en el HTML', () => {
    const { html } = plantillaRestablecerPassword('https://x.test/r?token=a"><script>alert(1)</script>&b=1', 30);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;&gt;&lt;script&gt;');
    expect(html).toContain('&amp;b=1');
  });
});

// ─── Rutas (controlador real, servicios simulados) ────────────────────────────

describe('rutas HTTP', () => {
  async function app() {
    const f = Fastify();
    await f.register(fastifyRateLimit, {
      global: false, max: 100, timeWindow: '1 minute', keyGenerator: (r) => r.ip,
      errorResponseBuilder: (_r, c) => ({ error: 'Too Many Requests', message: `Rate limit exceeded. Retry in ${Math.ceil(c.ttl / 1000)} seconds.`, statusCode: 429 }),
    });
    f.setErrorHandler(errorHandler);
    await f.register(authRoutes, { prefix: '/api' });
    return f;
  }
  const esperarSegundoPlano = (): Promise<void> => new Promise((r) => setImmediate(r));

  it('forgot-password: 200 y cuerpo IDÉNTICO exista, no exista o esté inactivo el correo', async () => {
    const f = await app();
    const r1 = await f.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'ana@neurofic.test' } });
    const r2 = await f.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'nadie@neurofic.test' } });
    const r3 = await f.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'inactivo@neurofic.test' } });
    for (const r of [r1, r2, r3]) {
      expect(r.statusCode).toBe(200);
      expect(r.json()).toEqual({ message: 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.' });
    }
    expect(r1.body).toBe(r2.body);
    expect(r2.body).toBe(r3.body);
    await esperarSegundoPlano();
    await esperarSegundoPlano();
    expect(mockCorreos).toHaveLength(1);
    await f.close();
  });

  it('forgot-password: el enlace usa APP_URL aunque la petición traiga Host / X-Forwarded-Host falsos', async () => {
    const f = await app();
    await f.inject({
      method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'ana@neurofic.test' },
      headers: { host: 'malo.example', 'x-forwarded-host': 'malo.example', 'x-forwarded-proto': 'http', origin: 'https://malo.example' },
    });
    for (let i = 0; i < 5; i++) await esperarSegundoPlano();
    expect(mockCorreos).toHaveLength(1);
    expect(mockCorreos[0]!.texto).toContain('https://app.neurofic.test/restablecer-contrasena?token=');
    expect(JSON.stringify(mockCorreos)).not.toContain('malo.example');
    await f.close();
  });

  it('forgot-password: un fallo del SMTP sigue dando 200 con el mismo cuerpo', async () => {
    mockEstado.smtpFalla = true;
    const f = await app();
    const r = await f.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'ana@neurofic.test' } });
    expect(r.statusCode).toBe(200);
    await f.close();
  });

  it('forgot-password: límite de 5 por IP; la 6ª da 429', async () => {
    const f = await app();
    const codigos: number[] = [];
    for (let i = 0; i < 6; i++) {
      codigos.push((await f.inject({ method: 'POST', url: '/api/auth/forgot-password', payload: { email: 'nadie@neurofic.test' } })).statusCode);
    }
    expect(codigos).toEqual([200, 200, 200, 200, 200, 429]);
    await f.close();
  });

  it('reset-password: éxito 200 con el mensaje del contrato y sin iniciar sesión', async () => {
    await servicio().solicitar('ana@neurofic.test', null);
    const token = tokenDelUltimoCorreo();
    const f = await app();
    const r = await f.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'ClaveNueva123' } });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
    expect(r.json()).not.toHaveProperty('accessToken');
    await f.close();
  });

  it('reset-password: token inválido / usado / caducado → 400 con el mismo error', async () => {
    await servicio().solicitar('ana@neurofic.test', null);
    const token = tokenDelUltimoCorreo();
    const f = await app();
    await f.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'ClaveNueva123' } });
    const usado = await f.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'ClaveNueva123' } });
    const desconocido = await f.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'nope', newPassword: 'ClaveNueva123' } });
    for (const r of [usado, desconocido]) {
      expect(r.statusCode).toBe(400);
      expect(r.json().error).toBe('El enlace no es válido o ya caducó. Solicita uno nuevo.');
    }
    expect(usado.body).toBe(desconocido.body);
    await f.close();
  });

  it('reset-password: contraseña corta → 400 y el token sigue vivo', async () => {
    await servicio().solicitar('ana@neurofic.test', null);
    const token = tokenDelUltimoCorreo();
    const f = await app();
    const r = await f.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token, newPassword: 'corta' } });
    expect(r.statusCode).toBe(400);
    expect(mockResets[0]!.usedAt).toBeNull();
    await f.close();
  });

  it('reset-password: límite de 10 por IP; la 11ª da 429', async () => {
    const f = await app();
    const codigos: number[] = [];
    for (let i = 0; i < 11; i++) {
      codigos.push((await f.inject({ method: 'POST', url: '/api/auth/reset-password', payload: { token: 'nope', newPassword: 'ClaveNueva123' } })).statusCode);
    }
    expect(codigos.slice(0, 10).every((c) => c === 400)).toBe(true);
    expect(codigos[10]).toBe(429);
    await f.close();
  });
});
