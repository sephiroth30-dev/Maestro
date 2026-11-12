/**
 * Lógica pura de la pantalla de TV (frontend/src/lib/tv.ts). Vive en el frontend, que no
 * tiene corredor de pruebas; como no depende de nada, se prueba desde aquí.
 */
import {
  horaBogota, enHorarioLaboral, posicionEnJornada, valorEntreLecturas, suavizar, formatoCorto,
  haceCuanto, horaTexto, saludDatos, textoMovimiento, proximosSieteDias,
} from '../../../frontend/src/lib/tv';

const T = (iso: string): number => Date.parse(iso);

describe('hora de la clínica', () => {
  it('UTC-5, sin depender de la zona del equipo', () => {
    expect(horaBogota(T('2026-11-10T15:30:00Z'))).toMatchObject({ hora: 10.5, fecha: '2026-11-10', diaSemana: 2 });
    // 9 p. m. del 10-nov en Bogotá ya es 11-nov en UTC
    expect(horaBogota(T('2026-11-11T02:00:00Z'))).toMatchObject({ hora: 21, fecha: '2026-11-10' });
  });

  it('horario laboral: lunes a sábado, de 6:00 a 19:59', () => {
    expect(enHorarioLaboral(T('2026-11-10T11:00:00Z'))).toBe(true);    // martes 6:00
    expect(enHorarioLaboral(T('2026-11-10T10:59:00Z'))).toBe(false);   // martes 5:59
    expect(enHorarioLaboral(T('2026-11-11T00:59:00Z'))).toBe(true);    // martes 7:59 p. m.
    expect(enHorarioLaboral(T('2026-11-11T01:00:00Z'))).toBe(false);   // martes 8:00 p. m.
    expect(enHorarioLaboral(T('2026-11-14T15:00:00Z'))).toBe(true);    // sábado 10 a. m.
    expect(enHorarioLaboral(T('2026-11-15T15:00:00Z'))).toBe(false);   // domingo
  });

  it('posición en la jornada: 0 a las 6:00, 1 a las 20:00, acotada', () => {
    expect(posicionEnJornada(T('2026-11-10T11:00:00Z'))).toBe(0);
    expect(posicionEnJornada(T('2026-11-10T18:00:00Z'))).toBeCloseTo(7 / 14, 5);
    expect(posicionEnJornada(T('2026-11-11T05:00:00Z'))).toBe(0);      // medianoche: antes de abrir
    expect(posicionEnJornada(T('2026-11-11T03:00:00Z'))).toBe(1);      // 10 p. m.: después de cerrar
  });
});

describe('valor entre lecturas (el movimiento «honesto»)', () => {
  const base = { ancla: 20_000_000, anclaMs: T('2026-11-10T15:00:00Z'), porHora: 2_000_000, enHorario: true, topeMin: 30 };

  it('avanza al ritmo del día desde la hora de la última sincronización', () => {
    // 15 min después: 0,25 h × 2 M/h = +500.000
    expect(valorEntreLecturas({ ...base, ahoraMs: T('2026-11-10T15:15:00Z') })).toBe(20_500_000);
  });

  it('en el instante de la lectura es exactamente el valor real', () => {
    expect(valorEntreLecturas({ ...base, ahoraMs: base.anclaMs })).toBe(20_000_000);
  });

  it('TOPE: si la sincronización se atrasa, no sigue subiendo indefinidamente', () => {
    const dosHoras = valorEntreLecturas({ ...base, ahoraMs: T('2026-11-10T17:00:00Z') });
    const treintaMin = valorEntreLecturas({ ...base, ahoraMs: T('2026-11-10T15:30:00Z') });
    expect(dosHoras).toBe(treintaMin);
    expect(dosHoras).toBe(21_000_000);
  });

  it('nunca baja del valor real, ni con un reloj atrasado', () => {
    expect(valorEntreLecturas({ ...base, ahoraMs: T('2026-11-10T14:00:00Z') })).toBe(20_000_000);
  });

  it.each([
    ['fuera de horario', { enHorario: false }],
    ['sin ritmo', { porHora: null }],
    ['ritmo cero', { porHora: 0 }],
    ['ritmo negativo', { porHora: -5 }],
    ['ritmo no numérico', { porHora: NaN }],
    ['tope inválido', { topeMin: 0 }],
  ])('%s: devuelve el valor real, sin inventar', (_n, over) => {
    expect(valorEntreLecturas({ ...base, ...over, ahoraMs: T('2026-11-10T15:20:00Z') })).toBe(20_000_000);
  });

  it('sin NaN con valores inválidos', () => {
    expect(valorEntreLecturas({ ...base, ancla: NaN, ahoraMs: T('2026-11-10T15:20:00Z') })).toBe(0);
    expect(valorEntreLecturas({ ...base, anclaMs: NaN, ahoraMs: T('2026-11-10T15:20:00Z') })).toBe(20_000_000);
  });
});

