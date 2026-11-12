import { reportesService } from './reportes.service.js';
import { logger } from '../config/logger.js';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import * as tvRepo from '../repositories/tv.repo.js';
import { leerEstadoSync } from '../repositories/agenda.repo.js';
import { armarEstadoTv, type EstadoTv } from './tv-estado.js';
import { hoyEnBogota, diasAntes } from './agenda-ventana.js';
import { agendaActiva } from './citas-sync.service.js';
import * as reportesRepo from '../repositories/reportes.repo.js';

/** Minutos entre sincronizaciones de consumos según la frecuencia del conector. */
const CADENCIA_MIN: Record<string, number> = { '30min': 30, '1h': 60, '4h': 240, daily: 1440 };

/**
 * Estado de la pantalla de TV. Reutiliza lo que ya existe (kpis y agenda, con su caché
 * de 60 s) y añade las citas de hoy y los movimientos. Un solo endpoint ligero: la TV
 * pregunta cada 30–60 s.
 */

const APP_VERSION: string = (require('../../../package.json') as { version: string }).version;
const MOVIMIENTOS_HORAS = 36;
const MOVIMIENTOS_MAX = 40;

// Caché propia, de pocos segundos: varias pantallas abiertas (o una pestaña de más) no
// multiplican las consultas. Es por proceso, como la de reportes.
const CACHE_MS = 20_000;
let cache: { en: number; estado: EstadoTv } | null = null;

/** Una consulta que solo alimenta una parte de la pantalla: si falla, esa parte queda vacía y el resto se muestra. */
function opcional<T>(que: string, vacio: T): (err: unknown) => T {
  return (err) => {
    logger.warn(`TV: no se pudo leer ${que}`, { error: err instanceof Error ? err.message : String(err) });
    return vacio;
  };
}

export async function obtenerEstadoTv(): Promise<EstadoTv> {
  const t = Date.now();
  if (cache && t - cache.en < CACHE_MS) return cache.estado;

  const ahora = new Date();
  const hoy = hoyEnBogota(ahora);
  const [anioStr, mesStr] = hoy.split('-') as [string, string, string];
  const anio = Number(anioStr);
  const mesIdx = Number(mesStr);

  const activos = await conectoresRepo.findAllActive();
  const conectorAgenda = activos.find((c) => agendaActiva(c));

  const fechaPrevia = await tvRepo.fechaPreviaConSerie(hoy).catch(() => null);
  const [kpis, agendaMes, agendaSemana, citasDia, movimientos, estadoSync, entidadesMes, entidadesHoy, diarios, serieHoy, seriePrevia] = await Promise.all([
    reportesService.getKpis({ mesIdx, anio }),
    reportesService.getAgenda({ mesIdx, anio }),
    reportesService.getAgenda({ mesIdx, anio, startDate: hoy, endDate: diasAntes(hoy, -6) }),
    conectorAgenda ? tvRepo.leerCitasDia(conectorAgenda.id) : Promise.resolve(null),
    tvRepo.leerMovimientos(new Date(ahora.getTime() - MOVIMIENTOS_HORAS * 3_600_000), MOVIMIENTOS_MAX),
    conectorAgenda ? leerEstadoSync(conectorAgenda.id) : Promise.resolve(null),
    reportesService.getEntidades({ mesIdx, anio }).catch(opcional('EPS del mes', { rows: [], total: 0 })),
    // «Hoy» como rango de un solo día: el mismo cálculo que Reportes con el filtro de día.
    reportesService.getEntidades({ mesIdx, anio, startDate: new Date(`${hoy}T00:00:00.000Z`), endDate: new Date(`${hoy}T00:00:00.000Z`) }).catch(opcional('EPS de hoy', { rows: [], total: 0 })),
    reportesRepo.getDiariosDelMes(mesIdx, anio).catch(opcional('velas diarias', [] as Array<{ fecha_dia: Date; total: number; atenciones: number }>)),
    tvRepo.leerSerie(hoy).catch(() => []),
    fechaPrevia ? tvRepo.leerSerie(fechaPrevia).then((puntos) => ({ fecha: fechaPrevia, puntos })).catch(() => null) : Promise.resolve(null),
  ]);

  // Última sincronización de consumos de las fuentes activas.
  // El pool entrega las fechas como TEXTO en UTC (`dateStrings`), aunque el tipo diga Date.
  const aMs = (v: unknown): number => (v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(`${v.replace(' ', 'T')}${/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? '' : 'Z'}`) : NaN);
  const ultimas = activos.map((c) => aMs(c.ultimaSync)).filter((t) => Number.isFinite(t));
  const consumosActualizado = ultimas.length > 0 ? new Date(Math.max(...ultimas)).toISOString() : null;

  // La cadencia de la fuente que alimenta el dashboard (la de consumos más frecuente).
  const cadencias = activos.map((c) => CADENCIA_MIN[c.frecuenciaSync]).filter((n): n is number => typeof n === 'number');
  const cadenciaConsumosMin = cadencias.length > 0 ? Math.min(...cadencias) : null;

  const estado = armarEstadoTv({
    ahora, hoy, version: APP_VERSION, mesIdx, anio, kpis, agendaMes, agendaSemana,
    citasDia, movimientos, consumosActualizado, cadenciaConsumosMin,
    lecturaCitasDia: estadoSync?.tvEstado ?? null,
    entidadesMes: entidadesMes.rows,
    entidadesHoy: entidadesHoy.rows,
    diarios: diarios.map((d) => ({ fecha: d.fecha_dia.toISOString().slice(0, 10), total: d.total })),
    serieHoy,
    seriePrevia,
  });
  cache = { en: t, estado };
  return estado;
}

/** Solo para las pruebas. */
export function _vaciarCacheTv(): void { cache = null; }
