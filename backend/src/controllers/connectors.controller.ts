import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/rbac.middleware.js';
import { connectorService, FrecuenciaSyncSchema } from '../services/connector.service.js';
import { syncService } from '../services/sync.service.js';
import { logger } from '../config/logger.js';
import { pool } from '../config/prisma.js';
import { flushReportesCache } from '../config/redis.js';
import type { TipoConector } from '@prisma/client';
import { detectColumnMapping } from '../services/sheet-atencion-mapper.js';

// ─── Request schemas ──────────────────────────────────────────────────────────

const CreateConnectorSchema = z.object({
  nombre: z.string().min(1, 'nombre es requerido').max(100),
  tipo: z.enum(['GOOGLE_SHEETS', 'REST_API', 'POSTGRESQL', 'CSV']),
  config: z.record(z.unknown()),
  frecuenciaSync: FrecuenciaSyncSchema.optional(),
});

const UpdateConnectorSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  activo: z.boolean().optional(),
  frecuenciaSync: FrecuenciaSyncSchema.optional(),
});

const TestNewConnectorSchema = z.object({
  nombre: z.string().min(1),
  tipo: z.enum(['GOOGLE_SHEETS', 'REST_API', 'POSTGRESQL', 'CSV']),
  config: z.record(z.unknown()),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function connectorRoutes(fastify: FastifyInstance): Promise<void> {
  const adminOnly = [requireAuth, requireRole('ADMIN')] as const;
  const adminOrBilling = [requireAuth, requireRole('ADMIN', 'FACTURACION')] as const;

  // GET /api/connectors
  fastify.get(
    '/connectors',
    { preHandler: [...adminOnly] },
    async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const list = await connectorService.list();
      await reply.send(list);
    }
  );

  // POST /api/connectors
  fastify.post(
    '/connectors',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = CreateConnectorSchema.safeParse(req.body);
      if (!parsed.success) {
        await reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
          statusCode: 400,
        });
        return;
      }

      const conector = await connectorService.create({
        ...parsed.data,
        tipo: parsed.data.tipo as TipoConector,
        config: parsed.data.config as Record<string, unknown>,
      });
      await reply.status(201).send(conector);
    }
  );

  // POST /api/connectors/test  (test NEW config before saving — must be BEFORE /:id routes)
  fastify.post(
    '/connectors/test',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const parsed = TestNewConnectorSchema.safeParse(req.body);
      if (!parsed.success) {
        await reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
          statusCode: 400,
        });
        return;
      }

      const result = await connectorService.testConnection({
        nombre: parsed.data.nombre,
        tipo: parsed.data.tipo as TipoConector,
        config: parsed.data.config as Record<string, unknown>,
      });

      await reply.send(result);
    }
  );

  // GET /api/connectors/:id
  fastify.get(
    '/connectors/:id',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      const conector = await connectorService.getById(id);
      await reply.send(conector);
    }
  );

  // PUT /api/connectors/:id
  fastify.put(
    '/connectors/:id',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      const parsed = UpdateConnectorSchema.safeParse(req.body);
      if (!parsed.success) {
        await reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.issues[0]?.message ?? 'Invalid body',
          statusCode: 400,
        });
        return;
      }

      const conector = await connectorService.update(id, {
        ...parsed.data,
        config: parsed.data.config as Record<string, unknown> | undefined,
      });
      await reply.send(conector);
    }
  );

  // DELETE /api/connectors/:id
  fastify.delete(
    '/connectors/:id',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      await connectorService.delete(id);
      flushReportesCache();
      await reply.status(204).send();
    }
  );

  // POST /api/connectors/:id/test  (test existing connector)
  fastify.post(
    '/connectors/:id/test',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      const conector = await connectorService.getById(id);
      const result = await connectorService.testConnection(conector);
      await reply.send(result);
    }
  );

  // GET /api/connectors/:id/sheets
  fastify.get(
    '/connectors/:id/sheets',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      const sheets = await connectorService.listSheets(id);
      await reply.send({ sheets });
    }
  );

  // POST /api/connectors/:id/sync  (manual trigger — async, returns 202 immediately)
  fastify.post(
    '/connectors/:id/sync',
    { preHandler: [...adminOrBilling] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      // Fire-and-forget: sync can take 60-120s; Hostinger proxy times out at ~30s.
      // Return 202 immediately and let the client poll the history endpoint.
      void syncService.runSync(id).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error('Background sync failed', { conectorId: id, error: msg });
      });
      await reply.status(202).send({ conectorId: id, status: 'EN_PROCESO' });
    }
  );

  // DELETE /api/connectors/:id/data  (wipe atenciones for this connector — ADMIN only)
  fastify.delete(
    '/connectors/:id/data',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      // Ensure connector exists first
      await connectorService.getById(id);
      const [deleteResult] = await pool.query<import('mysql2').ResultSetHeader>(
        'DELETE FROM atenciones WHERE conector_id = ?',
        [id]
      );
      const result = { count: deleteResult.affectedRows };
      flushReportesCache();
      logger.info('Connector data wiped', { conectorId: id, deleted: result.count });
      await reply.send({ conectorId: id, deleted: result.count });
    }
  );

  // GET /api/connectors/:id/sync/history
  fastify.get(
    '/connectors/:id/sync/history',
    { preHandler: [...adminOrBilling] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };
      const query = req.query as { limit?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const history = await syncService.getHistory(id, limit);
      await reply.send(history);
    }
  );

  // DELETE /api/connectors/data/orphan  (wipe seed/orphan atenciones with no conector_id — ADMIN only)
  fastify.delete(
    '/connectors/data/orphan',
    { preHandler: [...adminOnly] },
    async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const [deleteResult] = await pool.query<import('mysql2').ResultSetHeader>(
        'DELETE FROM atenciones WHERE conector_id IS NULL'
      );
      flushReportesCache();
      logger.info('Orphan atenciones wiped', { deleted: deleteResult.affectedRows });
      await reply.send({ deleted: deleteResult.affectedRows });
    }
  );

  // GET /api/connectors/:id/column-diagnostico
  // Shows which columns were detected + sum of every numeric column in cached data.
  // Use this to verify that the correct VALOR BRUTO column is being picked.
  fastify.get(
    '/connectors/:id/column-diagnostico',
    { preHandler: [...adminOnly] },
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      const { id } = req.params as { id: string };

      const cached = await syncService.getCachedData(id);
      if (!cached || cached.rows.length === 0) {
        await reply.status(404).send({ error: 'No hay datos en caché para este conector. Ejecuta una sincronización primero.' });
        return;
      }

      // Collect all unique column sets (multi-file mode may have different structures)
      const sigMap = new Map<string, { columns: string[]; rowCount: number; colMap: Record<string, string | null>; numericSums: Record<string, number> }>();

      for (const row of cached.rows) {
        const keys = Object.keys(row);
        const sig = keys.slice().sort().join('\x00');

        if (!sigMap.has(sig)) {
          const numericSums: Record<string, number> = {};
          for (const k of keys) numericSums[k] = 0;
          sigMap.set(sig, { columns: keys, rowCount: 0, colMap: detectColumnMapping(keys) as Record<string, string | null>, numericSums });
        }

        const entry = sigMap.get(sig)!;
        entry.rowCount++;
        for (const k of keys) {
          const v = row[k];
          if (typeof v === 'number') entry.numericSums[k] = (entry.numericSums[k] ?? 0) + v;
        }
      }

      const result = Array.from(sigMap.values()).map((e) => ({
        columns: e.columns,
        rowCount: e.rowCount,
        detectedMapping: e.colMap,
        numericColumnSums: Object.fromEntries(
          Object.entries(e.numericSums).filter(([, v]) => v !== 0).sort(([, a], [, b]) => b - a)
        ),
      }));

      await reply.send({ conectorId: id, totalRows: cached.rows.length, columnSets: result });
    }
  );
}