describe('suavizado de la transición', () => {
  it('converge hacia el objetivo, hacia arriba y hacia abajo', () => {
    let v = 1000;
    for (let i = 0; i < 100; i++) v = suavizar(v, 1500, 100);
    expect(v).toBe(1500);
    v = 1500;
    for (let i = 0; i < 100; i++) v = suavizar(v, 900, 100);
    expect(v).toBe(900);    // una corrección a la baja SE VE: no se esconde
  });

  it('un paso nunca sobrepasa el objetivo', () => {
    expect(suavizar(0, 100, 1_000_000)).toBeLessThanOrEqual(100);
    expect(suavizar(100, 0, 1_000_000)).toBeGreaterThanOrEqual(0);
  });

  it('con valores no numéricos no se rompe', () => {
    expect(suavizar(5, NaN, 100)).toBe(5);
    expect(suavizar(NaN, 7, 100)).toBe(7);
  });
});

describe('formatos', () => {
  it.each([
    [85_722_802, '$85,7 M'], [100_000_000, '$100 M'], [1_250_000_000, '$1,3 mil M'],
    [850_000, '$850 mil'], [999, '$999'], [999_600, '$1 M'], [999_400, '$999 mil'], [999_960_000, '$1 mil M'], [0, '$0'], [-2_500_000, '-$2,5 M'], [NaN, '$0'],
  ])('formatoCorto(%p) = %p', (n, esperado) => {
    expect(formatoCorto(n)).toBe(esperado);
  });

  it('hace cuánto', () => {
    expect(haceCuanto(10_000)).toBe('hace un momento');
    expect(haceCuanto(3 * 60_000)).toBe('hace 3 min');
    expect(haceCuanto(125 * 60_000)).toBe('hace 2 h');
    expect(haceCuanto(-5)).toBe('hace un momento');
    expect(haceCuanto(NaN)).toBe('hace un momento');
  });

  it('hora de la clínica desde un ISO', () => {
    expect(horaTexto('2026-11-10T15:37:00.000Z')).toBe('10:37 a. m.');
    expect(horaTexto('2026-11-10T17:05:00.000Z')).toBe('12:05 p. m.');
    expect(horaTexto('2026-11-11T05:05:00.000Z')).toBe('12:05 a. m.');
    expect(horaTexto(null)).toBe('—');
    expect(horaTexto('basura')).toBe('—');
  });
});

