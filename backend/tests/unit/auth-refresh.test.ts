/**
 * Renovación del token con rotación. Antes el servidor revocaba el refresh token usado,
 * creaba uno nuevo y NO lo devolvía: el cliente seguía con el revocado, y a la segunda
 * renovación (≈30 min) se interpretaba como robo y se cerraban todas las sesiones.
 */
import crypto from 'crypto';

type Fila = { id: string; tokenHash: string; usuarioId: string; expiresAt: Date; revokedAt: Date | null };
const filas: Fila[] = [];
let revocacionesMasivas: string[] = [];

jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/repositories/usuarios.repo', () => ({
  usuariosRepo: {
    // Como la BD real: `vencido` y `revocadoReciente` los calcula la consulta, no el servicio.
    findRefreshToken: async (h: string, gracia = 10) => {
      const f = filas.find((x) => x.tokenHash === h);
      if (!f) return null;
      return {
        ...f,
        vencido: f.expiresAt.getTime() < Date.now(),
        revocadoReciente: f.revokedAt !== null && Date.now() - f.revokedAt.getTime() < gracia * 1000,
      };
    },
    findById: async (id: string) => ({ id, email: 'a@a.com', rol: 'ADMIN', activo: true }),
    // Atómico como el `UPDATE ... WHERE revoked_at IS NULL`: devuelve si ESTA llamada lo revocó.
    revokeRefreshToken: async (h: string) => { const f = filas.find((x) => x.tokenHash === h && !x.revokedAt); if (!f) return false; f.revokedAt = new Date(); return true; },
    createRefreshToken: async (d: { tokenHash: string; usuarioId: string; expiresAt: Date }) => {
      const f = { id: String(filas.length + 1), tokenHash: d.tokenHash, usuarioId: d.usuarioId, expiresAt: d.expiresAt, revokedAt: null };
      filas.push(f); return f;
    },
    revokeAllUserRefreshTokens: async (u: string) => { revocacionesMasivas.push(u); filas.filter((f) => f.usuarioId === u).forEach((f) => { f.revokedAt ??= new Date(); }); },
  },
}));

import { AuthService, GRACIA_REUSO_MS } from '../../src/services/auth.service';

const hash = (t: string): string => crypto.createHash('sha256').update(t).digest('hex');
const servicio = (): AuthService => new AuthService({ jwt: { sign: () => 'jwt' } } as never);

function sembrar(raw: string, usuarioId = 'u1'): void {
  filas.push({ id: raw, tokenHash: hash(raw), usuarioId, expiresAt: new Date(Date.now() + 7 * 86_400_000), revokedAt: null });
}

beforeEach(() => { filas.length = 0; revocacionesMasivas = []; jest.useRealTimers(); });

describe('renovación con rotación', () => {
  it('devuelve un refresh token NUEVO y distinto', async () => {
    sembrar('r0');
    const r = await servicio().refresh('r0');
    expect(r.accessToken).toBe('jwt');
    expect(r.refreshToken).toBeTruthy();
    expect(r.refreshToken).not.toBe('r0');
  });

  it('una sesión que renueva una y otra vez con lo que recibe NUNCA se cae (el caso de los 30 min)', async () => {
    sembrar('r0');
    const s = servicio();
    let token = 'r0';
    for (let i = 0; i < 6; i++) {
      jest.useFakeTimers().setSystemTime(Date.now() + 16 * 60_000);   // cada ~15 min
      const r = await s.refresh(token);
      token = r.refreshToken;
    }
    expect(revocacionesMasivas).toEqual([]);
  });

  it('la expiración se desliza: cada renovación emite otro token de ~7 días', async () => {
    sembrar('r0');
    const antes = Date.now();
    await servicio().refresh('r0');
    const nuevo = filas[filas.length - 1]!;
    expect(nuevo.expiresAt.getTime() - antes).toBeGreaterThan(6.9 * 86_400_000);
  });

  it('reusar un token revocado hace tiempo SIGUE siendo robo: revoca todas las sesiones', async () => {
    sembrar('r0');
    const s = servicio();
    const r1 = await s.refresh('r0');
    jest.useFakeTimers().setSystemTime(Date.now() + GRACIA_REUSO_MS + 1_000);
    await expect(s.refresh('r0')).rejects.toBeTruthy();
    expect(revocacionesMasivas).toEqual(['u1']);
    // y el token nuevo también quedó revocado
    await expect(s.refresh(r1.refreshToken)).rejects.toBeTruthy();
  });

  it('dos renovaciones casi simultáneas con el mismo token: la perdedora falla, pero NO se cierran todas las sesiones', async () => {
    sembrar('r0');
    const s = servicio();
    const r1 = await s.refresh('r0');
    await expect(s.refresh('r0')).rejects.toBeTruthy();     // la carrera
    expect(revocacionesMasivas).toEqual([]);
    await expect(s.refresh(r1.refreshToken)).resolves.toBeTruthy();   // la ganadora sigue viva
  });

  it('dos renovaciones SIMULTÁNEAS con el mismo token: solo una emite token; no se bifurca la sesión', async () => {
    sembrar('r0');
    const s = servicio();
    const res = await Promise.allSettled([s.refresh('r0'), s.refresh('r0')]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(res.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(filas.filter((f) => f.revokedAt === null)).toHaveLength(1);   // una sola cadena viva
    expect(revocacionesMasivas).toEqual([]);
  });

  it('un token caducado se rechaza', async () => {
    filas.push({ id: 'x', tokenHash: hash('viejo'), usuarioId: 'u1', expiresAt: new Date(Date.now() - 1000), revokedAt: null });
    await expect(servicio().refresh('viejo')).rejects.toBeTruthy();
  });

  it('un token desconocido se rechaza', async () => {
    await expect(servicio().refresh('nada')).rejects.toBeTruthy();
  });
});
