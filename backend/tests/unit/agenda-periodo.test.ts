import {
  periodoDeAgenda, mesesCerradosPrevios, armarAgenda, agendaVacia, aIso,
} from '../../src/services/agenda-periodo';
import { enriquecerCita, type Resolutores } from '../../src/services/agenda-enriquecer';
import type { FilaCita } from '../../src/services/agenda-mapeo';
import { redis, flushReportesCache } from '../../src/config/redis';

describe('periodo de la agenda: de hoy en adelante', () => {
  const hoy = '2026-11-10';

  it('mes en curso: de hoy a fin de mes', () => {
    expect(periodoDeAgenda({ mesIdx: 11, anio: 2026 }, hoy)).toEqual({ desde: '2026-11-10', hasta: '2026-11-30' });
  });

  it('un mes ya terminado no tiene agenda pendiente', () => {
    expect(periodoDeAgenda({ mesIdx: 10, anio: 2026 }, hoy)).toBeNull();
  });

  it('un mes futuro se consulta entero', () => {
    expect(periodoDeAgenda({ mesIdx: 12, anio: 2026 }, hoy)).toEqual({ desde: '2026-12-01', hasta: '2026-12-31' });
  });

  it('esta semana (lunes a domingo): desde hoy hasta el domingo', () => {
    expect(periodoDeAgenda({ mesIdx: 11, anio: 2026, startDate: '2026-11-09', endDate: '2026-11-15' }, hoy))
      .toEqual({ desde: '2026-11-10', hasta: '2026-11-15' });
  });

  it('hoy: solo hoy', () => {
    expect(periodoDeAgenda({ mesIdx: 11, anio: 2026, startDate: hoy, endDate: hoy }, hoy)).toEqual({ desde: hoy, hasta: hoy });
  });

  it('la semana pasada y ayer no tienen agenda', () => {
    expect(periodoDeAgenda({ mesIdx: 11, anio: 2026, startDate: '2026-11-02', endDate: '2026-11-08' }, hoy)).toBeNull();
    expect(periodoDeAgenda({ mesIdx: 11, anio: 2026, startDate: '2026-11-09', endDate: '2026-11-09' }, hoy)).toBeNull();
  });

  it('febrero de un año bisiesto', () => {
    expect(periodoDeAgenda({ mesIdx: 2, anio: 2028 }, '2028-01-15')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });
});

describe('los 3 meses cerrados previos', () => {
  it('sin contar el mes en curso', () => {
    expect(mesesCerradosPrevios('2026-11-10')).toEqual([
      { anio: 2026, mes: 10 }, { anio: 2026, mes: 9 }, { anio: 2026, mes: 8 },
    ]);
  });

  it('cruza el año', () => {
    expect(mesesCerradosPrevios('2026-02-05')).toEqual([
      { anio: 2026, mes: 1 }, { anio: 2025, mes: 12 }, { anio: 2025, mes: 11 },
    ]);
  });
});

describe('armado de la respuesta', () => {
  const filas = [
    { entidadId: 'e1', entidad: 'NUEVA EPS', tipo: 'EPS', citas: 10, valor: 1000.4, citasSinValor: 0 },
    { entidadId: 'e2', entidad: 'SURA', tipo: 'EPS', citas: 5, valor: 499.6, citasSinValor: 2 },
    { entidadId: null, entidad: 'CONVENIO X', tipo: 'OTRO', citas: 1, valor: 0, citasSinValor: 1 },
  ];

  it('el total sale de las MISMAS filas: ficha y tabla no pueden discrepar', () => {
    const r = armarAgenda(filas, [], new Map(), '2026-11-30', '2026-11-10 15:00:00');
    expect(r.total).toEqual({ citas: 16, valor: 1500, citas_sin_valor: 3 });
    expect(r.por_entidad.reduce((s, e) => s + e.valor, 0)).toBe(r.total.valor);
  });

  it('el promedio de 3 meses es null cuando no hay historial: no se inventa', () => {
    const r = armarAgenda(filas, [], new Map([['e1', 1234.6]]), null, null);
    expect(r.por_entidad.map((e) => e.promedio_3m)).toEqual([1235, null, null]);
  });

  it('una EPS sin vincular (sin id) nunca recibe promedio', () => {
    const r = armarAgenda(filas, [], new Map([['null', 99]]), null, null);
    expect(r.por_entidad[2]!.promedio_3m).toBeNull();
  });

  it('actualizado_en sale en ISO (el pool entrega UTC)', () => {
    expect(armarAgenda([], [], new Map(), null, '2026-11-10 15:00:00').actualizado_en).toBe('2026-11-10T15:00:00.000Z');
    expect(aIso(null)).toBeNull();
    expect(aIso('basura')).toBeNull();
  });

  it('agenda vacía: ceros, no undefined', () => {
    const r = agendaVacia(null, null);
    expect(r).toMatchObject({ actualizado_en: null, horizonte: null, total: { citas: 0, valor: 0, citas_sin_valor: 0 }, por_entidad: [], por_dia: [] });
  });
});

describe('enriquecimiento de una cita', () => {
  const cita: FilaCita = {
    codAsignacion: 1, estado: 'P', fechaDia: '2026-11-12', fechaCita: '2026-11-12 09:00:00', convenioCod: 5,
    convenioNombre: 'SANITAS CONTRIBUTIVO', referenciaNombre: 'ELECTROMIOGRAFÍA DE MIEMBROS', cups: null, profesionalNombre: 'CRUZ',
  };
  const mk = (over: Partial<Resolutores> = {}): Resolutores => ({
    entidad: (n) => ({ 'SANITAS': 'e-sanitas', 'NUEVA EPS': 'e-nueva' } as Record<string, string>)[String(n).toUpperCase()] ?? null,
    especialidadDe: () => null,
    servicioNombre: () => null,
    ...over,
  });

  it('la EPS del catálogo de convenios manda sobre el nombre del convenio', () => {
    const r = enriquecerCita(cita, mk(), new Map([[5, 'NUEVA EPS']]));
    expect(r.entidadId).toBe('e-nueva');
  });

  it('sin catálogo, se vincula por el nombre del convenio', () => {
    const r = enriquecerCita({ ...cita, convenioNombre: 'SANITAS' }, mk(), new Map());
    expect(r.entidadId).toBe('e-sanitas');
  });

  it('si el catálogo trae una EPS que no casa, cae al nombre del convenio', () => {
    const r = enriquecerCita({ ...cita, convenioNombre: 'SANITAS' }, mk(), new Map([[5, 'EPS DESCONOCIDA']]));
    expect(r.entidadId).toBe('e-sanitas');
  });

  it('un convenio que no casa con nada queda sin EPS (se avisará), no con una inventada', () => {
    const r = enriquecerCita({ ...cita, convenioNombre: 'RARO' }, mk(), new Map());
    expect(r.entidadId).toBeNull();
  });

  it('el grupo sale del servicio del catálogo cuando las palabras clave lo resuelven', () => {
    const r = enriquecerCita(cita, mk({ servicioNombre: () => 'CONSULTA DE CONTROL NEUROLOGIA PEDIATRICA' }), new Map());
    expect(r.grupo).toBe('consulta_neurologia_pediatrica');
  });

  it('si las palabras clave no resuelven, usa el nombre de la referencia (con tilde)', () => {
    expect(enriquecerCita(cita, mk(), new Map()).grupo).toBe('emg_vcn');
  });

  it('la especialidad del profesional llega al resolutor de servicios', () => {
    let recibida: string | null = 'x';
    enriquecerCita(cita, mk({ especialidadDe: () => 'PEDIATRIA', servicioNombre: (_r, e) => { recibida = e; return null; } }), new Map());
    expect(recibida).toBe('PEDIATRIA');
  });

  it('una referencia que no encaja en ningún grupo no tiene grupo', () => {
    expect(enriquecerCita({ ...cita, referenciaNombre: 'LABORATORIO CLINICO' }, mk(), new Map()).grupo).toBeNull();
  });
});

describe('caché de reportes', () => {
  it('flushReportesCache borra también las claves con prefijo de fuente activa', async () => {
    // Antes borraba SOLO las que empezaban por «kpis:», «agenda:»…: con una fuente
    // marcada las claves son «f:<id>:kpis:…» y no borraba NADA.
    await redis.set('f:c1:kpis:11:2026', 'x', 'EX', 60);
    await redis.set('f:c1:agenda:11:2026', 'x', 'EX', 60);
    await redis.set('kpis:11:2026', 'x', 'EX', 60);
    await redis.set('otra:cosa', 'x', 'EX', 60);

    flushReportesCache();

    expect(await redis.get('f:c1:kpis:11:2026')).toBeNull();
    expect(await redis.get('f:c1:agenda:11:2026')).toBeNull();
    expect(await redis.get('kpis:11:2026')).toBeNull();
    expect(await redis.get('otra:cosa')).toBe('x');   // lo que no es de reportes no se toca
  });
});
