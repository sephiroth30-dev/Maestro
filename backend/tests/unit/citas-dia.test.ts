import type { CitasDiaGuardadas } from '../../src/repositories/tv.repo';

jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const guardado: {
  citasDia: CitasDiaGuardadas | null; reemplazos: unknown[]; movimientos: Array<{ tipo: string; cantidad: number }>;
  fotos: Array<{ facturado: number; atendidas: number; pendientes: number; incumplidas: number; fechaDia: string }>; fallaFoto: boolean;
} = { citasDia: null, reemplazos: [], movimientos: [], fotos: [], fallaFoto: false };
jest.mock('../../src/repositories/reportes.repo', () => ({ getFacturacionDia: async () => 12_345_678 }));
jest.mock('../../src/repositories/tv.repo', () => ({
  leerCitasDia: async () => guardado.citasDia,
  // La lectura y sus movimientos van en la MISMA llamada (una transacción).
  reemplazarCitasDia: async (...a: unknown[]) => { guardado.reemplazos.push(a); guardado.movimientos.push(...((a[4] ?? []) as Array<{ tipo: string; cantidad: number }>)); },
  insertarMovimientos: async (m: Array<{ tipo: string; cantidad: number }>) => { guardado.movimientos.push(...m); },
  purgarMovimientos: async () => undefined,
  insertarFoto: async (f: { facturado: number; atendidas: number; pendientes: number; incumplidas: number; fechaDia: string }) => {
    if (guardado.fallaFoto) throw new Error('foto');
    guardado.fotos.push(f);
  },
  purgarSerie: async () => undefined,
}));

import { actualizarCitasDia, type EntradaCitasDia } from '../../src/services/citas-dia.service';

const AHORA = new Date('2026-11-10T15:30:00Z');   // 10:30 a. m. en Bogotá
const HOY = '2026-11-10';
const cruda = (cod: number, estado: string, hora = '09:00:00') => ({
  codAsignacion: cod, fechaInicioCita: `${HOY} ${hora}`, estado, origen: 'agenda', codConvenio: 5, convenio: 'X', referencia: 'Y', cups: '1', profesional: 'Z',
});
const pend = (cod: number, dia = HOY) => ({ codAsignacion: cod, fechaCita: `${dia} 11:00:00`, fechaDia: dia });

const entrada = (over: Partial<EntradaCitasDia> = {}): EntradaCitasDia => ({
  conectorId: 'c1', ahora: AHORA, hoy: HOY,
  pendientes: [pend(1), pend(2), pend(3, '2026-11-12')],
  codigosAgendaPrevios: new Set([1, 2, 3]),
  ultimaOkPrevia: '2026-11-10 15:15:00',
  pedir: async (estado) => (estado === 'C' ? [] : []),
  ...over,
});

beforeEach(() => { guardado.citasDia = null; guardado.reemplazos = []; guardado.movimientos = []; guardado.fotos = []; guardado.fallaFoto = false; });

