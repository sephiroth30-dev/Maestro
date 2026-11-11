import { logger } from '../config/logger.js';
import { connectorService } from './connector.service.js';
import { adquirirCandadoSync } from './sync-lock.service.js';
import { buildCache, resolveId, resolveServicioId, type ResolverCache } from './sheet-atencion-mapper.js';
import { normalizeDescripcion } from './normalizacion.service.js';
import { configAgenda, pedirCitas } from './citas-sync.service.js';
import { normalizarCitas } from './agenda-mapeo.js';
import { enriquecerCita, type Resolutores } from './agenda-enriquecer.js';
import { construirTablaPrecios, valorarCita } from './agenda-valoracion.js';
import { evaluarBacktest, type CitaEvaluada } from './agenda-backtest.js';
import { hoyEnBogota, diasAntes } from './agenda-ventana.js';
import { mesesCerradosPrevios } from './agenda-periodo.js';
import * as repo from '../repositories/agenda.repo.js';

/**
 * Evalúa la valoración con el último mes cerrado. Ver `agenda-backtest.ts` para lo
 * que mide y lo que NO.
 *
 * Descarga las citas CUMPLIDAS e INCUMPLIDAS del mes (dos peticiones; no se pide
 * «todas» porque incluiría los huecos libres, que son miles y no sirven), las
 * valora con el historial ANTERIOR a ese mes y las compara por EPS contra lo
 * facturado. Corre en segundo plano con el candado del conector (comparte token
 * con la sincronización) y deja su estado en la base, para que se vea desde
 * cualquier proceso del servidor.
 */

function resolutoresDe(cache: ResolverCache): Resolutores {
  return {
    entidad: (nombre) => resolveId(nombre, cache.entidades),
    especialidadDe: (nombre) => {
      const id = resolveId(nombre, cache.profesionales);
      return id ? cache.profesionales.find((p) => p.id === id)?.especialidad ?? null : null;
    },
    servicioNombre: (referencia, especialidad) => {
      const id = resolveServicioId(normalizeDescripcion(referencia), cache.servicios, especialidad, cache.specialtyUpgrade);
      return id ? cache.servicios.find((s) => s.id === id)?.nombre ?? null : null;
    },
  };
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Arranca la evaluación en segundo plano y responde enseguida.
 *
 * Si el candado está ocupado (una sincronización en curso, u otra evaluación) NO se
 * toca el estado guardado: antes se escribía un «error» que borraba el último
 * resultado bueno, o marcaba como fallida una evaluación que seguía corriendo.
 * Nunca lanza.
 */
export async function iniciarBacktest(conectorId: string): Promise<{ iniciado: boolean; motivo?: string }> {
  try {
    const candado = await adquirirCandadoSync(conectorId);
    if (!candado) return { iniciado: false, motivo: 'Ya hay una sincronización o una evaluación en curso; vuelve a intentarlo cuando termine.' };
    void ejecutarConCandado(conectorId, candado).catch((e: unknown) =>
      logger.error('Evaluación de la agenda: excepción inesperada', { conectorId, error: e instanceof Error ? e.message : String(e) }));
    return { iniciado: true };
  } catch (err) {
    const motivo = err instanceof Error ? err.message : String(err);
    logger.error('No se pudo iniciar la evaluación de la agenda', { conectorId, error: motivo });
    return { iniciado: false, motivo };
  }
}

async function ejecutarConCandado(conectorId: string, candado: { liberar: () => Promise<void> }): Promise<void> {
  const inicio = new Date().toISOString();
  try {
    await repo.guardarBacktest(conectorId, { estado: 'corriendo', iniciado: inicio, terminado: null, error: null, resultado: null });

    const conector = await connectorService.getById(conectorId);
    const cfg = configAgenda(conector);
    if (!cfg) throw new Error('La agenda de citas no está activada en este conector');

    const { anio, mes } = mesesCerradosPrevios(hoyEnBogota(new Date()), 1)[0]!;
    const primero = `${anio}-${pad(mes)}-01`;
    const ultimo = `${anio}-${pad(mes)}-${pad(new Date(Date.UTC(anio, mes, 0)).getUTCDate())}`;

    const [cumplidas, incumplidas] = [
      normalizarCitas(await pedirCitas(conector, cfg, { fechaInicial: primero, fechaFinal: ultimo, estadoCita: 'C' }), ['C']).filas,
      normalizarCitas(await pedirCitas(conector, cfg, { fechaInicial: primero, fechaFinal: ultimo, estadoCita: 'I' }), ['I']).filas,
    ];
    if (cumplidas.length === 0) {
      throw new Error(`Medifolios devolvió 0 citas cumplidas en ${anio}-${pad(mes)}: no hay con qué evaluar.`);
    }

    // El historial TERMINA donde empieza el mes evaluado: valorar con datos del
    // propio mes sería hacer trampa.
    const tabla = construirTablaPrecios(await repo.historialVisitas(diasAntes(primero, 90), primero));
    const cache = await buildCache();
    const resolutores = resolutoresDe(cache);
    const convenios = await repo.leerConvenios(conectorId);
    const epsPorConvenio = new Map(convenios.map((c) => [c.codConvenio, c.epsNombre]));
    const nombres = await repo.nombresEntidades();

    const evaluadas: CitaEvaluada[] = [];
    for (const f of [...cumplidas, ...incumplidas]) {
      const { entidadId, grupo } = enriquecerCita(f, resolutores, epsPorConvenio);
      evaluadas.push({
        entidadKey: entidadId ?? `nombre:${f.convenioNombre || 'SIN ENTIDAD'}`,
        entidad: entidadId ? nombres.get(entidadId) ?? f.convenioNombre : (f.convenioNombre || 'SIN ENTIDAD'),
        estado: f.estado === 'I' ? 'I' : 'C',
        valor: f.estado === 'I' ? null : valorarCita(tabla, entidadId, grupo).valor,
      });
    }

    const real = new Map<string, { entidad: string; valor: number }>();
    for (const r of await repo.facturadoPorEntidadMes(anio, mes)) {
      real.set(r.entidadId ?? 'nombre:SIN ENTIDAD', { entidad: r.entidad, valor: r.valor });
    }

    const resultado = evaluarBacktest(`${anio}-${pad(mes)}`, evaluadas, real);
    await repo.guardarBacktest(conectorId, { estado: 'ok', terminado: new Date().toISOString(), error: null, resultado });
    logger.info('Evaluación de la agenda terminada', { conectorId, mes: resultado.mes, cobertura: resultado.total.cobertura, cumplidas: resultado.total.cumplidas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Falló la evaluación de la agenda', { conectorId, error: msg });
    await repo.guardarBacktest(conectorId, { estado: 'error', terminado: new Date().toISOString(), error: msg.slice(0, 1000), resultado: null }).catch(() => {});
  } finally {
    await candado.liberar();
  }
}
