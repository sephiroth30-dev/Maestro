import {
  planIncumplidas, planBasico, tareaHistorica, periodoDeFiltro, coberturaCompleta, respuestaSospechosa, rangoSospechoso, armarIncumplidas,
  inicioMesAnterior, limiteHistorico, fechaMenor, aplicarTarea, agregarPorDiaEntidad, porcentaje, MUESTRA_MINIMA, DIAS_VENTANA,
} from '../../src/services/incumplidas-plan';
import { aIso } from '../../src/services/agenda-periodo';
import type { FilaCita } from '../../src/services/agenda-mapeo';

const cob = (desde: string | null, hasta: string | null, ultimoDiario: string | null = null) => ({ desde, hasta, ultimoDiario });

describe('plan de la sincronización', () => {
  const hoy = '2026-11-14';

  it('la primera vez: la pasada diaria y luego la ventana de 7 días; sin cobertura conocida no hay histórico', () => {
    expect(planIncumplidas(hoy, null)).toEqual([
      { tipo: 'diario', desde: '2026-10-01', hasta: '2026-11-06' },
      { tipo: 'ventana', desde: '2026-11-07', hasta: '2026-11-14' },
    ]);
  });

  it('la ventana y la pasada diaria NO se pisan ni dejan hueco entre ellas', () => {
    const [d, v] = planBasico(hoy, null);
    const sig = (f: string): string => { const t = new Date(`${f}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };
    expect(sig(d!.hasta)).toBe(v!.desde);
  });

  it('la diaria va ANTES que la ventana: unos días sin sincronizar (≤ 1 mes) conservan el tramo cargado', () => {
    // Cargado hasta el 10-nov; se reanuda el 14-nov: la diaria (1-oct…6-nov) se pega, y la ventana (7…14-nov) se pega a ella.
    let c = cob('2026-09-01', '2026-11-10', '2026-11-10');
    for (const t of planBasico(hoy, c)) c = { ...aplicarTarea(c, t), ultimoDiario: c.ultimoDiario };
    expect(c).toMatchObject({ desde: '2026-09-01', hasta: hoy });
  });

  it('ya hecha la pasada diaria de hoy: solo la ventana (más el histórico si falta)', () => {
    expect(planIncumplidas(hoy, cob('2026-10-01', hoy, hoy)).map((t) => t.tipo)).toEqual(['ventana', 'historico']);
  });

  it('el histórico retrocede UN mes, justo antes de lo ya cubierto', () => {
    expect(tareaHistorica(hoy, cob('2026-10-01', hoy))).toEqual({ tipo: 'historico', desde: '2026-09-01', hasta: '2026-09-30' });
  });

  it('cruza el año', () => {
    expect(tareaHistorica('2026-02-10', cob('2026-01-01', '2026-02-10'))).toEqual({ tipo: 'historico', desde: '2025-12-01', hasta: '2025-12-31' });
  });

  it('se detiene en el 1 de enero del año anterior; un último mes parcial no pasa del límite', () => {
    expect(limiteHistorico(hoy)).toBe('2025-01-01');
    expect(tareaHistorica(hoy, cob('2025-01-01', hoy))).toBeNull();
    const t = tareaHistorica(hoy, cob('2025-01-15', hoy))!;
    expect(t.desde).toBe('2025-01-01');
    expect(t.hasta).toBe('2025-01-14');
  });

  it('sin cobertura no hay histórico', () => {
    expect(tareaHistorica(hoy, null)).toBeNull();
    expect(tareaHistorica(hoy, cob(null, null))).toBeNull();
  });

  it('al cambiar de día vuelve la pasada diaria', () => {
    expect(planBasico('2026-11-15', cob('2026-10-01', hoy, hoy)).map((t) => t.tipo)).toContain('diario');
  });

  it('utilidades', () => {
    expect(DIAS_VENTANA).toBe(7);
    expect(inicioMesAnterior('2026-01-20')).toBe('2025-12-01');
    expect(fechaMenor(null, '2026-01-01')).toBe('2026-01-01');
    expect(fechaMenor('2026-02-01', '2026-01-01')).toBe('2026-01-01');
    expect(fechaMenor('2026-01-01', '2026-02-01')).toBe('2026-01-01');
  });
});

describe('cobertura: un tramo SIN huecos', () => {
  it('sin cobertura previa, es la tarea', () => {
    expect(aplicarTarea(cob(null, null), { desde: '2026-11-07', hasta: '2026-11-14' })).toEqual({ desde: '2026-11-07', hasta: '2026-11-14' });
  });

  it('una tarea pegada o solapada se une', () => {
    expect(aplicarTarea(cob('2026-10-01', '2026-11-13'), { desde: '2026-11-07', hasta: '2026-11-14' })).toEqual({ desde: '2026-10-01', hasta: '2026-11-14' });
    expect(aplicarTarea(cob('2026-10-01', '2026-11-13'), { desde: '2026-11-14', hasta: '2026-11-14' })).toEqual({ desde: '2026-10-01', hasta: '2026-11-14' });   // pegada
  });

  it('el histórico se pega por detrás y extiende el inicio', () => {
    expect(aplicarTarea(cob('2026-10-01', '2026-11-14'), { desde: '2026-09-01', hasta: '2026-09-30' })).toEqual({ desde: '2026-09-01', hasta: '2026-11-14' });
  });

  it('HUECO (mucho tiempo sin sincronizar): el tramo se REINICIA; no se afirma lo que no se cargó', () => {
    // Antes: cobertura hasta el 6-nov; se reanuda el 20-ene-2027 con la ventana 13–20 ene.
    expect(aplicarTarea(cob('2026-05-01', '2026-11-06'), { desde: '2027-01-13', hasta: '2027-01-20' })).toEqual({ desde: '2027-01-13', hasta: '2027-01-20' });
  });

  it('una tarea vieja y desconectada no cambia nada', () => {
    expect(aplicarTarea(cob('2026-10-01', '2026-11-14'), { desde: '2026-03-01', hasta: '2026-03-31' })).toEqual({ desde: '2026-10-01', hasta: '2026-11-14' });
  });
});

describe('periodo del filtro', () => {
  it('un mes entero, bisiesto incluido', () => {
    expect(periodoDeFiltro({ mesIdx: 11, anio: 2026 })).toEqual({ desde: '2026-11-01', hasta: '2026-11-30' });
    expect(periodoDeFiltro({ mesIdx: 2, anio: 2028 })).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' });
  });

  it('un rango manda sobre el mes', () => {
    expect(periodoDeFiltro({ mesIdx: 11, anio: 2026, startDate: '2026-11-09', endDate: '2026-11-15' })).toEqual({ desde: '2026-11-09', hasta: '2026-11-15' });
  });

  it('NO se recorta a hoy: una incumplida siempre es una cita ya pasada', () => {
    expect(periodoDeFiltro({ mesIdx: 12, anio: 2030 }).hasta).toBe('2030-12-31');
  });
});

describe('cobertura completa del periodo', () => {
  const hoy = '2026-11-14';

  it('un periodo CERRADO no tiene el día de margen: sin el último día cargado, no es completo', () => {
    // Filtro «13-nov» visto el 14: lo cargado llega al 12 → falta el 13 → incompleto (con margen diría «completo»).
    expect(coberturaCompleta(cob('2026-10-01', '2026-11-12'), { desde: '2026-11-13', hasta: '2026-11-13' }, hoy)).toBe(false);
    expect(coberturaCompleta(cob('2026-10-01', '2026-11-13'), { desde: '2026-11-13', hasta: '2026-11-13' }, hoy)).toBe(true);
  });

  it('completa si empieza antes y llega hasta el final del periodo (o hasta hoy, con un día de margen)', () => {
    expect(coberturaCompleta(cob('2026-10-01', hoy), { desde: '2026-11-01', hasta: '2026-11-30' }, hoy)).toBe(true);
    expect(coberturaCompleta(cob('2026-11-01', '2026-11-13'), { desde: '2026-11-01', hasta: '2026-11-30' }, hoy)).toBe(true);   // la última pasada fue ayer
  });

  it('incompleta si empieza después del periodo', () => {
    expect(coberturaCompleta(cob('2026-11-02', hoy), { desde: '2026-11-01', hasta: '2026-11-30' }, hoy)).toBe(false);
  });

  it('incompleta si NO llega hasta ahora (el sistema lleva días sin sincronizar)', () => {
    expect(coberturaCompleta(cob('2026-01-01', '2026-11-06'), { desde: '2026-11-01', hasta: '2026-11-30' }, hoy)).toBe(false);
  });

  it('un periodo pasado solo necesita llegar hasta su final', () => {
    expect(coberturaCompleta(cob('2026-01-01', '2026-11-06'), { desde: '2026-09-01', hasta: '2026-09-30' }, hoy)).toBe(true);
  });

  it('sin nada cargado no es completa', () => {
    expect(coberturaCompleta(cob(null, null), { desde: '2026-11-01', hasta: '2026-11-30' }, hoy)).toBe(false);
    expect(coberturaCompleta(cob('2026-01-01', null), { desde: '2026-11-01', hasta: '2026-11-30' }, hoy)).toBe(false);
  });
});

describe('respuesta sospechosa', () => {
  it('vaciar o diezmar lo guardado no se acepta', () => {
    expect(respuestaSospechosa(200, 0)).toBe(true);
    expect(respuestaSospechosa(200, 99)).toBe(true);
  });

  it('un cambio normal sí (unas pasan a cumplidas)', () => {
    expect(respuestaSospechosa(200, 190)).toBe(false);
    expect(respuestaSospechosa(200, 100)).toBe(false);
    expect(respuestaSospechosa(200, 260)).toBe(false);
  });

  it('con pocas filas previas no se juzga', () => {
    expect(respuestaSospechosa(9, 0)).toBe(false);
    expect(respuestaSospechosa(0, 0)).toBe(false);
  });
});

const cita = (dia: string, convenio = 'SANITAS'): FilaCita => ({
  codAsignacion: 1, estado: 'I', fechaDia: dia, fechaCita: `${dia} 09:00:00`, convenioCod: 5, convenioNombre: convenio,
  referenciaNombre: 'X', cups: null, profesionalNombre: null,
});

describe('rango sospechoso (también la PRIMERA carga, sin filas previas)', () => {
  const n = (cumplidas: number, incumplidas: number) => ({ cumplidas, incumplidas });
  it('vaciar o diezmar lo guardado, en cualquiera de los dos estados', () => {
    expect(rangoSospechoso(n(100, 100), n(0, 0))).toBe(true);
    expect(rangoSospechoso(n(100, 100), n(100, 10))).toBe(true);
    expect(rangoSospechoso(n(100, 100), n(10, 100))).toBe(true);
  });
  it('muchas incumplidas y NINGUNA cumplida (o al revés) en la primera carga: sospechoso', () => {
    expect(rangoSospechoso(n(0, 0), n(0, 30))).toBe(true);
    expect(rangoSospechoso(n(0, 0), n(300, 0))).toBe(true);
  });
  it('lo normal pasa, incluida una carga primera pequeña o vacía', () => {
    expect(rangoSospechoso(n(0, 0), n(200, 60))).toBe(false);
    expect(rangoSospechoso(n(0, 0), n(0, 0))).toBe(false);      // un domingo / un periodo sin citas
    expect(rangoSospechoso(n(0, 0), n(0, 3))).toBe(false);      // pocas: no se juzga
    expect(rangoSospechoso(n(100, 100), n(90, 110))).toBe(false);
  });
});

describe('resumen por día y EPS', () => {
  it('convenios que la colación de la tabla considera iguales («Sanitas»/«SANITAS»/«Sánitas») son UNA fila', () => {
    const cita = (convenioNombre: string) => ({ fechaDia: '2026-11-10', convenioNombre } as unknown as FilaCita);
    const r = agregarPorDiaEntidad([cita('Sanitas'), cita('SANITAS')], [cita('Sánitas')], () => null);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ cumplidas: 2, incumplidas: 1 });
  });

  it('cuenta cumplidas e incumplidas por día y EPS', () => {
    const r = agregarPorDiaEntidad(
      [cita('2026-11-10'), cita('2026-11-10'), cita('2026-11-11')],
      [cita('2026-11-10')],
      () => 'e1',
    );
    expect(r).toEqual([
      { fechaDia: '2026-11-10', entidadId: 'e1', convenioNombre: '', cumplidas: 2, incumplidas: 1 },
      { fechaDia: '2026-11-11', entidadId: 'e1', convenioNombre: '', cumplidas: 1, incumplidas: 0 },
    ]);
  });

  it('una EPS vinculada ignora el convenio; una sin vincular se agrupa por convenio', () => {
    const e = (f: FilaCita): string | null => (f.convenioNombre === 'RARO' ? null : 'e1');
    const r = agregarPorDiaEntidad([cita('2026-11-10', 'A'), cita('2026-11-10', 'B'), cita('2026-11-10', 'RARO')], [cita('2026-11-10', 'RARO')], e);
    expect(r).toHaveLength(2);
    expect(r.find((x) => x.entidadId === 'e1')).toMatchObject({ cumplidas: 2, incumplidas: 0 });
    expect(r.find((x) => x.entidadId === '')).toMatchObject({ convenioNombre: 'RARO', cumplidas: 1, incumplidas: 1 });
  });

  it('sin citas, vacío', () => {
    expect(agregarPorDiaEntidad([], [], () => null)).toEqual([]);
  });
});

describe('porcentaje y respuesta de Reportes', () => {
  const hoy = '2026-11-14';
  const periodo = { desde: '2026-11-01', hasta: '2026-11-30' };
  const ok = { desde: '2026-10-01', hasta: hoy, ultimaOk: '2026-11-14 15:00:00', estado: 'ok' as const };
  const filas = [
    { entidadId: 'e1', entidad: 'NUEVA EPS', tipo: 'EPS', cumplidas: 270, incumplidas: 30 },
    { entidadId: 'e2', entidad: 'SANITAS', tipo: 'EPS', cumplidas: 80, incumplidas: 20 },
    { entidadId: null, entidad: 'CONVENIO X', tipo: 'OTRO', cumplidas: 2, incumplidas: 1 },
  ];

  it('porcentaje con un decimal; sin base, null', () => {
    expect(porcentaje(30, 300)).toBe(10);
    expect(porcentaje(1, 3)).toBe(33.3);
    expect(porcentaje(0, 10)).toBe(0);
    expect(porcentaje(5, 0)).toBeNull();
  });

  it('el % es incumplidas ÷ (cumplidas + incumplidas), por EPS y global; el total sale de las MISMAS filas', () => {
    const r = armarIncumplidas(filas, periodo, ok, aIso, hoy);
    expect(r.por_entidad[0]).toMatchObject({ entidad: 'NUEVA EPS', incumplidas: 30, cumplidas: 270, resueltas: 300, pct: 10, muestra_pequena: false });
    expect(r.por_entidad[1]).toMatchObject({ entidad: 'SANITAS', pct: 20 });
    expect(r.total).toEqual({ incumplidas: 51, cumplidas: 352, resueltas: 403, pct: 12.7 });
    expect(r.total.incumplidas).toBe(r.por_entidad.reduce((s, f) => s + f.incumplidas, 0));
  });

  it('con pocas citas resueltas el % se marca como poco fiable', () => {
    const r = armarIncumplidas(filas, periodo, ok, aIso, hoy);
    expect(r.por_entidad.find((f) => f.entidad === 'CONVENIO X')).toMatchObject({ resueltas: 3, pct: 33.3, muestra_pequena: true });
    expect(MUESTRA_MINIMA).toBe(10);
  });

  it('una EPS sin ninguna cita resuelta tiene % null, no 0', () => {
    const r = armarIncumplidas([{ entidadId: 'e1', entidad: 'A', tipo: 'EPS', cumplidas: 0, incumplidas: 0 }], periodo, ok, aIso, hoy);
    expect(r.por_entidad[0]!.pct).toBeNull();
  });

  it('ordena por incumplidas y, a igualdad, por nombre (un empate no cambia el orden entre llamadas)', () => {
    const r = armarIncumplidas([
      { entidadId: 'b', entidad: 'BETA', tipo: 'EPS', cumplidas: 10, incumplidas: 5 },
      { entidadId: 'a', entidad: 'ALFA', tipo: 'EPS', cumplidas: 10, incumplidas: 5 },
      { entidadId: 'c', entidad: 'GAMMA', tipo: 'EPS', cumplidas: 10, incumplidas: 9 },
    ], periodo, ok, aIso, hoy);
    expect(r.por_entidad.map((f) => f.entidad)).toEqual(['GAMMA', 'ALFA', 'BETA']);
  });

  it('la cobertura y el estado salen del estado guardado', () => {
    expect(armarIncumplidas(filas, periodo, ok, aIso, hoy).cobertura).toEqual({ desde: '2026-10-01', hasta: '2026-11-14', completa: true, actualizado_en: '2026-11-14T15:00:00.000Z', estado: 'ok' });
    expect(armarIncumplidas(filas, { desde: '2026-01-01', hasta: '2026-12-31' }, ok, aIso, hoy).cobertura.completa).toBe(false);
  });

  it('agenda SIN activar: estado null («no está activada»); activada pero sin sincronizar: «nunca» (mensajes distintos)', () => {
    expect(armarIncumplidas([], periodo, null, aIso, hoy, false).cobertura.estado).toBeNull();
    expect(armarIncumplidas([], periodo, null, aIso, hoy, true).cobertura.estado).toBe('nunca');
  });

  it('no filtra datos de pacientes', () => {
    expect(JSON.stringify(armarIncumplidas(filas, periodo, ok, aIso, hoy))).not.toMatch(/paciente|documento|nombres/i);
  });
});