describe('citas de hoy y movimientos para la TV', () => {
  it('la primera lectura del día guarda las citas y NO inventa movimientos', async () => {
    const r = await actualizarCitasDia(entrada({ pedir: async (e) => (e === 'C' ? [cruda(10, 'C'), cruda(11, 'C')] : [cruda(12, 'I')]) }));
    expect(r.movimientos).toEqual([]);
    expect(r.citas).toBe(5);   // 2 pendientes de hoy + 2 cumplidas + 1 incumplida (la del 12-nov no es de hoy)
    expect(guardado.reemplazos).toHaveLength(1);
  });

  it('detecta lo que pasó de pendiente a cumplida entre dos lecturas', async () => {
    guardado.citasDia = { fechaDia: HOY, syncEn: '2026-11-10 15:15:00', citas: [{ cod: 1, estado: 'P', hora: 11 }, { cod: 2, estado: 'P', hora: 11 }] };
    const r = await actualizarCitasDia(entrada({ pedir: async (e) => (e === 'C' ? [cruda(1, 'C', '11:00:00')] : []) }));
    expect(r.movimientos).toEqual([{ tipo: 'atendidas', cantidad: 1, valor: null }]);
    expect(guardado.movimientos).toEqual([{ tipo: 'atendidas', cantidad: 1, valor: null }]);
  });

  it('una lectura de AYER no sirve para comparar: no hay movimientos', async () => {
    guardado.citasDia = { fechaDia: '2026-11-09', syncEn: '2026-11-09 23:00:00', citas: [{ cod: 1, estado: 'P', hora: 11 }] };
    const r = await actualizarCitasDia(entrada({ pedir: async (e) => (e === 'C' ? [cruda(1, 'C')] : []) }));
    expect(r.movimientos).toEqual([]);
  });

  it('pasada la medianoche, una lectura de hace 10 minutos pero del día anterior tampoco se compara', async () => {
    // 12:05 a. m. del 10-nov en Bogotá; la lectura previa (11:55 p. m. del 9) es reciente pero de OTRO día.
    guardado.citasDia = { fechaDia: '2026-11-09', syncEn: '2026-11-10 04:55:00', citas: [{ cod: 1, estado: 'P', hora: 11 }] };
    const r = await actualizarCitasDia(entrada({
      ahora: new Date('2026-11-10T05:05:00Z'), ultimaOkPrevia: '2026-11-10 04:55:00',
      pedir: async (e) => (e === 'C' ? [cruda(1, 'C')] : []),
    }));
    expect(r.movimientos).toEqual([]);
  });

  it('una lectura de hace más de 3 horas tampoco: un hueco no es un movimiento', async () => {
    guardado.citasDia = { fechaDia: HOY, syncEn: '2026-11-10 11:00:00', citas: [{ cod: 1, estado: 'P', hora: 11 }] };
    const r = await actualizarCitasDia(entrada({ pedir: async (e) => (e === 'C' ? [cruda(1, 'C')] : []) }));
    expect(r.movimientos).toEqual([]);
  });

  it('detecta citas nuevas en la agenda (misma ventana)', async () => {
    const r = await actualizarCitasDia(entrada({ pendientes: [pend(1), pend(2), pend(3, '2026-11-12'), pend(4), pend(5)] }));
    expect(r.movimientos).toContainEqual({ tipo: 'agendadas', cantidad: 2, valor: null });
  });

  it('al cambiar de mes (ventana distinta) no hay «agendadas» de golpe', async () => {
    const r = await actualizarCitasDia(entrada({
      ahora: new Date('2026-12-01T14:00:00Z'), hoy: '2026-12-01', ultimaOkPrevia: '2026-11-30 22:00:00',
      pendientes: Array.from({ length: 400 }, (_, i) => pend(100 + i, '2026-12-20')),
    }));
    expect(r.movimientos.find((m) => m.tipo === 'agendadas')).toBeUndefined();
  });

  it('si falla la petición de hoy NO se reemplaza nada: la TV conserva la lectura anterior', async () => {
    await expect(actualizarCitasDia(entrada({ pedir: async () => { throw new Error('HTTP 403'); } }))).rejects.toThrow('403');
    expect(guardado.reemplazos).toEqual([]);
  });

  it('...pero lo agendado ya detectado NO se pierde (la agenda ya se reemplazó y no volvería a salir como nuevo)', async () => {
    await expect(actualizarCitasDia(entrada({
      pendientes: [pend(1), pend(2), pend(3, '2026-11-12'), pend(4), pend(5)],
      pedir: async () => { throw new Error('HTTP 500'); },
    }))).rejects.toThrow('500');
    expect(guardado.reemplazos).toEqual([]);
    expect(guardado.movimientos).toEqual([{ tipo: 'agendadas', cantidad: 2, valor: null }]);
  });

  it('una respuesta VACÍA de cumplidas no borra lo ya visto, y la siguiente lectura correcta NO cuenta «+N atendidas» falsas', async () => {
    guardado.citasDia = { fechaDia: HOY, syncEn: '2026-11-10 15:15:00', citas: [{ cod: 10, estado: 'C', hora: 8 }, { cod: 11, estado: 'C', hora: 8 }, { cod: 2, estado: 'P', hora: 11 }] };
    // Lectura con fallo a medias: la API responde 200 con lista vacía
    const r1 = await actualizarCitasDia(entrada({ pedir: async () => [] }));
    expect(r1.movimientos).toEqual([]);
    const guardada = guardado.reemplazos[0] as unknown[];
    const citas = guardada[2] as Array<{ cod: number; estado: string }>;
    expect(citas.filter((x) => x.estado === 'C').map((x) => x.cod).sort()).toEqual([10, 11]);   // se arrastraron

    // Lectura siguiente, ya correcta: las mismas dos cumplidas
    guardado.citasDia = { fechaDia: HOY, syncEn: '2026-11-10 15:20:00', citas: citas as never };
    guardado.movimientos = [];
    const r2 = await actualizarCitasDia(entrada({ ahora: new Date('2026-11-10T15:35:00Z'), pedir: async (e) => (e === 'C' ? [cruda(10, 'C'), cruda(11, 'C')] : []) }));
    expect(r2.movimientos).toEqual([]);   // antes: «+2 atendidas» falsas
  });

  it('una cita arrastrada como cumplida que ahora aparece pendiente manda la pendiente (no se duplica)', async () => {
    guardado.citasDia = { fechaDia: HOY, syncEn: '2026-11-10 15:15:00', citas: [{ cod: 1, estado: 'C', hora: 11 }] };
    const r = await actualizarCitasDia(entrada({ pedir: async () => [] }));
    const citas = (guardado.reemplazos[0] as unknown[])[2] as Array<{ cod: number; estado: string }>;
    expect(citas.filter((x) => x.cod === 1)).toEqual([{ cod: 1, estado: 'P', hora: 11 }]);
    expect(r.citas).toBe(2);
  });

  it('una lectura previa de hace más de 3 h: lo agendado en el hueco NO sale como «+N»', async () => {
    const r = await actualizarCitasDia(entrada({
      ultimaOkPrevia: '2026-11-10 09:00:00',
      pendientes: [pend(1), pend(2), pend(3, '2026-11-12'), pend(4), pend(5)],
    }));
    expect(r.movimientos.find((m) => m.tipo === 'agendadas')).toBeUndefined();
  });

  it('guarda UNA foto de las cifras del día en cada lectura (para el gráfico y la comparación con ayer)', async () => {
    await actualizarCitasDia(entrada({ pedir: async (e) => (e === 'C' ? [cruda(10, 'C'), cruda(11, 'C')] : [cruda(12, 'I')]) }));
    expect(guardado.fotos).toEqual([{ ts: AHORA, fechaDia: HOY, facturado: 12_345_678, atendidas: 2, pendientes: 2, incumplidas: 1 }]);
  });

  it('NO se guarda foto fuera de horario (noche, domingo): haría que el lunes el «día anterior» fuera el domingo en 0', async () => {
    // domingo 15-nov, 11:00 a. m. en Bogotá
    await actualizarCitasDia(entrada({ ahora: new Date('2026-11-15T16:00:00Z'), hoy: '2026-11-15' }));
    expect(guardado.fotos).toEqual([]);
    // martes 9 p. m.
    await actualizarCitasDia(entrada({ ahora: new Date('2026-11-11T02:00:00Z'), hoy: '2026-11-10' }));
    expect(guardado.fotos).toEqual([]);
    // pero la lectura de las citas SÍ se guardó
    expect(guardado.reemplazos).toHaveLength(2);
  });

  it('si falla guardar la foto, la lectura de las citas NO se ve afectada', async () => {
    guardado.fallaFoto = true;
    const r = await actualizarCitasDia(entrada());
    expect(r.citas).toBe(2);
    expect(guardado.reemplazos).toHaveLength(1);
  });

  it('si falla la petición de hoy, no se guarda foto (no hay lectura nueva)', async () => {
    await expect(actualizarCitasDia(entrada({ pedir: async () => { throw new Error('x'); } }))).rejects.toThrow();
    expect(guardado.fotos).toEqual([]);
  });

  it('una cita en dos estados queda en el más avanzado, sin duplicarse', async () => {
    const r = await actualizarCitasDia(entrada({ pedir: async (e) => (e === 'C' ? [cruda(1, 'C')] : []) }));
    expect(r.citas).toBe(2);   // cita 1 (C, no P) y cita 2 (P)
  });
});
