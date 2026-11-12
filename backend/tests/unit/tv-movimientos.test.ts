import {
  movimientosCitasDia, movimientosAgenda, mismaVentanaDeCitas, movimientoFacturado,
  resumenCitasHoy, unirCitasDia, type CitaDia, type EstadoCita,
} from '../../src/services/tv-movimientos';

const c = (cod: number, estado: EstadoCita, hora = 9): CitaDia => ({ cod, estado, hora });
const previas = (...xs: Array<[number, EstadoCita]>): Map<number, EstadoCita> => new Map(xs);

describe('movimientos de las citas de hoy', () => {
  it('pendiente → cumplida cuenta como atendida; pendiente → incumplida, como incumplida', () => {
    const r = movimientosCitasDia(previas([1, 'P'], [2, 'P'], [3, 'P']), [c(1, 'C'), c(2, 'I'), c(3, 'P')]);
    expect(r).toEqual([
      { tipo: 'atendidas', cantidad: 1, valor: null },
      { tipo: 'incumplidas', cantidad: 1, valor: null },
    ]);
  });

  it('sin lectura previa NO hay movimientos (evita «+300 atendidas» en el primer arranque)', () => {
    expect(movimientosCitasDia(null, [c(1, 'C'), c(2, 'C')])).toEqual([]);
  });

  it('una lectura previa VACÍA sí es una lectura (un día que arranca sin citas): lo que aparezca es nuevo', () => {
    expect(movimientosCitasDia(new Map(), [c(1, 'C')])).toEqual([{ tipo: 'atendidas', cantidad: 1, valor: null }]);
  });

  it('lo que no cambió no se cuenta dos veces', () => {
    const r = movimientosCitasDia(previas([1, 'C'], [2, 'I']), [c(1, 'C'), c(2, 'I')]);
    expect(r).toEqual([]);
  });

  it('una cita que no estaba y ya está cumplida se agendó y se atendió entre dos lecturas', () => {
    const r = movimientosCitasDia(previas([1, 'P']), [c(1, 'P'), c(9, 'C')]);
    expect(r).toEqual([{ tipo: 'atendidas', cantidad: 1, valor: null }]);
  });

  it('un retroceso (cumplida → pendiente, una corrección) no es un movimiento', () => {
    expect(movimientosCitasDia(previas([1, 'C']), [c(1, 'P')])).toEqual([]);
  });
});

describe('citas nuevas en la agenda', () => {
  it('cuenta los códigos que antes no estaban', () => {
    expect(movimientosAgenda(new Set([1, 2]), [1, 2, 3, 4], true)).toEqual([{ tipo: 'agendadas', cantidad: 2, valor: null }]);
  });

  it('con la ventana cambiada (cambio de mes) se suprime: no son «nuevas»', () => {
    expect(movimientosAgenda(new Set([1, 2]), [1, 2, ...Array.from({ length: 500 }, (_, i) => 100 + i)], false)).toEqual([]);
  });

  it('sin lectura previa o vacía se suprime', () => {
    expect(movimientosAgenda(null, [1, 2], true)).toEqual([]);
    expect(movimientosAgenda(new Set(), [1, 2], true)).toEqual([]);
  });

  it('que desaparezcan citas (atendidas, canceladas) no genera movimiento', () => {
    expect(movimientosAgenda(new Set([1, 2, 3]), [1], true)).toEqual([]);
  });
});

