import { ritmoDelDia, horaDecimalBogota, armarEstadoTv, type EntradaEstadoTv } from '../../src/services/tv-estado';
import type { KpisResult } from '../../src/services/reportes.service';
import { agendaVacia, armarAgenda } from '../../src/services/agenda-periodo';

jest.mock('../../src/services/reportes.service', () => ({}));

// 10:30 a. m. en Bogotá = 15:30 UTC
const AHORA = new Date('2026-11-10T15:30:00Z');

describe('hora en Colombia', () => {
  it('UTC-5', () => {
    expect(horaDecimalBogota(AHORA)).toBeCloseTo(10.5, 5);
    expect(horaDecimalBogota(new Date('2026-11-11T02:00:00Z'))).toBeCloseTo(21, 5);   // 9 p. m. del 10
  });
});

describe('ritmo del día', () => {
  it('lo hecho ÷ horas laborales transcurridas (jornada desde las 6:00)', () => {
    const r = ritmoDelDia(AHORA, 9_000_000, 45);   // 4,5 h de jornada
    expect(r.horas_transcurridas).toBe(4.5);
    expect(r.facturado_por_hora).toBe(2_000_000);
    expect(r.atendidas_por_hora).toBe(10);
  });

  it('muy temprano NO se calcula: dividir por casi cero daría un ritmo disparatado', () => {
    const r = ritmoDelDia(new Date('2026-11-10T11:10:00Z'), 500_000, 3);   // 6:10 a. m.
    expect(r.facturado_por_hora).toBeNull();
    expect(r.atendidas_por_hora).toBeNull();
  });

  it('con menos de una hora de jornada NO se calcula (a las 6:45 una cita ya sería «1,3 por hora»)', () => {
    const r = ritmoDelDia(new Date('2026-11-10T11:45:00Z'), 2_000_000, 1);   // 6:45 a. m.
    expect(r.facturado_por_hora).toBeNull();
    expect(r.atendidas_por_hora).toBeNull();
    expect(ritmoDelDia(new Date('2026-11-10T12:00:00Z'), 2_000_000, 4).facturado_por_hora).toBe(2_000_000);   // 7:00 a. m.
  });

  it('antes de abrir (4 a. m.) no hay jornada: horas 0, sin ritmo, sin NaN', () => {
    const r = ritmoDelDia(new Date('2026-11-10T09:00:00Z'), 0, 0);
    expect(r.horas_transcurridas).toBe(0);
    expect(r.facturado_por_hora).toBeNull();
  });

  it('de noche las horas quedan en el tope de la jornada (14)', () => {
    const r = ritmoDelDia(new Date('2026-11-11T02:00:00Z'), 14_000_000, 70);   // 9 p. m.
    expect(r.horas_transcurridas).toBe(14);
    expect(r.facturado_por_hora).toBe(1_000_000);
  });

  it('sin facturar nada hoy el ritmo es 0, no null', () => {
    expect(ritmoDelDia(AHORA, 0, 0).facturado_por_hora).toBe(0);
  });
});

const kpis = (over: Partial<KpisResult> = {}): KpisResult => ({
  facturacion_bruta: 100, presupuesto: 400, cumplimiento_pct: 25, atenciones: 50, ticket_promedio: 2,
  proyeccion_cierre: 300, proyeccion_cumplimiento_pct: 75, dias_transcurridos: 8, dias_restantes: 14,
  facturacion_hoy: 20, promedio_diario: 12, semanas_en_meta: 0, semanas_total: 5, ...over,
});

const base = (over: Partial<EntradaEstadoTv> = {}): EntradaEstadoTv => ({
  ahora: AHORA, hoy: '2026-11-10', version: '1.9.99', mesIdx: 11, anio: 2026,
  kpis: kpis(),
  agendaMes: armarAgenda(
    [
      { entidadId: 'e1', entidad: 'NUEVA EPS', tipo: 'EPS', citas: 10, valor: 1000, citasSinValor: 1 },
      { entidadId: 'e2', entidad: 'SURA', tipo: 'EPS', citas: 5, valor: 3000, citasSinValor: 0 },
    ],
    [], new Map(), '2026-12-29', '2026-11-10 15:15:00'),
  agendaSemana: agendaVacia('2026-12-29', '2026-11-10 15:15:00'),
  citasDia: { fechaDia: '2026-11-10', syncEn: '2026-11-10 15:15:00', citas: [{ cod: 1, estado: 'C', hora: 8 }, { cod: 2, estado: 'P', hora: 14 }] },
  movimientos: [], consumosActualizado: '2026-11-10T15:00:00.000Z', cadenciaConsumosMin: 30, ...over,
});

