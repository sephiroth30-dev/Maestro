/**
 * SQL del repositorio de restablecimientos (sin BD: el pool se simula). El consumo del token tiene
 * que ser un UPDATE atómico condicionado a «sin usar» y «vigente»; si alguien quita una condición,
 * dos clics a la vez (o un enlace usado/caducado) volverían a funcionar.
 */
const mockExecute = jest.fn();

jest.mock('../../src/config/prisma', () => ({
  pool: { execute: (...a: unknown[]) => mockExecute(...a) },
}));

import { passwordResetsRepo } from '../../src/repositories/password-resets.repo';

const sqlDe = (llamada: number): string => String(mockExecute.mock.calls[llamada]![0]).replace(/\s+/g, ' ');

describe('password_resets repo', () => {
  it('consumir: UPDATE atómico con used_at IS NULL y expires_at > NOW, por hash; devuelve las filas afectadas', async () => {
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    const filas = await passwordResetsRepo.consumir('abc123');
    expect(filas).toBe(1);
    const sql = sqlDe(0);
    expect(sql).toMatch(/^UPDATE password_resets SET used_at = NOW\(3\) WHERE/);
    expect(sql).toContain('token_hash = ?');
    expect(sql).toContain('used_at IS NULL');
    expect(sql).toContain('expires_at > NOW(3)');
    expect(mockExecute.mock.calls[0]![1]).toEqual(['abc123']);

    mockExecute.mockResolvedValue([{ affectedRows: 0 }]);
    expect(await passwordResetsRepo.consumir('abc123')).toBe(0);
  });

  it('crear: guarda el hash recibido, caduca a los 30 min y no tiene columna de token en claro', async () => {
    mockExecute.mockResolvedValue([{ affectedRows: 1 }]);
    await passwordResetsRepo.crear({ usuarioId: 'u1', tokenHash: 'hash-sha256', ip: '1.2.3.4' });
    const sql = sqlDe(0);
    expect(sql).toContain('INSERT INTO password_resets');
    expect(sql).toContain('INTERVAL 30 MINUTE');
    expect(sql).not.toMatch(/\btoken\b\s*[,)]/);
    const params = mockExecute.mock.calls[0]![1] as unknown[];
    expect(params).toContain('hash-sha256');
    expect(params).toContain('u1');
  });

  it('invalidarPendientes: solo los del usuario que siguen sin usar', async () => {
    mockExecute.mockResolvedValue([{ affectedRows: 2 }]);
    await passwordResetsRepo.invalidarPendientes('u1');
    const sql = sqlDe(0);
    expect(sql).toContain('SET used_at = NOW(3)');
    expect(sql).toContain('usuario_id = ?');
    expect(sql).toContain('used_at IS NULL');
  });

  it('contarRecientes: convierte los conteos (pueden llegar como texto o NULL)', async () => {
    mockExecute.mockResolvedValue([[{ ultimo_minuto: '1', ultima_hora: '3' }]]);
    expect(await passwordResetsRepo.contarRecientes('u1')).toEqual({ ultimoMinuto: 1, ultimaHora: 3 });
    mockExecute.mockResolvedValue([[{ ultimo_minuto: null, ultima_hora: null }]]);
    expect(await passwordResetsRepo.contarRecientes('u1')).toEqual({ ultimoMinuto: 0, ultimaHora: 0 });
  });
});
