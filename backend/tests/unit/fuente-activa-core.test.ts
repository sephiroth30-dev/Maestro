import { crearEstadoFuente } from '../../src/services/fuente-activa.core';

/**
 * El defecto que motivó esto: la fuente activa se leía una vez y, si la lectura
 * fallaba, quedaba en `null` — que significa «no filtres, suma todo». Las dos
 * fuentes se sumaban y las cifras salían al doble sin ningún aviso.
 */

function reloj(): { ahora: () => number; avanzar: (ms: number) => void } {
  let t = 1_000_000;
  return { ahora: () => t, avanzar: (ms) => { t += ms; } };
}

describe('crearEstadoFuente', () => {
  it('empieza sin leer: undefined, NO null', () => {
    const e = crearEstadoFuente(async () => 'c1');
    // `null` querría decir «no hay fuente marcada»; `undefined`, «no lo sé».
    expect(e.valor()).toBeUndefined();
  });

  it('lee una vez y reutiliza el valor dentro de la ventana', async () => {
    const r = reloj();
    const leer = jest.fn(async () => 'c1');
    const e = crearEstadoFuente(leer, { ahora: r.ahora, maxEdadMs: 5_000 });

    await e.asegurar();
    r.avanzar(4_000);
    await e.asegurar();

    expect(e.valor()).toBe('c1');
    expect(leer).toHaveBeenCalledTimes(1);
  });

  it('relee al vencer la ventana: un cambio hecho en OTRO proceso llega solo', async () => {
    const r = reloj();
    let enBase: string | null = 'sheet';
    const e = crearEstadoFuente(async () => enBase, { ahora: r.ahora, maxEdadMs: 5_000 });

    await e.asegurar();
    expect(e.valor()).toBe('sheet');

    // Otro proceso atiende «Usar como fuente» y cambia la base; este no se entera…
    enBase = 'medifolios';
    r.avanzar(2_000);
    await e.asegurar();
    expect(e.valor()).toBe('sheet');

    // …hasta que vence la ventana.
    r.avanzar(4_000);
    await e.asegurar();
    expect(e.valor()).toBe('medifolios');
  });

  it('distingue «ninguna marcada» (null) de «sin leer» (undefined)', async () => {
    const e = crearEstadoFuente(async () => null);
    await e.asegurar();
    expect(e.valor()).toBeNull();
  });

  it('si NUNCA se ha podido leer, falla en voz alta en vez de decir «sin fuente»', async () => {
    const e = crearEstadoFuente(async () => { throw new Error('base caída'); });

    await expect(e.asegurar()).rejects.toThrow('base caída');
    // Y sobre todo: no se queda en null. Era exactamente el fallo anterior.
    expect(e.valor()).toBeUndefined();
  });

  it('si una relectura falla, CONSERVA el último valor bueno', async () => {
    const r = reloj();
    const alFallar = jest.fn();
    let falla = false;
    const e = crearEstadoFuente(
      async () => { if (falla) throw new Error('timeout'); return 'medifolios'; },
      { ahora: r.ahora, maxEdadMs: 5_000, alFallar },
    );

    await e.asegurar();
    falla = true;
    r.avanzar(6_000);
    await expect(e.asegurar()).resolves.toBeUndefined();

    expect(e.valor()).toBe('medifolios');   // no cayó a null
    expect(alFallar).toHaveBeenCalledTimes(1);
  });

  it('con la base caída no lanza una consulta por petición', async () => {
    const r = reloj();
    let falla = false;
    const leer = jest.fn(async () => { if (falla) throw new Error('caída'); return 'c1'; });
    const e = crearEstadoFuente(leer, { ahora: r.ahora, maxEdadMs: 5_000 });

    await e.asegurar();
    falla = true;
    r.avanzar(6_000);
    await e.asegurar();            // primer fallo: reintenta una vez
    const tras = leer.mock.calls.length;
    await e.asegurar();
    await e.asegurar();
    expect(leer.mock.calls.length).toBe(tras);   // y espera a la siguiente ventana
  });

  it('peticiones simultáneas comparten UNA sola lectura', async () => {
    const leer = jest.fn(async () => {
      await new Promise((res) => setTimeout(res, 10));
      return 'c1';
    });
    const e = crearEstadoFuente(leer);

    await Promise.all([e.asegurar(), e.asegurar(), e.asegurar(), e.asegurar()]);

    expect(leer).toHaveBeenCalledTimes(1);
  });

  it('refrescar() fuerza la lectura aunque la ventana siga vigente', async () => {
    const r = reloj();
    let enBase: string | null = 'sheet';
    const e = crearEstadoFuente(async () => enBase, { ahora: r.ahora, maxEdadMs: 5_000 });

    await e.asegurar();
    enBase = 'medifolios';
    await e.refrescar();             // lo que hace el POST de «Usar como fuente»

    expect(e.valor()).toBe('medifolios');
  });

  it('se recupera tras un fallo inicial', async () => {
    let falla = true;
    const e = crearEstadoFuente(async () => { if (falla) throw new Error('arranque'); return 'c1'; });

    await expect(e.asegurar()).rejects.toThrow();
    falla = false;
    await e.asegurar();

    expect(e.valor()).toBe('c1');
  });
});
