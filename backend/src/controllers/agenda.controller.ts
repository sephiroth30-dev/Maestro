import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import * as repo from '../repositories/agenda.repo.js';
import { agendaActiva, sincronizarCitasConCandado } from '../services/citas-sync.service.js';
import { iniciarBacktest } from '../services/agenda-backtest.service.js';

/**
 * Diagnóstico de la proyección por agenda (solo ADMIN).
 *
 * Existe porque el entorno de desarrollo no tiene acceso a Medifolios: el mapeo se
 * escribió contra la especificación y esta pantalla es donde el propio servidor
 * dice si funcionó (permisos, cuántas citas leyó, qué no pudo vincular).
 */

type Permiso = 'ok' | 'sin_permiso' | 'error' | 'desconocido';

/** Una evaluación «corriendo» más vieja que esto se dio por interrumpida (reinicio del servidor). */
const BACKTEST_MAX_MS = 30 * 60_000;

/** Quita el estado «corriendo» pegado: si el proceso murió a mitad, nadie lo cerraba. */
function backtestVigente(b: Awaited<ReturnType<typeof repo.leerBacktest>>): Awaited<ReturnType<typeof repo.leerBacktest>> {
  if (b.estado !== 'corriendo' || !b.iniciado) return b;
  const t = Date.parse(`${b.iniciado.replace(' ', 'T')}Z`);
  if (Number.isFinite(t) && Date.now() - t < BACKTEST_MAX_MS) return b;
  return { ...b, estado: 'error', error: 'La evaluación se interrumpió (reinicio del servidor o tardó demasiado). Vuelve a lanzarla.' };
}

async function conectorConAgenda(): Promise<{ id: string; nombre: string } | null> {
  const activos = await conectoresRepo.findAllActive();
  const c = activos.find((x) => agendaActiva(x));
  return c ? { id: c.id as string, nombre: c.nombre } : null;
}

export async function agendaRoutes(fastify: FastifyInstance): Promise<void> {
  const adminOnly = [requireAuth, requireRole('ADMIN')] as const;

  // GET /api/diagnostico/agenda
  fastify.get('/diagnostico/agenda', { preHandler: [...adminOnly] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const conector = await conectorConAgenda();
    if (!conector) {
      return reply.send({ configurada: false, conector: null });
    }
    const [estado, resumen, sinEntidad, sinPrecio, backtest] = await Promise.all([
      repo.leerEstadoSync(conector.id),
      repo.resumenCitas(),
      repo.conveniosSinEntidad(),
      repo.citasSinPrecioPorReferencia(),
      repo.leerBacktest(conector.id),
    ]);

    // Interpretación de los permisos: el 403 de Medifolios es lo que más conviene
    // ver claro, porque se arregla pidiendo un permiso, no tocando código.
    const permisoCitas: Permiso = !estado || estado.estado === 'nunca' ? 'desconocido'
      : estado.estado === 'ok' ? 'ok'
      : estado.httpStatus === 403 ? 'sin_permiso' : 'error';
    const permisoConvenios: Permiso = (estado?.conveniosEstado as Permiso | null) ?? 'desconocido';

    return reply.send({
      configurada: true,
      conector,
      estado,
      permisos: { citas: permisoCitas, convenios: permisoConvenios },
      resumen,
      conveniosSinEntidad: sinEntidad,
      citasSinPrecio: sinPrecio,
      backtest: backtestVigente(backtest),
    });
  });

  // POST /api/diagnostico/agenda/sincronizar  (en segundo plano: tarda ~1 minuto)
  fastify.post('/diagnostico/agenda/sincronizar', { preHandler: [...adminOnly] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const conector = await conectorConAgenda();
    if (!conector) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Activa «Agenda de citas» en el conector de Medifolios (Configuración → Fuentes).', statusCode: 400 });
    }
    const trabajo = sincronizarCitasConCandado(conector.id, { manual: true });
    // Si el candado está ocupado la respuesta llega al instante; si no, sigue en
    // segundo plano (~1 min). Así el botón no promete algo que no va a pasar.
    const rapida = await Promise.race([trabajo, new Promise<null>((r) => setTimeout(() => r(null), 1500))]);
    if (rapida?.omitida) {
      return reply.status(409).send({ error: 'Conflict', message: rapida.motivo ?? 'Ya hay una sincronización en curso.', statusCode: 409 });
    }
    return reply.status(202).send({ status: 'EN_PROCESO' });
  });

  // POST /api/diagnostico/agenda/backtest  (en segundo plano: unos minutos)
  fastify.post('/diagnostico/agenda/backtest', { preHandler: [...adminOnly] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const conector = await conectorConAgenda();
    if (!conector) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Activa «Agenda de citas» en el conector de Medifolios (Configuración → Fuentes).', statusCode: 400 });
    }
    const r = await iniciarBacktest(conector.id);
    if (!r.iniciado) {
      return reply.status(409).send({ error: 'Conflict', message: r.motivo ?? 'No se pudo iniciar la evaluación.', statusCode: 409 });
    }
    return reply.status(202).send({ status: 'EN_PROCESO' });
  });
}
