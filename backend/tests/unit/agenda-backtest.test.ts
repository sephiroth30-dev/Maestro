import { evaluarBacktest, type CitaEvaluada } from '../../src/services/agenda-backtest';
import { normalizarCitas, type FilaCruda } from '../../src/services/agenda-mapeo';

const c = (entidadKey: string, estado: 'C' | 'I', valor: number | null, entidad = entidadKey): CitaEvaluada =>
  ({ entidadKey, entidad, estado, valor });

describe('evaluación de la valoración (backtest)', () => {
  const real = new Map([
    ['e1', { entidad: 'NUEVA EPS', valor: 1000 }],
    ['e2', { entidad: 'SURA', valor: 500 }],
  ]);

  it('cobertura = estimado ÷ real, por EPS y en total', () => {
    const r = evaluarBacktest('2026-10', [c('e1', 'C', 400), c('e1', 'C', 500), c('e2', 'C', 450)], real);
    const e1 = r.filas.find((f) => f.entidadKey === 'e1')!;
    expect(e1).toMatchObject({ cumplidas: 2, estimado: 900, real: 1000, cobertura: 0.9 });
    expect(r.total).toMatchObject({ estimado: 1350, real: 1500, cobertura: 0.9 });
  });

  it('las incumplidas no suman valor, pero dan la tasa de inasistencia', () => {
    const r = evaluarBacktest('2026-10', [c('e1', 'C', 100), c('e1', 'C', 100), c('e1', 'C', 100), c('e1', 'I', null)], real);
    const e1 = r.filas.find((f) => f.entidadKey === 'e1')!;
    expect(e1.estimado).toBe(300);
    expect(e1).toMatchObject({ incumplidas: 1, inasistencia: 0.25 });
  });

  it('una cumplida sin precio se cuenta aparte y NO suma como cero oculto', () => {
    const r = evaluarBacktest('2026-10', [c('e1', 'C', 100), c('e1', 'C', null)], real);
    const e1 = r.filas.find((f) => f.entidadKey === 'e1')!;
    expect(e1).toMatchObject({ cumplidas: 2, sinPrecio: 1, estimado: 100 });
  });

  it('lo facturado a una EPS sin citas cumplidas también aparece: la agenda no lo explica', () => {
    const r = evaluarBacktest('2026-10', [c('e1', 'C', 900)], real);
    const e2 = r.filas.find((f) => f.entidadKey === 'e2')!;
    expect(e2).toMatchObject({ cumplidas: 0, estimado: 0, real: 500, cobertura: 0 });
  });

  it('una EPS con citas pero sin facturación ese mes no tiene cobertura (no se divide por cero)', () => {
    const r = evaluarBacktest('2026-10', [c('nombre:RARO', 'C', 100)], new Map());
    expect(r.filas[0]!.cobertura).toBeNull();
    expect(r.total.cobertura).toBeNull();
  });

  it('ordena por lo facturado, de mayor a menor', () => {
    const r = evaluarBacktest('2026-10', [c('e1', 'C', 1), c('e2', 'C', 1)], real);
    expect(r.filas.map((f) => f.entidadKey)).toEqual(['e1', 'e2']);
  });

  it('sin citas ni facturación: resultado vacío coherente', () => {
    const r = evaluarBacktest('2026-10', [], new Map());
    expect(r.filas).toEqual([]);
    expect(r.total).toMatchObject({ cumplidas: 0, estimado: 0, real: 0, cobertura: null, inasistencia: null });
  });
});

describe('normalización con estados pedidos', () => {
  const base: FilaCruda = { codAsignacion: 1, fechaInicioCita: '2026-10-05 08:00:00', estado: 'C', origen: 'agenda', codConvenio: 5, convenio: 'X', referencia: 'Y' };

  it('por omisión solo deja las pendientes', () => {
    expect(normalizarCitas([base]).filas).toHaveLength(0);
  });

  it('el backtest pide cumplidas e incumplidas, y el estado queda en la fila', () => {
    const r = normalizarCitas([base, { ...base, codAsignacion: 2, estado: 'I' }, { ...base, codAsignacion: 3, estado: 'P' }], ['C', 'I']);
    expect(r.filas.map((f) => f.estado)).toEqual(['C', 'I']);
  });
});