describe('ventana de citas entre dos sincronizaciones', () => {
  it('el mismo mes y reciente: misma ventana', () => {
    expect(mismaVentanaDeCitas('2026-11-12 14:45:00', new Date('2026-11-12T15:00:00Z'))).toBe(true);
  });

  it('cruzó el mes: ventana distinta (la de noviembre llega a fin de diciembre; la de diciembre, a fin de enero)', () => {
    // 11 p. m. del 30-nov en Bogotá → 12:30 a. m. del 1-dic
    expect(mismaVentanaDeCitas('2026-12-01 04:00:00', new Date('2026-12-01T05:30:00Z'))).toBe(false);
  });

  it('el borde: 9 p. m. del 30-nov en Colombia ya es 1-dic en UTC, y la ventana se calcula en hora de Colombia', () => {
    // 9 p. m. y 10 p. m. del 30-nov en Bogotá = 02:00 y 03:00 UTC del 1-dic: sigue siendo noviembre allá.
    expect(mismaVentanaDeCitas('2026-12-01 02:00:00', new Date('2026-12-01T03:00:00Z'))).toBe(true);
  });

  it('una sincronización de hace más de 3 horas no sirve: tras una caída, lo agendado en el hueco saldría como un solo «+N»', () => {
    expect(mismaVentanaDeCitas('2026-11-12 10:00:00', new Date('2026-11-12T15:00:00Z'))).toBe(false);
    expect(mismaVentanaDeCitas('2026-11-05 14:00:00', new Date('2026-11-12T15:00:00Z'))).toBe(false);
  });

  it('una sincronización «del futuro» (reloj desajustado) tampoco', () => {
    expect(mismaVentanaDeCitas('2026-11-12 16:00:00', new Date('2026-11-12T15:00:00Z'))).toBe(false);
  });

  it('sin sincronización previa o con texto ilegible: no es la misma', () => {
    expect(mismaVentanaDeCitas(null, new Date())).toBe(false);
    expect(mismaVentanaDeCitas('basura', new Date())).toBe(false);
  });
});

describe('movimiento de lo facturado', () => {
  it('solo si sube, redondeado a pesos', () => {
    expect(movimientoFacturado(1_000_000, 1_250_000.4)).toEqual({ tipo: 'facturado', cantidad: 1, valor: 250_000 });
  });

  it('una baja o ningún cambio no se muestran', () => {
    expect(movimientoFacturado(1_000_000, 900_000)).toBeNull();
    expect(movimientoFacturado(1_000_000, 1_000_000)).toBeNull();
  });

  it('sin lectura previa o con valores no numéricos, nada', () => {
    expect(movimientoFacturado(null, 5)).toBeNull();
    expect(movimientoFacturado(NaN, 5)).toBeNull();
    expect(movimientoFacturado(1, Infinity)).toBeNull();
  });
});

describe('resumen de las citas de hoy', () => {
  it('cuenta por estado y reparte por hora, ordenado', () => {
    const r = resumenCitasHoy([c(1, 'C', 8), c(2, 'C', 8), c(3, 'I', 9), c(4, 'P', 15), c(5, 'P', 8)]);
    expect(r).toMatchObject({ atendidas: 2, pendientes: 2, incumplidas: 1, total: 5 });
    expect(r.por_hora).toEqual([
      { hora: 8, pendientes: 1, atendidas: 2, incumplidas: 0 },
      { hora: 9, pendientes: 0, atendidas: 0, incumplidas: 1 },
      { hora: 15, pendientes: 1, atendidas: 0, incumplidas: 0 },
    ]);
  });

  it('un día sin citas: ceros, no undefined', () => {
    expect(resumenCitasHoy([])).toEqual({ atendidas: 0, pendientes: 0, incumplidas: 0, total: 0, por_hora: [] });
  });

  it('el total es la suma de los tres estados', () => {
    const r = resumenCitasHoy([c(1, 'C'), c(2, 'I'), c(3, 'P'), c(4, 'P')]);
    expect(r.atendidas + r.pendientes + r.incumplidas).toBe(r.total);
  });
});

describe('unir las tres listas de hoy', () => {
  it('si una cita está en dos estados manda el más avanzado', () => {
    const r = unirCitasDia([c(1, 'P'), c(2, 'P')], [c(1, 'C')], [c(2, 'I')]);
    expect(r.find((x) => x.cod === 1)!.estado).toBe('C');
    expect(r.find((x) => x.cod === 2)!.estado).toBe('I');
    expect(r).toHaveLength(2);
  });
});
