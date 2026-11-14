jest.mock('../../src/config/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

type Estado = { desde: string | null; hasta: string | null; ultimoDiario: string | null; estado: string; error: string | null; ultimaOk: string | null };
type Fila = { fechaDia: string; entidadId: string; cumplidas: number; incumplidas: number };
const bd: { filas: Fila[]; estado: Estado | null } = { filas: [], estado: null };

jest.mock('../../src/repositories/incumplidas.repo', () => ({
  leerEstado: async () => (bd.estado ? { conectorId: 'c1', ultimoIntento: null, ...bd.estado } : null),
  guardarEstado: async (_c: string, cambios: Partial<Estado>) => { bd.estado = { desde: null, hasta: null, ultimoDiario: null, estado: 'nunca', error: null, ultimaOk: null, ...(bd.estado ?? {}), ...cambios } as Estado; },
  contarVentana: async (_c: string, desde: string, hasta: string) => {
    const f = bd.filas.filter((x) => x.fechaDia >= desde && x.fechaDia <= hasta);
    return { cumplidas: f.reduce((s, x) => s + x.cumplidas, 0), incumplidas: f.reduce((s, x) => s + x.incumplidas, 0) };
  },
  reemplazarVentana: async (_c: string, desde: string, hasta: string, filas: Fila[]) => {
    bd.filas = bd.filas.filter((x) => !(x.fechaDia >= desde && x.fechaDia <= hasta)).concat(filas.map((f) => ({ ...f })));
  },
}));

import { sincronizarIncumplidas, type EntradaIncumplidas } from '../../src/services/incumplidas-sync.service';

const cruda = (cod: number, dia: string, estado: string, convenio = 'SANITAS') => ({
  codAsignacion: cod, fechaInicioCita: `${dia} 09:00:00`, estado, origen: 'agenda', codConvenio: 5, convenio, referencia: 'CONSULTA', cups: '1', profesional: 'X',
});

/** Un Medifolios simulado: devuelve las citas de `fuente` del estado y rango pedidos. */
const medifolios = (fuente: ReturnType<typeof cruda>[], pedidos: Array<[string, string, string]> = []) =>
  async (desde: string, hasta: string, estado: 'C' | 'I') => {
    pedidos.push([desde, hasta, estado]);
    return fuente.filter((c) => c.estado === estado && c.fechaInicioCita.slice(0, 10) >= desde && c.fechaInicioCita.slice(0, 10) <= hasta);
  };

const entrada = (pedir: EntradaIncumplidas['pedir'], hoy = '2026-11-14', extra: Partial<EntradaIncumplidas> = {}): EntradaIncumplidas => ({
  conectorId: 'c1', ahora: new Date(`${hoy}T15:00:00Z`), hoy, pedir, entidadDe: () => 'e1', ...extra,
});

const totales = (): { c: number; i: number } => ({ c: bd.filas.reduce((s, f) => s + f.cumplidas, 0), i: bd.filas.reduce((s, f) => s + f.incumplidas, 0) });

beforeEach(() => { bd.filas = []; bd.estado = null; });

describe('sincronización de cumplidas e incumplidas', () => {
  const datos = [
    cruda(1, '2026-11-13', 'I'), cruda(2, '2026-11-13', 'C'), cruda(3, '2026-11-13', 'C'), cruda(4, '2026-11-10', 'I'),
    cruda(5, '2026-10-20', 'C'), cruda(6, '2026-09-05', 'I'), cruda(7, '2026-09-06', 'C'),
  ];

  it('la primera vez carga la ventana y el mes anterior, guarda un RESUMEN por día y EPS, y deja la cobertura al día', async () => {
    const r = await sincronizarIncumplidas(entrada(medifolios(datos)));
    expect(r.tareas.map((t) => `${t.tipo}:${t.cumplidas}C/${t.incumplidas}I`)).toEqual(['diario:1C/0I', 'ventana:2C/2I']);
    expect(bd.estado).toMatchObject({ desde: '2026-10-01', hasta: '2026-11-14', ultimoDiario: '2026-11-14', estado: 'ok', error: null });
    expect(totales()).toEqual({ c: 3, i: 2 });
    expect(bd.filas.find((f) => f.fechaDia === '2026-11-13')).toMatchObject({ entidadId: 'e1', cumplidas: 2, incumplidas: 1 });
  });

  it('pide las DOS cosas (cumplidas e incumplidas) en cada tarea', async () => {
    const pedidos: Array<[string, string, string]> = [];
    await sincronizarIncumplidas(entrada(medifolios(datos, pedidos)));
    expect(pedidos.filter((p) => p[2] === 'C')).toHaveLength(2);
    expect(pedidos.filter((p) => p[2] === 'I')).toHaveLength(2);
  });

  it('en la vuelta de la pasada diaria NO se suma histórico (ya carga un mes entero)', async () => {
    const r = await sincronizarIncumplidas(entrada(medifolios(datos)));
    expect(r.tareas.map((t) => t.tipo)).toEqual(['diario', 'ventana']);
  });

  it('la vuelta siguiente: la ventana otra vez y UN mes más de histórico', async () => {
    await sincronizarIncumplidas(entrada(medifolios(datos)));
    const r = await sincronizarIncumplidas(entrada(medifolios(datos)));
    expect(r.tareas.map((t) => t.tipo)).toEqual(['ventana', 'historico']);
    expect(bd.estado!.desde).toBe('2026-09-01');
    expect(totales()).toEqual({ c: 4, i: 3 });   // septiembre ya está
  });

  it('con el tiempo llega al límite y deja de pedir histórico', async () => {
    const pedidos: Array<[string, string, string]> = [];
    for (let i = 0; i < 30; i++) await sincronizarIncumplidas(entrada(medifolios(datos, pedidos)));
    expect(bd.estado!.desde).toBe('2025-01-01');
    const antes = pedidos.length;
    await sincronizarIncumplidas(entrada(medifolios(datos, pedidos)));
    expect(pedidos.length - antes).toBe(2);   // solo la ventana (C e I)
  });

  it('una cita que pasó de incumplida a cumplida cambia el resumen en la siguiente lectura', async () => {
    await sincronizarIncumplidas(entrada(medifolios(datos)));
    expect(totales().i).toBe(2);
    await sincronizarIncumplidas(entrada(medifolios(datos.map((c) => (c.codAsignacion === 1 ? { ...c, estado: 'C' } : c)))));
    expect(bd.filas.find((f) => f.fechaDia === '2026-11-13')).toMatchObject({ cumplidas: 3, incumplidas: 0 });
  });

  it('una respuesta VACÍA no borra lo guardado (el error queda visible, sin avanzar la cobertura)', async () => {
    const muchas = Array.from({ length: 30 }, (_, i) => cruda(100 + i, '2026-11-12', i % 2 ? 'C' : 'I'));
    await sincronizarIncumplidas(entrada(medifolios(muchas)));
    const antes = totales();
    await expect(sincronizarIncumplidas(entrada(async () => []))).rejects.toThrow(/Se conservan las anteriores/);
    expect(totales()).toEqual(antes);
    expect(bd.estado).toMatchObject({ estado: 'error' });
  });

  it('el botón manual (forzar) acepta una respuesta que reduce mucho lo guardado: la guarda no puede bloquear para siempre', async () => {
    const muchas = Array.from({ length: 30 }, (_, i) => cruda(100 + i, '2026-11-12', i % 2 ? 'C' : 'I'));
    await sincronizarIncumplidas(entrada(medifolios(muchas)));
    await expect(sincronizarIncumplidas(entrada(medifolios([cruda(100, '2026-11-12', 'I')])))).rejects.toThrow();
    await sincronizarIncumplidas(entrada(medifolios([cruda(100, '2026-11-12', 'I')]), '2026-11-14', { forzar: true }));
    expect(totales().i).toBe(1);
    expect(bd.estado).toMatchObject({ estado: 'ok', error: null });
  });

  it('un fallo en una tarea no deshace lo guardado en las anteriores; la que falló se reintenta', async () => {
    let llamadas = 0;
    // Llamadas: 1-2 diaria (C, I), 3 = la ventana (C) → falla.
    const pedir: EntradaIncumplidas['pedir'] = async (d, h, e) => { if (++llamadas === 3) throw new Error('HTTP 500'); return medifolios(datos)(d, h, e); };
    await expect(sincronizarIncumplidas(entrada(pedir))).rejects.toThrow('500');
    expect(bd.filas.some((f) => f.fechaDia === '2026-10-20')).toBe(true);    // la diaria quedó
    expect(bd.filas.some((f) => f.fechaDia === '2026-11-13')).toBe(false);   // la ventana no
    expect(bd.estado).toMatchObject({ estado: 'error', ultimoDiario: '2026-11-14', hasta: '2026-11-06' });
    const r = await sincronizarIncumplidas(entrada(medifolios(datos)));
    expect(r.tareas.map((t) => t.tipo)).toContain('ventana');
    expect(bd.estado).toMatchObject({ estado: 'ok', hasta: '2026-11-14' });
  });

  it('la PRIMERA carga de un rango con muchas incumplidas y ninguna cumplida se rechaza (no se guarda un 100 %)', async () => {
    const solo = Array.from({ length: 30 }, (_, i) => cruda(200 + i, '2026-11-12', 'I'));
    await expect(sincronizarIncumplidas(entrada(medifolios(solo)))).rejects.toThrow(/sospechosa/);
    expect(totales()).toEqual({ c: 0, i: 0 });
    // «Sincronizar citas ahora» sí la acepta.
    await sincronizarIncumplidas(entrada(medifolios(solo), '2026-11-14', { forzar: true }));
    expect(totales().i).toBe(30);
  });

  it('solo se reemplaza el rango pedido: lo que la API devuelva de más no pisa otras fechas', async () => {
    bd.filas.push({ fechaDia: '2026-08-01', entidadId: 'e9', cumplidas: 5, incumplidas: 5 });
    await sincronizarIncumplidas(entrada(async (_d, _h, e) => (e === 'I' ? [cruda(1, '2026-11-13', 'I'), cruda(2, '2026-08-01', 'I')] : [])));
    expect(bd.filas.find((f) => f.fechaDia === '2026-08-01')).toMatchObject({ entidadId: 'e9', cumplidas: 5, incumplidas: 5 });
    expect(bd.filas.filter((f) => f.entidadId === 'e1' && f.fechaDia === '2026-08-01')).toHaveLength(0);
  });

  it('descarta lo que no es del estado pedido (si la API ignorara el filtro de estado)', async () => {
    await sincronizarIncumplidas(entrada(async () => [cruda(1, '2026-11-13', 'I'), cruda(2, '2026-11-13', 'C'), cruda(3, '2026-11-13', 'P')]));
    // Cada petición devuelve las tres: de la de C solo cuenta la C, de la de I solo la I.
    expect(totales()).toEqual({ c: 1, i: 1 });
  });

  it('guarda la EPS resuelta; una cita sin EPS se agrupa por su convenio', async () => {
    await sincronizarIncumplidas(entrada(medifolios([cruda(1, '2026-11-13', 'I', 'CONVENIO RARO')]), '2026-11-14', { entidadDe: () => null }));
    expect(bd.filas[0]).toMatchObject({ entidadId: '', incumplidas: 1 });
  });
});

describe('el hueco de cobertura que encontró la revisión', () => {
  it('unos días sin sincronizar (≤ 1 mes) NO pierden lo cargado', async () => {
    bd.estado = { desde: '2026-05-01', hasta: '2026-11-10', ultimoDiario: '2026-11-10', estado: 'ok', error: null, ultimaOk: null };
    await sincronizarIncumplidas(entrada(medifolios(datos)));
    expect(bd.estado).toMatchObject({ desde: '2026-05-01', hasta: '2026-11-14' });
  });

  const datos = [cruda(1, '2027-01-18', 'I'), cruda(2, '2026-11-15', 'C'), cruda(3, '2026-11-20', 'I')];

  it('tras más de un mes sin sincronizar, la cobertura se REINICIA: no afirma lo que no se cargó', async () => {
    // El sistema corrió hasta el 6-nov-2026 con todo cargado desde mayo.
    bd.estado = { desde: '2026-05-01', hasta: '2026-11-06', ultimoDiario: '2026-11-06', estado: 'ok', error: null, ultimaOk: null };
    // Se reanuda el 20-ene-2027.
    await sincronizarIncumplidas(entrada(medifolios(datos), '2027-01-20'));
    // La ventana (13–20 ene) y la diaria (1 dic–12 ene) forman el tramo nuevo; lo de noviembre NO está cargado.
    expect(bd.estado).toMatchObject({ hasta: '2027-01-20' });
    expect(bd.estado!.desde! >= '2026-12-01').toBe(true);
    expect(bd.estado!.desde).not.toBe('2026-05-01');
  });

  it('y el histórico retrocede desde el tramo NUEVO, no desde el viejo', async () => {
    bd.estado = { desde: '2026-05-01', hasta: '2026-11-06', ultimoDiario: '2026-11-06', estado: 'ok', error: null, ultimaOk: null };
    const pedidos: Array<[string, string, string]> = [];
    await sincronizarIncumplidas(entrada(medifolios(datos, pedidos), '2027-01-20'));    // la vuelta del hueco: ventana y diaria
    await sincronizarIncumplidas(entrada(medifolios(datos, pedidos), '2027-01-20'));    // la siguiente: el histórico
    const hist = pedidos.filter((p) => p[0] === '2026-11-01');   // el mes que queda justo antes de diciembre
    expect(hist.length).toBeGreaterThan(0);
    expect(pedidos.some((p) => p[0] === '2026-04-01')).toBe(false);   // NO retrocedió desde mayo (el tramo viejo)
  });
});
