import { reportesService } from './reportes.service.js';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import * as tvRepo from '../repositories/tv.repo.js';
import { armarEstadoTv, type EstadoTv } from './tv-estado.js';
import { hoyEnBogota, diasAntes } from './agenda-ventana.js';
import { agendaActiva } from './citas-sync.service.js';

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

  const [kpis, agendaMes, agendaSemana, citasDia, movimientos] = await Promise.all([
    reportesService.getKpis({ mesIdx, anio }),
    reportesService.getAgenda({ mesIdx, anio }),
    reportesService.getAgenda({ mesIdx, anio, startDate: hoy, endDate: diasAntes(hoy, -6) }),
    conectorAgenda ? tvRepo.leerCitasDia(conectorAgenda.id) : Promise.resolve(null),
    tvRepo.leerMovimientos(new Date(ahora.getTime() - MOVIMIENTOS_HORAS * 3_600_000), MOVIMIENTOS_MAX),
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
  });
  cache = { en: t, estado };
  return estado;
}

/** Solo para las pruebas. */
export function _vaciarCacheTv(): void { cache = null; }
