import {
  minutoDelDiaBogota, puntoEnMomento, compararConPrevia, diasHabilesDelMes, variacionPct, type PuntoSerie,
} from '../../src/services/tv-serie';
import { armarEps, armarEstadoTv, MAX_EPS_TV, type EntradaEstadoTv } from '../../src/services/tv-estado';
import type { KpisResult, EntidadRow } from '../../src/services/reportes.service';
import { agendaVacia, armarAgenda } from '../../src/services/agenda-periodo';

jest.mock('../../src/services/reportes.service', () => ({}));

const T = (iso: string): number => Date.parse(iso);
const p = (iso: string, facturado: number, atendidas = 0): PuntoSerie => ({ ts: iso, facturado, atendidas, pendientes: 0, incumplidas: 0 });

describe('minuto del día en Colombia', () => {
  it('UTC-5', () => {
    expect(minutoDelDiaBogota(T('2026-11-10T15:30:00Z'))).toBe(10 * 60 + 30);
    expect(minutoDelDiaBogota(T('2026-11-11T02:00:00Z'))).toBe(21 * 60);
    expect(minutoDelDiaBogota(T('2026-11-10T05:00:00Z'))).toBe(0);
  });
});

describe('punto de la serie en un momento del día', () => {
  const serie = [p('2026-11-09T12:00:00Z', 1_000_000), p('2026-11-09T14:00:00Z', 5_000_000), p('2026-11-09T17:00:00Z', 9_000_000)];   // 7:00, 9:00, 12:00

  it('es el ÚLTIMO punto a esa hora o antes: la cifra vigente entonces, sin interpolar', () => {
    expect(puntoEnMomento(serie, 10 * 60)!.facturado).toBe(5_000_000);
    expect(puntoEnMomento(serie, 9 * 60)!.facturado).toBe(5_000_000);   // justo a las 9:00
    expect(puntoEnMomento(serie, 23 * 60)!.facturado).toBe(9_000_000);
  });

  it('antes del primer punto del día no hay nada', () => {
    expect(puntoEnMomento(serie, 6 * 60)).toBeNull();
  });

  it('no depende del orden de la lista', () => {
    expect(puntoEnMomento([...serie].reverse(), 10 * 60)!.facturado).toBe(5_000_000);
  });

  it('ignora puntos con fecha ilegible', () => {
    expect(puntoEnMomento([p('basura', 99), ...serie], 10 * 60)!.facturado).toBe(5_000_000);
  });

  it('serie vacía: nada', () => {
    expect(puntoEnMomento([], 600)).toBeNull();
  });
});

describe('comparación con el día anterior a la misma hora', () => {
  const previa = { fecha: '2026-11-09', puntos: [p('2026-11-09T14:00:00Z', 5_000_000, 20), p('2026-11-09T17:00:00Z', 9_000_000, 40)] };

  it('hoy menos lo que había ayer a esta hora', () => {
    const r = compararConPrevia({ facturado: 6_400_000, atendidas: 26 }, previa, T('2026-11-10T15:30:00Z'));   // 10:30 a. m.
    expect(r).toEqual({ fecha: '2026-11-09', facturado: 1_400_000, atendidas: 6 });
  });

  it('una diferencia NEGATIVA se conserva (se verá en rojo)', () => {
    expect(compararConPrevia({ facturado: 4_000_000, atendidas: 10 }, previa, T('2026-11-10T15:30:00Z'))!.facturado).toBe(-1_000_000);
  });

  it('ayer aún no tenía datos a esta hora (arrancó más tarde): se dice «sin dato», no se inventa', () => {
    const r = compararConPrevia({ facturado: 100, atendidas: 1 }, previa, T('2026-11-10T11:30:00Z'));   // 6:30 a. m.
    expect(r).toEqual({ fecha: '2026-11-09', facturado: null, atendidas: null });
  });

  it('la primera jornada de la serie (sin día anterior): null', () => {
    expect(compararConPrevia({ facturado: 1, atendidas: 1 }, null, T('2026-11-10T15:30:00Z'))).toBeNull();
    expect(compararConPrevia({ facturado: 1, atendidas: 1 }, { fecha: '2026-11-09', puntos: [] }, T('2026-11-10T15:30:00Z'))).toBeNull();
  });
});

describe('días hábiles y variación', () => {
  it('lunes a viernes: noviembre de 2026 tiene 21', () => {
    expect(diasHabilesDelMes(2026, 11)).toBe(21);
    expect(diasHabilesDelMes(2028, 2)).toBe(21);   // febrero bisiesto
  });

  it('variación contra el promedio; sin promedio válido, null (no se inventa)', () => {
    expect(variacionPct(1_200, 1_000)).toBe(20);
    expect(variacionPct(800, 1_000)).toBe(-20);
    expect(variacionPct(5, null)).toBeNull();
    expect(variacionPct(5, 0)).toBeNull();
    expect(variacionPct(5, -3)).toBeNull();
    expect(variacionPct(NaN, 10)).toBeNull();
  });
});

const ent = (id: string | null, entidad: string, valor: number, tipo = 'EPS'): EntidadRow =>
  ({ id, entidad, tipo, es_grupo: false, cantidad: 1, valor_bruto: valor, participacion_pct: 0 });
const ag = (id: string | null, entidad: string, valor: number, citas: number, prom: number | null) =>
  ({ entidad_id: id, entidad, tipo: 'EPS', citas, valor, promedio_3m: prom });

