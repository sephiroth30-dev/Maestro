jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
// Sin Redis: `get` no encuentra nada y `set` no hace nada, así siempre se llama al repositorio.
jest.mock('../../src/config/redis', () => ({
  getRedisClient: () => ({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue('OK') }),
}));
jest.mock('../../src/services/fuente-activa.service', () => ({ fuenteActivaId: () => null }));
jest.mock('../../src/repositories/reportes.repo', () => ({ getMesesDisponibles: jest.fn() }));
jest.mock('../../src/repositories/agenda.repo', () => ({ horizonteAgenda: jest.fn() }));
jest.mock('../../src/repositories/conectores.repo', () => ({ conectoresRepo: { findAllActive: jest.fn() } }));
jest.mock('../../src/repositories/incumplidas.repo', () => ({}));
jest.mock('../../src/services/citas-sync.service', () => ({
  agendaActiva: (c: { config?: { agenda?: { activo?: boolean } } }) => c.config?.agenda?.activo === true,
}));

import { mesesFuturosConAgenda, agregarMesesFuturos } from '../../src/services/agenda-periodo';
import { reportesService } from '../../src/services/reportes.service';
import * as repo from '../../src/repositories/reportes.repo';
import * as agendaRepo from '../../src/repositories/agenda.repo';
import { conectoresRepo } from '../../src/repositories/conectores.repo';

const mesReal = (anio: number, mes: number) => ({ anio, mes, total: 1000, atenciones: 10 });

describe('meses futuros con agenda (lógica pura)', () => {
  it('agrega los meses posteriores al último con datos hasta el del horizonte, inclusive', () => {
    expect(mesesFuturosConAgenda({ anio: 2026, mes: 11 }, '2026-12-29')).toEqual([
      { anio: 2026, mes: 12, total: 0, atenciones: 0, futuro: true },
    ]);
  });

  it('varios meses: del más reciente al más antiguo', () => {
    const r = mesesFuturosConAgenda({ anio: 2026, mes: 10 }, '2026-12-05');
    expect(r.map((m) => [m.anio, m.mes])).toEqual([[2026, 12], [2026, 11]]);
  });

  it('cruce de año: horizonte en enero', () => {
    const r = mesesFuturosConAgenda({ anio: 2026, mes: 11 }, '2027-01-15');
    expect(r.map((m) => [m.anio, m.mes])).toEqual([[2027, 1], [2026, 12]]);
    expect(r.every((m) => m.futuro === true && m.total === 0 && m.atenciones === 0)).toBe(true);
  });

  it('el horizonte dentro del último mes con datos no agrega nada', () => {
    expect(mesesFuturosConAgenda({ anio: 2026, mes: 11 }, '2026-11-30')).toEqual([]);
    expect(mesesFuturosConAgenda({ anio: 2026, mes: 11 }, '2026-09-01')).toEqual([]);
  });

  it('sin horizonte, sin datos o con horizonte ilegible no agrega nada', () => {
    expect(mesesFuturosConAgenda({ anio: 2026, mes: 11 }, null)).toEqual([]);
    expect(mesesFuturosConAgenda(null, '2026-12-29')).toEqual([]);
    expect(mesesFuturosConAgenda({ anio: 2026, mes: 11 }, 'basura')).toEqual([]);
    expect(mesesFuturosConAgenda({ anio: 2026, mes: 11 }, '2026-13-01')).toEqual([]);
  });

  it('agregarMesesFuturos: reales con futuro:false, futuros primero y sin duplicar', () => {
    const r = agregarMesesFuturos([mesReal(2026, 11), mesReal(2026, 10)], '2026-12-29');
    expect(r.map((m) => [m.anio, m.mes, m.futuro])).toEqual([
      [2026, 12, true], [2026, 11, false], [2026, 10, false],
    ]);
  });

  it('agregarMesesFuturos: un mes que ya existe como real no se duplica', () => {
    const r = agregarMesesFuturos([mesReal(2026, 12), mesReal(2026, 11)], '2026-12-29');
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ anio: 2026, mes: 12, futuro: false, atenciones: 10 });
  });

  it('agregarMesesFuturos: sin horizonte devuelve solo los reales', () => {
    const r = agregarMesesFuturos([mesReal(2026, 11)], null);
    expect(r).toEqual([{ ...mesReal(2026, 11), futuro: false }]);
  });
});

describe('getMesesDisponibles del servicio', () => {
  const reales = [mesReal(2026, 11), mesReal(2026, 10)];
  const activos = (activo: boolean) =>
    (conectoresRepo.findAllActive as jest.Mock).mockResolvedValue([{ id: 'c1', config: { agenda: { activo } } }]);

  beforeEach(() => {
    (repo.getMesesDisponibles as jest.Mock).mockResolvedValue(reales);
    (agendaRepo.horizonteAgenda as jest.Mock).mockResolvedValue('2026-12-29');
  });

  it('con agenda activa suma diciembre como futuro', async () => {
    activos(true);
    const r = await reportesService.getMesesDisponibles();
    expect(r[0]).toEqual({ anio: 2026, mes: 12, total: 0, atenciones: 0, futuro: true });
    expect(r.slice(1).every((m) => m.futuro === false)).toBe(true);
    expect(r).toHaveLength(3);
  });

  it('con la agenda desactivada no agrega meses futuros', async () => {
    activos(false);
    const r = await reportesService.getMesesDisponibles();
    expect(r.map((m) => m.mes)).toEqual([11, 10]);
  });

  it('sin conectores activos no agrega meses futuros', async () => {
    (conectoresRepo.findAllActive as jest.Mock).mockResolvedValue([]);
    const r = await reportesService.getMesesDisponibles();
    expect(r.map((m) => m.mes)).toEqual([11, 10]);
  });

  it('con agenda activa pero sin citas (sin horizonte) no agrega nada', async () => {
    activos(true);
    (agendaRepo.horizonteAgenda as jest.Mock).mockResolvedValue(null);
    const r = await reportesService.getMesesDisponibles();
    expect(r.map((m) => m.mes)).toEqual([11, 10]);
  });
});
