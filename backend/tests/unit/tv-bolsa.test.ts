/** Lógica pura del terminal de bolsa (frontend/src/lib/tv.ts). */
import {
  estadoSesion, textoDelta, signoDelta, textoPct, colorVariacion, treemap, geometriaGrafico, trazo, velasDelMes,
} from '../../../frontend/src/lib/tv';

const T = (iso: string): number => Date.parse(iso);

describe('sesión de la jornada', () => {
  it('los minutos que faltan son exactos (sin error de coma flotante)', () => {
    // 8:10:00 a. m. en Bogotá → faltan 11 h 50 min
    expect(estadoSesion(T('2026-11-10T13:10:00Z')).texto).toBe('Sesión abierta · cierra en 11 h 50 min');
    for (let m = 0; m < 60; m++) {
      const t = estadoSesion(T(`2026-11-10T13:${String(m).padStart(2, '0')}:00Z`)).texto;
      expect(t).toBe(`Sesión abierta · cierra en ${m === 0 ? '12 h 0' : `11 h ${60 - m}`} min`);
    }
  });

  it('abierta: cuánto falta para el cierre de las 8 p. m.', () => {
    expect(estadoSesion(T('2026-11-10T15:30:00Z'))).toMatchObject({ abierta: true, texto: 'Sesión abierta · cierra en 9 h 30 min' });   // 10:30 a. m.
    expect(estadoSesion(T('2026-11-11T00:41:00Z')).texto).toBe('Sesión abierta · cierra en 19 min');   // 7:41 p. m.
  });

  it('el progreso va de 0 (6:00) a 1 (20:00)', () => {
    expect(estadoSesion(T('2026-11-10T11:00:00Z')).progreso).toBe(0);
    expect(estadoSesion(T('2026-11-10T18:00:00Z')).progreso).toBeCloseTo(0.5, 5);
  });

  it('cerrada: abre mañana, hoy de madrugada, o el lunes', () => {
    expect(estadoSesion(T('2026-11-11T02:00:00Z')).texto).toBe('Sesión cerrada · abre mañana a las 6:00 a. m.');          // martes 9 p. m.
    expect(estadoSesion(T('2026-11-10T09:00:00Z')).texto).toBe('Sesión cerrada · abre hoy a las 6:00 a. m.');             // martes 4 a. m.
    expect(estadoSesion(T('2026-11-15T02:00:00Z')).texto).toBe('Sesión cerrada · abre el lunes a las 6:00 a. m.');        // sábado 9 p. m.
    expect(estadoSesion(T('2026-11-15T16:00:00Z')).texto).toBe('Sesión cerrada · abre el lunes a las 6:00 a. m.');        // domingo
    expect(estadoSesion(T('2026-11-11T02:00:00Z')).abierta).toBe(false);
  });
});

