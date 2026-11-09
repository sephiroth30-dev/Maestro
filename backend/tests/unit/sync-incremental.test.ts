import {
  ventanaDesde,
  decidirModo,
  fechaEnVentana,
  VENTANA_MESES_POR_DEFECTO,
} from '../../src/services/sync-incremental';

describe('ventanaDesde', () => {
  it('con 2 meses: el mes actual y el anterior', () => {
    // 5 de noviembre de 2026 → desde el 1 de octubre
    expect(ventanaDesde(new Date('2026-11-05T15:00:00Z'), 2)).toBe('2026-10-01');
  });

  it('con 1 mes: solo el mes actual', () => {
    expect(ventanaDesde(new Date('2026-11-05T15:00:00Z'), 1)).toBe('2026-11-01');
  });

  it('en enero cruza el año', () => {
    expect(ventanaDesde(new Date('2026-01-10T15:00:00Z'), 2)).toBe('2025-12-01');
    expect(ventanaDesde(new Date('2026-01-10T15:00:00Z'), 3)).toBe('2025-11-01');
  });

  it('usa la hora de Colombia, no la del servidor', () => {
    // 2026-11-01 02:00 UTC = 31 de octubre, 9 p. m. en Bogotá: todavía es octubre.
    expect(ventanaDesde(new Date('2026-11-01T02:00:00Z'), 1)).toBe('2026-10-01');
    // Una hora después (7 a. m. UTC = 2 a. m. Bogotá del 1 de noviembre): ya es noviembre.
    expect(ventanaDesde(new Date('2026-11-01T07:00:00Z'), 1)).toBe('2026-11-01');
  });

  it('un valor inválido no produce una ventana vacía ni negativa', () => {
    expect(ventanaDesde(new Date('2026-11-05T15:00:00Z'), 0)).toBe('2026-11-01');
    expect(ventanaDesde(new Date('2026-11-05T15:00:00Z'), -3)).toBe('2026-11-01');
  });

  it('el valor por omisión es 2 (mes actual y anterior)', () => {
    expect(VENTANA_MESES_POR_DEFECTO).toBe(2);
  });
});

describe('decidirModo', () => {
  const base = { incrementalActivo: true, pedido: 'auto' as const, filasExistentes: 5000 };

  it('con la incremental activa y datos guardados, es incremental', () => {
    expect(decidirModo(base)).toBe('incremental');
  });

  it('sin la incremental activada, siempre completa (el comportamiento de siempre)', () => {
    expect(decidirModo({ ...base, incrementalActivo: false })).toBe('completa');
    expect(decidirModo({ ...base, incrementalActivo: false, pedido: 'incremental' })).toBe('completa');
  });

  it('se puede forzar una completa', () => {
    expect(decidirModo({ ...base, pedido: 'completa' })).toBe('completa');
  });

  it('un conector VACÍO hace completa aunque se pida incremental', () => {
    // Una incremental sobre un conector vacío cargaría solo dos meses y dejaría
    // el resto del histórico sin traer, sin ningún aviso.
    expect(decidirModo({ ...base, filasExistentes: 0 })).toBe('completa');
    expect(decidirModo({ ...base, filasExistentes: 0, pedido: 'incremental' })).toBe('completa');
  });
});

describe('fechaEnVentana', () => {
  const desde = '2026-10-01';

  it('incluye el primer día de la ventana', () => {
    expect(fechaEnVentana(new Date('2026-10-01T00:00:00Z'), desde)).toBe(true);
  });

  it('incluye fechas posteriores', () => {
    expect(fechaEnVentana(new Date('2026-11-05T00:00:00Z'), desde)).toBe(true);
  });

  it('excluye el día anterior: protege el hash único de las filas viejas', () => {
    expect(fechaEnVentana(new Date('2026-09-30T00:00:00Z'), desde)).toBe(false);
  });

  it('excluye años anteriores', () => {
    expect(fechaEnVentana(new Date('2025-12-31T00:00:00Z'), desde)).toBe(false);
  });
});
