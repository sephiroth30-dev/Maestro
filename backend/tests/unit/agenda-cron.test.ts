/**
 * Programación de la agenda: antes `scheduleConnector` cancelaba la tarea de la agenda
 * (llamaba a `unscheduleConnector`, que ahora detiene también la agenda), de modo que
 * con una frecuencia distinta de «manual» el cron de citas moría al nacer.
 */
const tareas: Array<{ expr: string; stopped: boolean }> = [];

jest.mock('node-cron', () => ({
  __esModule: true,
  default: {
    validate: () => true,
    schedule: (expr: string) => {
      const t = { expr, stopped: false, stop() { t.stopped = true; }, start() { /* noop */ } };
      tareas.push(t);
      return t;
    },
  },
}));
jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock('../../src/repositories/conectores.repo', () => ({ conectoresRepo: {} }));
jest.mock('../../src/services/sync.service', () => ({ syncService: {} }));
jest.mock('../../src/services/citas-sync.service', () => ({
  sincronizarCitasConCandado: jest.fn(),
  agendaActiva: () => true,
}));
jest.mock('../../src/repositories/agenda.repo', () => ({ leerEstadoSync: jest.fn() }));

import { scheduleAgenda, scheduleConnector, unscheduleConnector, CRON_AGENDA, CRON_SCHEDULES } from '../../src/services/cron.service';

const vivas = (): string[] => tareas.filter((t) => !t.stopped).map((t) => t.expr);

beforeEach(() => { tareas.length = 0; unscheduleConnector('c1'); });

describe('cron de la agenda', () => {
  it('sobrevive a la programación de los consumos (cualquier frecuencia)', () => {
    for (const expr of Object.values(CRON_SCHEDULES)) {
      tareas.length = 0; unscheduleConnector('c1');
      scheduleAgenda('c1', 'Medifolios');
      scheduleConnector('c1', 'Medifolios', expr);
      expect(vivas()).toContain(CRON_AGENDA);
      expect(vivas()).toContain(expr);
    }
  });

  it('reprogramar los consumos no duplica ni mata la agenda', () => {
    scheduleAgenda('c1', 'Medifolios');
    scheduleConnector('c1', 'Medifolios', '0 * * * *');
    scheduleConnector('c1', 'Medifolios', '*/30 * * * *');
    expect(vivas().filter((e) => e === CRON_AGENDA)).toHaveLength(1);
    expect(vivas().filter((e) => e === '0 * * * *')).toHaveLength(0);
  });

  it('unscheduleConnector sí detiene todo, la agenda incluida', () => {
    scheduleAgenda('c1', 'Medifolios');
    scheduleConnector('c1', 'Medifolios', '0 * * * *');
    unscheduleConnector('c1');
    expect(vivas()).toEqual([]);
  });

  it('nunca cae en el mismo minuto que los consumos: si coincidieran, el primero en registrarse ganaría siempre el candado', () => {
    const minutosAgenda = new Set(CRON_AGENDA.split(' ')[0]!.split(',').map(Number));
    for (const expr of Object.values(CRON_SCHEDULES)) {
      const campo = expr.split(' ')[0]!;
      const minutosConsumos = campo.startsWith('*/')
        ? Array.from({ length: 60 / Number(campo.slice(2)) }, (_, i) => i * Number(campo.slice(2)))
        : [Number(campo)];
      for (const m of minutosConsumos) expect(minutosAgenda.has(m)).toBe(false);
    }
  });
});