describe('variaciones', () => {
  it('flechas y signo', () => {
    expect(textoDelta(1_400_000)).toBe('▲ +$1,4 M');
    expect(textoDelta(-500_000)).toBe('▼ −$500 mil');
    expect(textoDelta(0)).toBe('= igual');
    expect(textoDelta(null)).toBe('—');
    expect(textoDelta(NaN)).toBe('—');
    expect(textoPct(12.34)).toBe('▲ +12,3 %');
    expect(textoPct(-4.1)).toBe('▼ −4,1 %');
    expect(textoPct(null)).toBe('—');
  });

  it('el signo decide el color: sube, baja, igual, sin dato', () => {
    expect([signoDelta(5), signoDelta(-5), signoDelta(0), signoDelta(null)]).toEqual(['sube', 'baja', 'igual', 'nada']);
  });

  it('sin variación el cuadro es GRIS: no se pinta de verde ni rojo lo que no se puede comparar', () => {
    expect(colorVariacion(null)).toBe(colorVariacion(undefined));
    expect(colorVariacion(null)).not.toMatch(/hsl\((150|2),/);
    expect(colorVariacion(10)).toMatch(/^hsl\(150,/);
    expect(colorVariacion(-10)).toMatch(/^hsl\(2,/);
  });

  it('el color se satura a ±30 %', () => {
    expect(colorVariacion(30)).toBe(colorVariacion(300));
    expect(colorVariacion(-30)).toBe(colorVariacion(-300));
  });
});

describe('mapa de calor (treemap)', () => {
  const items = [40, 25, 15, 10, 6, 4].map((peso, i) => ({ peso, id: i }));

  it('el área de cada cuadro es PROPORCIONAL a su peso y todos caben en el rectángulo', () => {
    const r = treemap(items, 100, 60);
    const total = items.reduce((s, i) => s + i.peso, 0);
    for (const t of r) {
      expect((t.w * t.h) / (100 * 60)).toBeCloseTo(t.peso / total, 6);
      expect(t.x).toBeGreaterThanOrEqual(-1e-9);
      expect(t.y).toBeGreaterThanOrEqual(-1e-9);
      expect(t.x + t.w).toBeLessThanOrEqual(100 + 1e-9);
      expect(t.y + t.h).toBeLessThanOrEqual(60 + 1e-9);
    }
    expect(r.reduce((s, t) => s + t.w * t.h, 0)).toBeCloseTo(100 * 60, 6);
  });

  it('los cuadros no se superponen', () => {
    const r = treemap(items, 100, 100);
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i]!, b = r[j]!;
      const sepX = a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9;
      const sepY = a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9;
      expect(sepX || sepY).toBe(true);
    }
  });

  it('descarta pesos cero, negativos o no numéricos; sin nada, vacío', () => {
    expect(treemap([{ peso: 0 }, { peso: -3 }, { peso: NaN }])).toEqual([]);
    expect(treemap([])).toEqual([]);
    expect(treemap([{ peso: 5 }], 0, 10)).toEqual([]);
  });

  it('un solo elemento ocupa todo', () => {
    expect(treemap([{ peso: 7 }], 80, 40)[0]).toMatchObject({ x: 0, y: 0, w: 80, h: 40 });
  });

  it('el mayor queda primero', () => {
    expect(treemap(items)[0]!.peso).toBe(40);
  });
});

describe('gráfico del día', () => {
  const a = [{ ts: '2026-11-10T14:00:00Z', facturado: 4_000_000 }, { ts: '2026-11-10T17:00:00Z', facturado: 9_000_000 }];   // 9:00 y 12:00
  const b = [{ ts: '2026-11-09T14:00:00Z', facturado: 5_000_000 }];

  it('arranca en 0 a las 6:00 y avanza con la hora', () => {
    const g = geometriaGrafico(a, null, 1000, 400);
    expect(g.linea[0]).toEqual({ x: 0, y: 400 });
    expect(g.linea[1]!.x).toBeCloseTo((3 / 14) * 1000, 3);   // 9:00 = 3 h de 14
    expect(g.linea[2]!.x).toBeCloseTo((6 / 14) * 1000, 3);
    expect(g.linea[2]!.y).toBeLessThan(g.linea[1]!.y);        // sube: menor y = más arriba
  });

  it('las dos series comparten escala', () => {
    const g = geometriaGrafico(a, b, 1000, 400);
    expect(g.max).toBeCloseTo(9_000_000 * 1.15, 3);
    expect(g.fantasma).toHaveLength(2);
  });

  it('sin día anterior no hay fantasma; sin puntos, solo el origen; datos ilegibles se ignoran', () => {
    expect(geometriaGrafico(a, null, 100, 100).fantasma).toEqual([]);
    expect(geometriaGrafico([], null, 100, 100).linea).toEqual([{ x: 0, y: 100 }]);
    expect(geometriaGrafico([{ ts: 'basura', facturado: 5 }, { ts: '2026-11-10T14:00:00Z', facturado: NaN }], null, 100, 100).linea).toHaveLength(1);
  });

  it('el valor estimado entra en la escala (para que la punta no se salga)', () => {
    expect(geometriaGrafico(a, null, 100, 100, 20_000_000).max).toBeCloseTo(20_000_000 * 1.15, 3);
  });

  it('trazo SVG', () => {
    expect(trazo([{ x: 0, y: 10 }, { x: 5.55, y: 2 }])).toBe('M0.0 10.0 L5.5 2.0');
    expect(trazo([])).toBe('');
  });
});

describe('velas diarias del mes', () => {
  const dias = [{ fecha: '2026-11-02', facturado: 120 }, { fecha: '2026-11-03', facturado: 80 }, { fecha: '2026-11-07', facturado: 30 }, { fecha: '2026-11-10', facturado: 40 }];
  const v = velasDelMes('2026-11-10', dias, 100);
  const de = (f: string) => v.find((x) => x.fecha === f)!;

  it('todo el mes, sin domingos (noviembre de 2026 tiene 5)', () => {
    expect(v).toHaveLength(30 - 5);
    expect(v.every((x) => x.diaSemana !== 0)).toBe(true);
  });

  it('un día hábil pasado cumple si llegó a la meta diaria, y no cumple si no', () => {
    expect(de('2026-11-02')).toMatchObject({ estado: 'pasada', juzgable: true, cumple: true });
    expect(de('2026-11-03')).toMatchObject({ estado: 'pasada', juzgable: true, cumple: false });
  });

  it('un día hábil pasado SIN NINGÚN dato (festivo, antes de cargar) es «sin dato»: no se pinta de rojo', () => {
    expect(de('2026-11-04')).toMatchObject({ facturado: 0, sinDato: true, juzgable: false, cumple: null });
  });

  it('un día con datos que facturó poco SÍ no cumplió', () => {
    expect(de('2026-11-03')).toMatchObject({ sinDato: false, cumple: false });
  });

  it('sin meta (presupuesto sin cargar, meta de 0) NO se juzga ningún día: todo «cumpliría» una meta de $0', () => {
    const sin = velasDelMes('2026-11-10', dias, 0);
    expect(sin.every((x) => x.cumple === null && !x.juzgable)).toBe(true);
  });

  it('el sábado no se juzga contra la meta (la meta diaria es de lunes a viernes)', () => {
    expect(de('2026-11-07')).toMatchObject({ diaSemana: 6, juzgable: false, cumple: null });
  });

  it('hoy está en curso (no se juzga) y los días futuros están vacíos', () => {
    expect(de('2026-11-10')).toMatchObject({ estado: 'hoy', cumple: null, facturado: 40 });
    expect(de('2026-11-20')).toMatchObject({ estado: 'futura', cumple: null, facturado: 0 });
  });

  it('diciembre y años bisiestos', () => {
    expect(velasDelMes('2026-12-05', [], 1)).toHaveLength(31 - 4);   // domingos de dic-2026: 6, 13, 20, 27
    expect(velasDelMes('2028-02-10', [], 1).some((x) => x.fecha === '2028-02-29')).toBe(true);
  });
});
