import { logger } from '../config/logger.js';
import { flushReportesCache } from '../config/redis.js';
import { connectorService } from './connector.service.js';
import { adquirirCandadoSync } from './sync-lock.service.js';
import { buildCache, resolveId, resolveServicioId, type ResolverCache } from './sheet-atencion-mapper.js';
import { normalizeDescripcion } from './normalizacion.service.js';
import { FIELD_MAP_CITAS, normalizarCitas, texto, type FilaCruda } from './agenda-mapeo.js';
import { enriquecerCita, type Resolutores } from './agenda-enriquecer.js';
import { ventanaCitas, hoyEnBogota, diasAntes } from './agenda-ventana.js';
import { construirTablaPrecios, valorarCita } from './agenda-valoracion.js';
import { RestConfigSchema } from '../connectors/rest.connector.js';
import * as repo from '../repositories/agenda.repo.js';
import * as tvRepo from '../repositories/tv.repo.js';
import { actualizarCitasDia } from './citas-dia.service.js';
import type { Conector } from '@prisma/client';

/**
 * Sincronización de las citas PENDIENTES de Medifolios.
 *
 * Comparte credencial, token y CANDADO con la sincronización de consumos: Medifolios
 * emite un solo token vigente por usuario, así que dos sesiones a la vez se
 * invalidaban entre sí (los 401 del historial). Por eso `sincronizarCitas` debe
 * llamarse teniendo el candado del conector (`sincronizarCitasConCandado` lo toma).
 *
 * Reglas que NO se negocian:
 *  - Un fallo NO vacía la agenda: se conserva la última buena y se guarda el error
 *    (con el mensaje de la propia API) para mostrarlo en Diagnóstico.
 *  - «0 citas» y «ninguna válida» se tratan como sospechosos, no como una agenda
 *    vacía: sería lo mismo que perder la proyección sin enterarse.
 *  - Una cita sin precio de referencia se guarda con `valor_estimado` NULL y se
 *    cuenta; nunca se convierte en $0.
 */

const HISTORIAL_DIAS = 90;
const CONVENIOS_VIGENCIA_MS = 24 * 3_600_000;
const CONVENIOS_REINTENTO_MS = 6 * 3_600_000;
/** Tras un fallo de citas, el cron y la sincronización de consumos no reintentan antes de esto. */
const CITAS_REINTENTO_MS = 30 * 60_000;

/** Cuándo falló por última vez la lectura de las citas de HOY (para la TV), por conector. En memoria. */
const fallosTv = new Map<string, number>();

export interface ResultadoCitasSync {
  ok: boolean;
  /** No se ejecutó: agenda desactivada, o ya había otra sincronización en curso. */
  omitida?: boolean;
  motivo?: string;
  citasLeidas?: number;
  citasGuardadas?: number;
  citasSinPrecio?: number;
  horizonte?: string | null;
  duracionMs?: number;
  error?: string;
  httpStatus?: number | null;
}

export interface ConfigAgenda {
  endpointCitas: string;
  endpointConvenios: string;
}

export function configAgenda(conector: Conector): ConfigAgenda | null {
  if (conector.tipo !== 'REST_API') return null;
  try {
    const a = RestConfigSchema.parse(conector.config as Record<string, unknown>).agenda;
    return a?.activo ? { endpointCitas: a.endpointCitas, endpointConvenios: a.endpointConvenios } : null;
  } catch {
    return null;
  }
}

