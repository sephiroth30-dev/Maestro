import { logger } from '../config/logger.js';
import { normalizarCitas, type FilaCruda, type FilaCita } from './agenda-mapeo.js';
import {
  planBasico, tareaHistorica, aplicarTarea, agregarPorDiaEntidad, rangoSospechoso, type Tarea, type Cobertura,
} from './incumplidas-plan.js';
import * as repo from '../repositories/incumplidas.repo.js';

/**
 * Sincronización del resumen de citas CUMPLIDAS e INCUMPLIDAS. Se llama desde la sincronización de citas, DENTRO
 * del candado del conector (misma credencial: Medifolios da un solo token por usuario). Nunca debe estropear la
 * agenda: quien la llama captura sus errores. Ver `incumplidas-plan.ts` para qué se pide en cada vuelta.
 */

export interface EntradaIncumplidas {
  conectorId: string;
  ahora: Date;
  /** `YYYY-MM-DD` en hora de Colombia. */
  hoy: string;
  /** Pide las citas de un estado (`C` cumplida, `I` incumplida) entre dos fechas. Inyectada para poder probar sin red. */
  pedir: (desde: string, hasta: string, estado: 'C' | 'I') => Promise<FilaCruda[]>;
  /** EPS de una cita (por el catálogo de convenios o por los alias de Entidades). */
  entidadDe: (f: FilaCita) => string | null;
  /**
   * Salta la guarda de «respuesta sospechosa». Es para el botón manual: si Medifolios reclasificó muchas citas de
   * verdad, la guarda bloquearía la sincronización para siempre (el conteo previo sale de la propia base).
   */
  forzar?: boolean;
}

export interface ResultadoIncumplidas {
  tareas: Array<{ tipo: Tarea['tipo']; desde: string; hasta: string; cumplidas: number; incumplidas: number }>;
}

async function ejecutar(e: EntradaIncumplidas, t: Tarea): Promise<{ cumplidas: number; incumplidas: number }> {
  const enRango = (f: FilaCita): boolean => f.fechaDia >= t.desde && f.fechaDia <= t.hasta;
  // Solo las del rango pedido: si la API devolviera de más, no se pisa lo que no se pidió.
  const cumplidas = normalizarCitas(await e.pedir(t.desde, t.hasta, 'C'), ['C']).filas.filter(enRango);
  const incumplidas = normalizarCitas(await e.pedir(t.desde, t.hasta, 'I'), ['I']).filas.filter(enRango);

  const previas = await repo.contarVentana(e.conectorId, t.desde, t.hasta);
  if (!e.forzar && rangoSospechoso(previas, { cumplidas: cumplidas.length, incumplidas: incumplidas.length })) {
    throw new Error(
      `Respuesta sospechosa de Medifolios entre ${t.desde} y ${t.hasta}: ${cumplidas.length} cumplidas y ${incumplidas.length} incumplidas `
      + `(ya había ${previas.cumplidas} y ${previas.incumplidas} guardadas). Se conservan las anteriores: vaciar o diezmar lo guardado, o traer `
      + 'muchas de un estado y ninguna del otro, es un fallo de la respuesta y no un hecho. «Sincronizar citas ahora» la acepta de todos modos.',
    );
  }

  await repo.reemplazarVentana(e.conectorId, t.desde, t.hasta, agregarPorDiaEntidad(cumplidas, incumplidas, e.entidadDe));
  return { cumplidas: cumplidas.length, incumplidas: incumplidas.length };
}

export async function sincronizarIncumplidas(e: EntradaIncumplidas): Promise<ResultadoIncumplidas> {
  const estado = await repo.leerEstado(e.conectorId);
  await repo.guardarEstado(e.conectorId, { ultimoIntento: e.ahora.toISOString() });
  const hechas: ResultadoIncumplidas['tareas'] = [];
  let cob: Cobertura = { desde: estado?.desde ?? null, hasta: estado?.hasta ?? null, ultimoDiario: estado?.ultimoDiario ?? null };

  const correr = async (t: Tarea): Promise<void> => {
    const n = await ejecutar(e, t);
    hechas.push({ tipo: t.tipo, desde: t.desde, hasta: t.hasta, ...n });
    // El avance se guarda tarea a tarea: si la siguiente falla, esto no se pierde. La cobertura es UN tramo sin
    // huecos: si la tarea no se pega al tramo viejo (mucho tiempo sin sincronizar), se reinicia.
    const tramo = aplicarTarea(cob, t);
    cob = { ...cob, ...tramo, ...(t.tipo === 'diario' ? { ultimoDiario: e.hoy } : {}) };
    await repo.guardarEstado(e.conectorId, {
      desde: tramo.desde, hasta: tramo.hasta, estado: 'ok', error: null, ultimaOk: new Date().toISOString(),
      ...(t.tipo === 'diario' ? { ultimoDiario: e.hoy } : {}),
    });
  };

  try {
    for (const t of planBasico(e.hoy, cob)) await correr(t);
    // El histórico se calcula DESPUÉS, con la cobertura ya actualizada (si hubo hueco, el tramo empezó de nuevo), y
    // NO en la vuelta de la pasada diaria: esa ya carga un mes entero, y sumarle otro alargaría mucho el tiempo que
    // se ocupa a Medifolios (y el candado) en una sola vuelta.
    const h = hechas.some((x) => x.tipo === 'diario') ? null : tareaHistorica(e.hoy, cob);
    if (h) await correr(h);
  } catch (err) {
    // La cobertura NO avanza y lo ya guardado se conserva; el error se ve en Diagnóstico.
    await repo.guardarEstado(e.conectorId, { estado: 'error', error: (err instanceof Error ? err.message : String(err)).slice(0, 600) }).catch(() => undefined);
    throw err;
  }

  logger.info('Citas cumplidas e incumplidas sincronizadas', {
    conectorId: e.conectorId, tareas: hechas.map((h) => `${h.tipo}:${h.cumplidas}C/${h.incumplidas}I`).join(','),
  });
  return { tareas: hechas };
}