describe('EPS como símbolos de la pantalla', () => {
  it('une facturado del mes, de hoy y agendado por id; la variación sale de proyectado ÷ promedio', () => {
    const r = armarEps([ent('e1', 'NUEVA EPS', 100)], [ent('e1', 'NUEVA EPS', 10)], [ag('e1', 'NUEVA EPS', 50, 7, 100)]);
    expect(r).toEqual([{
      id: 'e1', entidad: 'NUEVA EPS', tipo: 'EPS', facturado_mes: 100, facturado_hoy: 10, agendado_valor: 50, agendado_citas: 7,
      proyectado: 150, promedio_3m: 100, variacion_pct: 50,
    }]);
  });

  it('una EPS que solo existe por la agenda también aparece (aún no facturó nada)', () => {
    const r = armarEps([], [], [ag('e2', 'SURA', 40, 3, null)]);
    expect(r[0]).toMatchObject({ entidad: 'SURA', facturado_mes: 0, proyectado: 40, variacion_pct: null });
  });

  it('una EPS sin vincular (sin id) se cruza por nombre', () => {
    const r = armarEps([ent(null, 'Convenio X', 30)], [], [ag(null, 'CONVENIO X', 10, 1, null)]);
    expect(r).toHaveLength(1);
    expect(r[0]!.proyectado).toBe(40);
  });

  it('sin promedio la variación es null (no se pinta de verde ni de rojo)', () => {
    expect(armarEps([ent('e1', 'A', 10)], [], [])[0]!.variacion_pct).toBeNull();
  });

  it('ordena por proyectado y recorta', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ent(`e${i}`, `EPS ${i}`, i + 1));
    const r = armarEps(muchas, [], []);
    expect(r).toHaveLength(MAX_EPS_TV);
    expect(r[0]!.entidad).toBe('EPS 29');
    expect(r.map((x) => x.proyectado)).toEqual([...r.map((x) => x.proyectado)].sort((a, b) => b - a));
  });

  it('excluye las EPS sin nada que mostrar', () => {
    expect(armarEps([ent('e1', 'A', 0)], [], [])).toEqual([]);
  });
});

const kpis = (over: Partial<KpisResult> = {}): KpisResult => ({
  facturacion_bruta: 100, presupuesto: 2100, cumplimiento_pct: 5, atenciones: 50, ticket_promedio: 2,
  proyeccion_cierre: 300, proyeccion_cumplimiento_pct: 75, dias_transcurridos: 8, dias_restantes: 14,
  facturacion_hoy: 20, promedio_diario: 12, semanas_en_meta: 0, semanas_total: 5, ...over,
});
const base = (over: Partial<EntradaEstadoTv> = {}): EntradaEstadoTv => ({
  ahora: new Date('2026-11-10T15:30:00Z'), hoy: '2026-11-10', version: '1', mesIdx: 11, anio: 2026, kpis: kpis(),
  agendaMes: armarAgenda([{ entidadId: 'e1', entidad: 'NUEVA EPS', tipo: 'EPS', citas: 10, valor: 1000, citasSinValor: 0 }], [], new Map([['e1', 800]]), null, null),
  agendaSemana: agendaVacia(null, null),
  citasDia: { fechaDia: '2026-11-10', syncEn: '2026-11-10 15:15:00', citas: [{ cod: 1, estado: 'C', hora: 8 }] },
  movimientos: [], consumosActualizado: null, cadenciaConsumosMin: 30, lecturaCitasDia: 'ok',
  entidadesMes: [ent('e1', 'NUEVA EPS', 500)], entidadesHoy: [ent('e1', 'NUEVA EPS', 20)], diarios: [{ fecha: '2026-11-09', total: 90.4 }],
  serieHoy: [p('2026-11-10T15:15:00Z', 20, 1)], seriePrevia: { fecha: '2026-11-09', puntos: [p('2026-11-09T14:00:00Z', 5, 0)] }, ...over,
});

describe('estado de la TV: serie, EPS y velas', () => {
  it('la meta diaria es el presupuesto ÷ días hábiles del mes', () => {
    expect(armarEstadoTv(base()).dias_mes.meta_dia).toBe(100);   // 2100 ÷ 21
  });

  it('las velas llevan lo facturado por día, redondeado', () => {
    expect(armarEstadoTv(base()).dias_mes.dias).toEqual([{ fecha: '2026-11-09', facturado: 90 }]);
  });

  it('la serie de hoy va en ISO y la del día anterior se compara a la misma hora', () => {
    const r = armarEstadoTv(base());
    expect(r.serie.puntos[0]!.ts).toBe('2026-11-10T15:15:00.000Z');
    expect(r.previa!.fecha).toBe('2026-11-09');
    expect(r.vs_previa).toEqual({ fecha: '2026-11-09', facturado: 15, atendidas: 1 });   // 20 − 5 ; 1 − 0
  });

  it('la primera jornada no tiene día anterior ni comparación', () => {
    const r = armarEstadoTv(base({ seriePrevia: null }));
    expect(r.previa).toBeNull();
    expect(r.vs_previa).toBeNull();
  });

  it('las EPS salen con su variación contra el promedio', () => {
    const e = armarEstadoTv(base()).eps[0]!;
    expect(e).toMatchObject({ entidad: 'NUEVA EPS', facturado_mes: 500, facturado_hoy: 20, agendado_valor: 1000, proyectado: 1500, variacion_pct: 87.5 });
  });

  it('sigue sin filtrar pacientes ni honorarios', () => {
    expect(JSON.stringify(armarEstadoTv(base()))).not.toMatch(/paciente|documento|honorario|profesional/i);
  });
});