/** `'YYYY-MM-DD HH:MM:SS'` del pool (siempre UTC) → ms. */
function msDeDb(s: string | null): number | null {
  if (!s) return null;
  const t = Date.parse(`${s.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * Código HTTP del mensaje de error del conector, o `null`. Un fallo del LOGIN
 * («Login falló: HTTP 403») NO cuenta: no es falta del permiso de la consulta, y
 * decirlo mandaría a pedir un permiso que no es el problema.
 */
export const statusDe = (msg: string): number | null => {
  if (/login fall/i.test(msg)) return null;
  const m = /HTTP (\d{3})/.exec(msg);
  return m ? Number(m[1]) : null;
};

// ─── Catálogo de convenios (convenio → EPS) ───────────────────────────────────

/**
 * Trae el catálogo de convenios para vincular cada cita con su EPS.
 *
 * Pide un permiso DISTINTO al de las citas (01041504), así que NUNCA bloquea: si
 * falla, la EPS se vincula por nombre contra los alias de Entidades. Se refresca
 * como mucho una vez al día, y un fallo no se reintenta en cada vuelta de 15
 * minutos (solo cargaría a Medifolios y llenaría el historial de ruido).
 */
async function asegurarConvenios(conector: Conector, cfg: ConfigAgenda, cache: ResolverCache, ahora: Date): Promise<void> {
  const estado = await repo.leerEstadoSync(conector.id);
  const ultimo = msDeDb(estado?.conveniosActualizado ?? null);
  if (ultimo !== null) {
    const edad = ahora.getTime() - ultimo;
    if (estado?.conveniosEstado === 'ok' && edad < CONVENIOS_VIGENCIA_MS) return;
    if (estado?.conveniosEstado !== 'ok' && edad < CONVENIOS_REINTENTO_MS) return;
  }

  try {
    const inst = connectorService.instantiateRestConCambios(conector, {
      endpoint: cfg.endpointConvenios,
      dataPath: 'data.convenios',
      fieldMap: { codConvenio: 'codConvenio', nombre: 'nomConvenio', eps: 'eps.nomEps' },
      params: {},
      paginar: true, paginaParam: 'pagina', limiteParam: 'limite', limite: 200,
      totalPaginasPath: 'data.totalPaginas', maxPaginas: 50,
      // Un 403 por falta de permiso NO debe provocar un login nuevo: invalidaría el
      // token que está usando la sincronización de consumos.
      loginRetryStatuses: [401],
    });
    const ds = await inst.fetch({});
    // Por código, y la última gana: una página repetida o un convenio duplicado en el
    // catálogo rompería la llave primaria y haría fallar todo el reemplazo.
    const porCodigo = new Map<number, { codConvenio: number; nombre: string; epsNombre: string | null; entidadId: string | null }>();
    for (const r of ds.rows) {
      const cod = Number(r['codConvenio']);
      if (!Number.isFinite(cod) || cod <= 0) continue;
      const epsNombre = texto(r['eps']) || null;
      porCodigo.set(cod, { codConvenio: cod, nombre: texto(r['nombre']), epsNombre, entidadId: resolveId(epsNombre, cache.entidades) });
    }
    const convenios = [...porCodigo.values()];
    // Un catálogo vacío no es «ningún convenio»: borrar el último bueno durante 24 h
    // dejaría todas las citas sin EPS. Se trata como fallo y se conserva el anterior.
    if (convenios.length === 0) throw new Error('El catálogo de convenios llegó vacío. Se conserva el anterior.');

    await repo.reemplazarConvenios(conector.id, convenios);
    await repo.guardarEstadoSync(conector.id, { conveniosEstado: 'ok', conveniosError: null, conveniosActualizado: ahora.toISOString() });
    logger.info('Catálogo de convenios actualizado', { conectorId: conector.id, convenios: convenios.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const sinPermiso = statusDe(msg) === 403;
    await repo.guardarEstadoSync(conector.id, {
      conveniosEstado: sinPermiso ? 'sin_permiso' : 'error',
      conveniosError: msg.slice(0, 600),
      conveniosActualizado: ahora.toISOString(),
    });
    logger.warn('No se pudo traer el catálogo de convenios; la EPS se vinculará por nombre', { conectorId: conector.id, error: msg });
  }
}

// ─── Enriquecimiento: EPS, grupo y valor ──────────────────────────────────────

/** Resolutores reales, a partir de los catálogos cargados en memoria. */
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

// ─── Petición de citas ────────────────────────────────────────────────────────

/**
 * Lee las citas de Medifolios con los filtros dados. Comparte credencial y token
 * con el conector; quien la llame debe tener su candado.
 *
 * Nunca pide canceladas ni imagenología: no consumen la agenda.
 */
export async function pedirCitas(conector: Conector, cfg: ConfigAgenda, filtros: Record<string, string>): Promise<FilaCruda[]> {
  const inst = connectorService.instantiateRestConCambios(conector, {
    endpoint: cfg.endpointCitas,
    dataPath: 'data.citas',
    fieldMap: FIELD_MAP_CITAS,
    // Pisa TODOS los parámetros fijos del conector (p. ej. `fechaDesde` de los
    // consumos): no deben viajar a otro endpoint.
    params: { ...filtros, incluirCanceladas: '0', incluirImagenologia: '0' },
    paginar: true, paginaParam: 'pagina', limiteParam: 'limite', limite: 200,
    totalPaginasPath: 'data.totalPaginas', maxPaginas: 100,
    // Un 403 por falta de permiso NO debe provocar un login nuevo: invalidaría el
    // token que usa la sincronización de consumos.
    loginRetryStatuses: [401],
  });
  return (await inst.fetch({})).rows as FilaCruda[];
}

// ─── Sincronización ───────────────────────────────────────────────────────────

/** Debe llamarse con el candado del conector en la mano. */
export async function sincronizarCitas(conectorId: string, opciones: { manual?: boolean } = {}): Promise<ResultadoCitasSync> {
  const inicio = Date.now();
  const ahora = new Date();
  const conector = await connectorService.getById(conectorId);
  const cfg = configAgenda(conector);
  if (!cfg) return { ok: false, omitida: true, motivo: 'La agenda de citas no está activada en este conector' };

  // Estado de la sincronización anterior: sirve para el reintento tras un fallo y para
  // saber si la ventana de citas cambió (cambio de mes) al detectar movimientos.
  const previo = await repo.leerEstadoSync(conectorId);

  // Un fallo persistente (permiso que falta, API caída) no se reintenta en cada vuelta
  // de 15 minutos ni tras cada sincronización de consumos: solo cargaría a Medifolios.
  // El botón «Sincronizar citas ahora» lo salta.
  if (!opciones.manual) {
    const ultimo = msDeDb(previo?.ultimoIntento ?? null);
    if (previo?.estado === 'error' && ultimo !== null && ahora.getTime() - ultimo < CITAS_REINTENTO_MS) {
      return { ok: false, omitida: true, motivo: 'La última sincronización de citas falló hace poco; se reintenta en unos minutos' };
    }
  }

  await repo.guardarEstadoSync(conectorId, { ultimoIntento: ahora.toISOString() });

  try {
    const cache = await buildCache();
    await asegurarConvenios(conector, cfg, cache, ahora);

    const { desde, hasta } = ventanaCitas(ahora);
    const crudas = await pedirCitas(conector, cfg, { fechaInicial: desde, fechaFinal: hasta, estadoCita: 'P' });
    const ds = { rows: crudas };
    const { filas, descartadas } = normalizarCitas(crudas);
    logger.info('Citas leídas', { conectorId, leidas: ds.rows.length, validas: filas.length, descartadas, desde, hasta });

    // Sospechoso, no vacío: perder la agenda sin enterarse es peor que avisar.
    if (ds.rows.length === 0) {
      throw new Error(`Medifolios devolvió 0 citas pendientes entre ${desde} y ${hasta}. Se conserva la agenda anterior.`);
    }
    if (filas.length === 0) {
      throw new Error(
        `Se leyeron ${ds.rows.length} citas pero ninguna es pendiente de agenda `
        + `(no pendientes: ${descartadas.noPendiente}, no agenda: ${descartadas.noAgenda}, `
        + `sin fecha: ${descartadas.sinFecha}, sin código: ${descartadas.sinCodigo}). Se conserva la agenda anterior.`,
      );
    }

    // Si los nombres no llegaron, el mapeo de campos no coincide con la respuesta real
    // (p. ej. la API llama `nombreConvenio` a lo que aquí se espera como `nomConvenio`).
    // Guardar así dejaría todas las citas sin EPS ni grupo y un «ok» engañoso.
    if (filas.every((f) => !f.convenioNombre) || filas.every((f) => !f.referenciaNombre)) {
      throw new Error(
        'Las citas llegaron sin nombre de convenio o de procedimiento: los campos esperados '
        + '(convenio.nomConvenio, referencia.nomReferencia) no coinciden con la respuesta de la API. '
        + 'Se conserva la agenda anterior; revisa el formato real en el Swagger.',
      );
    }

    // Valoración con lo facturado en los últimos 90 días, hasta ayer.
    const hoy = hoyEnBogota(ahora);
    const tabla = construirTablaPrecios(await repo.historialVisitas(diasAntes(hoy, HISTORIAL_DIAS), hoy));

    const convenios = await repo.leerConvenios(conectorId);
    const epsPorConvenio = new Map(convenios.map((c) => [c.codConvenio, c.epsNombre]));

    const resolutores = resolutoresDe(cache);
    const guardables: repo.CitaGuardable[] = filas.map((f) => {
      const { entidadId, grupo } = enriquecerCita(f, resolutores, epsPorConvenio);
      const v = valorarCita(tabla, entidadId, grupo);
      return {
        codAsignacion: f.codAsignacion, fechaCita: f.fechaCita, fechaDia: f.fechaDia,
        convenioCod: f.convenioCod, convenioNombre: f.convenioNombre, entidadId,
        referenciaNombre: f.referenciaNombre, cups: f.cups, grupo,
        valorEstimado: v.valor, origenValor: v.origen,
      };
    });

    // Las pendientes guardadas ANTES del reemplazo, para detectar las nuevas en la TV.
    const codigosAgendaPrevios = await tvRepo.leerCodigosAgenda(conectorId).catch(() => new Set<number>());

    await repo.reemplazarCitas(conectorId, guardables);
    flushReportesCache();

    const citasSinPrecio = guardables.filter((c) => c.valorEstimado === null).length;
    const horizonte = guardables.reduce((m, c) => (c.fechaDia > m ? c.fechaDia : m), '');
    const duracionMs = Date.now() - inicio;
    await repo.guardarEstadoSync(conectorId, {
      estado: 'ok', ultimaOk: new Date().toISOString(), error: null, httpStatus: null,
      citasLeidas: ds.rows.length, citasGuardadas: guardables.length, citasSinPrecio,
      horizonte: horizonte || null, duracionMs,
    });
    logger.info('Citas sincronizadas', { conectorId, guardadas: guardables.length, sinPrecio: citasSinPrecio, horizonte, duracionMs });
    const resultado: ResultadoCitasSync = { ok: true, citasLeidas: ds.rows.length, citasGuardadas: guardables.length, citasSinPrecio, horizonte: horizonte || null, duracionMs };

    // Citas de hoy en todos los estados y movimientos para la pantalla de TV. Va DESPUÉS de dar la
    // agenda por buena (el «ok» y `ultima_ok` no esperan a estas dos peticiones) y NUNCA la estropea:
    // si falla, la TV conserva su lectura anterior y se registra el aviso. Tras un fallo no se
    // reintenta en cada vuelta de 15 min (el botón manual lo salta), como con las pendientes.
    const falloTv = fallosTv.get(conectorId);
    if (opciones.manual || falloTv === undefined || Date.now() - falloTv > CITAS_REINTENTO_MS) {
      try {
        await actualizarCitasDia({
          conectorId, ahora, hoy,
          pendientes: filas.map((f) => ({ codAsignacion: f.codAsignacion, fechaCita: f.fechaCita, fechaDia: f.fechaDia })),
          codigosAgendaPrevios,
          ultimaOkPrevia: previo?.ultimaOk ?? null,
          pedir: (estado) => pedirCitas(conector, cfg, { fechaInicial: hoy, fechaFinal: hoy, estadoCita: estado }),
        });
        fallosTv.delete(conectorId);
        await repo.guardarEstadoSync(conectorId, { tvEstado: 'ok', tvError: null, tvActualizado: new Date().toISOString() }).catch(() => undefined);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        fallosTv.set(conectorId, Date.now());
        logger.warn('Citas de hoy para la TV: no se pudieron actualizar', { conectorId, error: msg });
        // Que el fallo SE VEA (Diagnóstico y la propia pantalla), no solo en el registro del servidor.
        await repo.guardarEstadoSync(conectorId, { tvEstado: 'error', tvError: msg.slice(0, 600), tvActualizado: new Date().toISOString() }).catch(() => undefined);
      }
    }
    return resultado;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const httpStatus = statusDe(msg);
    const duracionMs = Date.now() - inicio;
    // `ultima_ok` NO se toca: la agenda sigue siendo la última buena, y la pantalla
    // avisará de que está desactualizada.
    await repo.guardarEstadoSync(conectorId, { estado: 'error', error: msg.slice(0, 1000), httpStatus, duracionMs }).catch(() => {});
    logger.error('Falló la sincronización de citas', { conectorId, error: msg, httpStatus });
    return { ok: false, error: msg, httpStatus, duracionMs };
  }
}

/** Toma el candado del conector; si otra sincronización lo tiene, se omite sin fallar. */
export async function sincronizarCitasConCandado(conectorId: string, opciones: { manual?: boolean } = {}): Promise<ResultadoCitasSync> {
  // Nunca lanza: se llama sin `await` desde el arranque y desde un botón, y una
  // promesa rechazada sin capturar termina el proceso (ver index.ts).
  try {
    const candado = await adquirirCandadoSync(conectorId);
    if (!candado) return { ok: false, omitida: true, motivo: 'Ya hay una sincronización en curso' };
    try {
      return await sincronizarCitas(conectorId, opciones);
    } finally {
      await candado.liberar();
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Sincronización de citas: excepción inesperada', { conectorId, error });
    return { ok: false, error };
  }
}

/** ¿Tiene el conector activada la agenda de citas? */
export function agendaActiva(conector: { config: unknown; tipo?: string }): boolean {
  const a = (conector.config as { agenda?: { activo?: boolean } } | null)?.agenda;
  return a?.activo === true;
}