describe('salud de los datos', () => {
  const ahoraMs = T('2026-11-10T15:30:00Z');   // 10:30 a. m.
  const min = (n: number): number => ahoraMs - n * 60_000;
  const base = { ahoraMs, enHorario: true, ultimaLecturaMs: ahoraMs - 30_000 };
  const ok = { consumos: { ms: min(10), cadenciaMin: 30 }, citas: { ms: min(5) } };

  it('vivo: respondió hace poco y todo está sincronizado', () => {
    expect(saludDatos({ ...base, ...ok })).toBe('vivo');
  });

  it('sin conexión: el servidor lleva más de 3 minutos sin responder, o nunca respondió', () => {
    expect(saludDatos({ ...base, ...ok, ultimaLecturaMs: ahoraMs - 4 * 60_000 })).toBe('sin_conexion');
    expect(saludDatos({ ...base, ...ok, ultimaLecturaMs: null })).toBe('sin_conexion');
  });

  it('retrasado: los CONSUMOS llevan más que la cadencia + 15 min', () => {
    expect(saludDatos({ ...base, ...ok, consumos: { ms: min(50), cadenciaMin: 30 } })).toBe('retrasado');
    expect(saludDatos({ ...base, ...ok, consumos: { ms: min(44), cadenciaMin: 30 } })).toBe('vivo');
  });

  it('que las citas estén al día NO esconde que los consumos llevan horas parados (la cifra principal)', () => {
    expect(saludDatos({ ...base, consumos: { ms: min(180), cadenciaMin: 30 }, citas: { ms: min(2) } })).toBe('retrasado');
  });

  it('retrasado: las citas llevan más de 45 min', () => {
    expect(saludDatos({ ...base, ...ok, citas: { ms: min(50) } })).toBe('retrasado');
  });

  it('con la cadencia real de la fuente: una sincronización cada hora no se alarma a los 50 min', () => {
    expect(saludDatos({ ...base, ...ok, consumos: { ms: min(50), cadenciaMin: 60 } })).toBe('vivo');
  });

  it('sincronización manual o agenda sin activar: no hay contra qué juzgar', () => {
    expect(saludDatos({ ...base, consumos: { ms: min(900), cadenciaMin: null }, citas: null })).toBe('vivo');
  });

  it('fuera de horario una sincronización vieja es NORMAL: no se alarma', () => {
    expect(saludDatos({ ...base, enHorario: false, consumos: { ms: min(600), cadenciaMin: 30 }, citas: { ms: min(600) } })).toBe('vivo');
  });

  it('en la primera media hora de la jornada aún no corrió el primer ciclo: no se alarma', () => {
    const seis10 = T('2026-11-10T11:10:00Z');   // 6:10 a. m.
    expect(saludDatos({ ahoraMs: seis10, enHorario: true, ultimaLecturaMs: seis10, consumos: { ms: seis10 - 600 * 60_000, cadenciaMin: 30 }, citas: { ms: seis10 - 600 * 60_000 } })).toBe('vivo');
  });
});

describe('textos de la cinta de movimientos', () => {
  it('rotula la hora de DETECCIÓN', () => {
    expect(textoMovimiento({ tipo: 'atendidas', cantidad: 4, valor: null, detectado_en: '2026-11-10T15:37:00Z' })).toBe('10:37 a. m. · +4 citas atendidas');
    expect(textoMovimiento({ tipo: 'atendidas', cantidad: 1, valor: null, detectado_en: '2026-11-10T15:37:00Z' })).toBe('10:37 a. m. · +1 cita atendida');
    expect(textoMovimiento({ tipo: 'facturado', cantidad: 1, valor: 1_800_000, detectado_en: '2026-11-10T15:37:00Z' })).toBe('10:37 a. m. · +$1,8 M facturados');
    expect(textoMovimiento({ tipo: 'agendadas', cantidad: 2, valor: null, detectado_en: null })).toBe('— · +2 citas agendadas');
    expect(textoMovimiento({ tipo: 'raro', cantidad: 1, valor: null, detectado_en: null })).toBe('— · movimiento');
  });
});

describe('próximos siete días', () => {
  it('siempre siete, rellenando con ceros los días sin citas, cruzando el mes', () => {
    const r = proximosSieteDias('2026-11-28', [{ fecha: '2026-11-30', citas: 12, valor: 800_000 }]);
    expect(r.map((x) => x.fecha)).toEqual(['2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']);
    expect(r[2]).toMatchObject({ citas: 12, valor: 800_000 });
    expect(r[0]).toMatchObject({ citas: 0, valor: 0, diaSemana: 6 });
  });
});