describe('estado de la TV', () => {
  it('proyectado = facturado del mes + agendado del mes (la misma suma que en Reportes)', () => {
    const r = armarEstadoTv(base());
    expect(r.meta.agendado_mes.valor).toBe(4000);
    expect(r.meta.proyectado).toBe(100 + 4000);
  });

  it('las citas de otro día NO se muestran como de hoy', () => {
    const r = armarEstadoTv(base({ citasDia: { fechaDia: '2026-11-09', syncEn: '2026-11-09 20:00:00', citas: [{ cod: 1, estado: 'C', hora: 8 }] } }));
    expect(r.citas_hoy.total).toBe(0);
    expect(r.citas_hoy.es_de_hoy).toBe(false);
    expect(r.citas_hoy.actualizado_en).toBeNull();
  });

  it('dice POR QUÉ no hay citas de hoy: la última lectura falló, o aún no corrió', () => {
    expect(armarEstadoTv(base({ citasDia: null, lecturaCitasDia: 'error' })).citas_hoy.lectura).toBe('error');
    expect(armarEstadoTv(base({ citasDia: null, lecturaCitasDia: null })).citas_hoy.lectura).toBe('nunca');
    expect(armarEstadoTv(base({ citasDia: null, lecturaCitasDia: 'ok' })).citas_hoy.lectura).toBe('nunca');   // «ok» de ayer, hoy aún no
    expect(armarEstadoTv(base({ lecturaCitasDia: 'ok' })).citas_hoy.lectura).toBe('ok');
  });

  it('un fallo reciente se dice aunque haya una lectura de hoy guardada (puede estar atrasada)', () => {
    expect(armarEstadoTv(base({ lecturaCitasDia: 'error' })).citas_hoy.lectura).toBe('error');
  });

  it('sin citas de hoy guardadas (agenda sin activar): ceros, no error', () => {
    const r = armarEstadoTv(base({ citasDia: null }));
    expect(r.citas_hoy).toMatchObject({ atendidas: 0, pendientes: 0, incumplidas: 0, total: 0, es_de_hoy: false });
  });

  it('el ritmo usa las citas atendidas de hoy', () => {
    const r = armarEstadoTv(base());
    expect(r.ritmo.atendidas_por_hora).toBe(0.2);   // 1 atendida / 4,5 h
  });

  it('el top de EPS por valor agendado va ordenado y recortado a 5', () => {
    const muchas = Array.from({ length: 8 }, (_, i) => ({ entidadId: `e${i}`, entidad: `EPS ${i}`, tipo: 'EPS', citas: 1, valor: i * 10, citasSinValor: 0 }));
    const r = armarEstadoTv(base({ agendaMes: armarAgenda(muchas, [], new Map(), null, null) }));
    expect(r.agenda.top_entidades.map((x) => x.entidad)).toEqual(['EPS 7', 'EPS 6', 'EPS 5', 'EPS 4', 'EPS 3']);
  });

  it('los movimientos llevan la hora de DETECCIÓN en ISO', () => {
    const r = armarEstadoTv(base({ movimientos: [{ creado: '2026-11-10 15:07:00', tipo: 'atendidas', cantidad: 3, valor: null }] }));
    expect(r.movimientos[0]).toEqual({ tipo: 'atendidas', cantidad: 3, valor: null, detectado_en: '2026-11-10T15:07:00.000Z' });
  });

  it('no filtra datos de pacientes ni de honorarios: solo agregados', () => {
    const json = JSON.stringify(armarEstadoTv(base()));
    expect(json).not.toMatch(/paciente|documento|honorario|profesional/i);
  });
});
