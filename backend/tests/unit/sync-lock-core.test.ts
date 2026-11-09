import { crearAdquisidor, nombreCandado, type ConexionCandado } from '../../src/services/sync-lock.core';

/**
 * El defecto que motivó esto: varias sincronizaciones de la MISMA fuente a la
 * vez (cada proceso programa el mismo cron), que se pisaban el token (HTTP 401)
 * o chocaban al insertar las mismas filas (Duplicate entry).
 */

type Falsa = ConexionCandado & {
  consultas: string[];
  liberada: number;
  destruida: number;
  fallarLatido: boolean;
};

/** Un «MySQL» mínimo: un nombre de candado solo puede tenerlo una conexión a la vez. */
function servidorFalso(): { conexion: () => Promise<ConexionCandado>; tomados: Set<string>; abiertas: Falsa[] } {
  const tomados = new Set<string>();
  const abiertas: Falsa[] = [];

  function nueva(): Falsa {
    const c: Falsa = {
      consultas: [],
      liberada: 0,
      destruida: 0,
      fallarLatido: false,
      async query(sql: string, params?: unknown[]): Promise<unknown> {
        c.consultas.push(sql);
        if (sql.includes('GET_LOCK')) {
          const n = String(params?.[0]);
          if (tomados.has(n)) return [[{ ok: 0 }], []];
          tomados.add(n);
          return [[{ ok: 1 }], []];
        }
        if (sql.includes('RELEASE_LOCK')) {
          tomados.delete(String(params?.[0]));
          return [[{ ok: 1 }], []];
        }
        if (sql.includes('SELECT 1') && c.fallarLatido) throw new Error('MySQL server has gone away');
        return [[{}], []];
      },
      release() { c.liberada++; },
      destroy() { c.destruida++; },
    };
    abiertas.push(c);
    return c;
  }

  return { conexion: async () => nueva(), tomados, abiertas };
}

describe('candado de sincronización', () => {
  afterEach(() => { jest.useRealTimers(); });

  it('el primero lo obtiene y el segundo, simultáneo, NO: es el caso del cron en varios procesos', async () => {
    const srv = servidorFalso();
    const adquirir = crearAdquisidor(srv.conexion);

    const a = await adquirir('conector-1');
    const b = await adquirir('conector-1');

    expect(a).not.toBeNull();
    expect(b).toBeNull();
    await a?.liberar();
  });

  it('el que no lo obtiene devuelve su conexión al pool', async () => {
    const srv = servidorFalso();
    const adquirir = crearAdquisidor(srv.conexion);

    await adquirir('c');
    await adquirir('c');

    // abiertas[1] es la del segundo intento: no se queda secuestrada.
    expect(srv.abiertas[1]!.liberada).toBe(1);
  });

  it('conectores distintos no se bloquean entre sí', async () => {
    const srv = servidorFalso();
    const adquirir = crearAdquisidor(srv.conexion);

    const sheet = await adquirir('sheet');
    const medifolios = await adquirir('medifolios');

    expect(sheet).not.toBeNull();
    expect(medifolios).not.toBeNull();
    await sheet?.liberar();
    await medifolios?.liberar();
  });

  it('al liberar, otro puede tomarlo', async () => {
    const srv = servidorFalso();
    const adquirir = crearAdquisidor(srv.conexion);

    const a = await adquirir('c');
    await a!.liberar();
    const b = await adquirir('c');

    expect(b).not.toBeNull();
    expect(srv.tomados.has(nombreCandado('c'))).toBe(true);
    await b?.liberar();
    expect(srv.tomados.size).toBe(0);
  });

  it('liberar es idempotente: no suelta dos veces ni devuelve la conexión dos veces', async () => {
    const srv = servidorFalso();
    const adquirir = crearAdquisidor(srv.conexion);

    const a = await adquirir('c');
    await a!.liberar();
    await a!.liberar();

    expect(srv.abiertas[0]!.liberada).toBe(1);
    expect(srv.abiertas[0]!.consultas.filter((q) => q.includes('RELEASE_LOCK'))).toHaveLength(1);
  });

  it('si GET_LOCK falla, propaga el error Y devuelve la conexión', async () => {
    const srv = servidorFalso();
    const conn = await srv.conexion() as Falsa;
    conn.query = async () => { throw new Error('conexión rechazada'); };
    const adquirir = crearAdquisidor(async () => conn);

    await expect(adquirir('c')).rejects.toThrow('conexión rechazada');
    expect(conn.liberada).toBe(1);
  });

  it('usa un nombre por conector, dentro del límite de 64 caracteres de MySQL', () => {
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    expect(nombreCandado(uuid).length).toBeLessThanOrEqual(64);
    expect(nombreCandado('a')).not.toBe(nombreCandado('b'));
  });

  describe('latido (la descarga tarda más de 25 min con la conexión parada)', () => {
    it('toca la conexión periódicamente para que el servidor no la cierre', async () => {
      jest.useFakeTimers();
      const srv = servidorFalso();
      const adquirir = crearAdquisidor(srv.conexion, { heartbeatMs: 1000 });

      const a = await adquirir('c');
      jest.advanceTimersByTime(3500);

      const latidos = srv.abiertas[0]!.consultas.filter((q) => q === 'SELECT 1').length;
      expect(latidos).toBe(3);
      await a!.liberar();
    });

    it('deja de latir al liberar', async () => {
      jest.useFakeTimers();
      const srv = servidorFalso();
      const adquirir = crearAdquisidor(srv.conexion, { heartbeatMs: 1000 });

      const a = await adquirir('c');
      await a!.liberar();
      const antes = srv.abiertas[0]!.consultas.length;
      jest.advanceTimersByTime(5000);

      expect(srv.abiertas[0]!.consultas.length).toBe(antes);
    });

    it('si la conexión se cae, lo avisa UNA vez y marca el candado como perdido', async () => {
      jest.useFakeTimers();
      const srv = servidorFalso();
      const alPerder = jest.fn();
      const adquirir = crearAdquisidor(srv.conexion, { heartbeatMs: 1000, alPerder });

      const a = await adquirir('c');
      srv.abiertas[0]!.fallarLatido = true;
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); await Promise.resolve();
      jest.advanceTimersByTime(3000);
      await Promise.resolve(); await Promise.resolve();

      expect(a!.perdido()).toBe(true);
      expect(alPerder).toHaveBeenCalledTimes(1);
    });

    it('una conexión caída se destruye en vez de volver al pool', async () => {
      jest.useFakeTimers();
      const srv = servidorFalso();
      const adquirir = crearAdquisidor(srv.conexion, { heartbeatMs: 1000 });

      const a = await adquirir('c');
      srv.abiertas[0]!.fallarLatido = true;
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); await Promise.resolve();
      await a!.liberar();

      expect(srv.abiertas[0]!.destruida).toBe(1);
      expect(srv.abiertas[0]!.liberada).toBe(0);
    });
  });
});
