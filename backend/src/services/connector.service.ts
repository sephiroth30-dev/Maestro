import { z } from 'zod';
import type { Conector, TipoConector } from '@prisma/client';
import { conectoresRepo } from '../repositories/conectores.repo.js';
import { BaseConnector, type ConnectionTestResult } from '../connectors/base.connector.js';
import { SheetsConnector } from '../connectors/sheets.connector.js';
import { RestConnector } from '../connectors/rest.connector.js';
import { logger } from '../config/logger.js';

// ─── Zod Config Schemas ───────────────────────────────────────────────────────

const GoogleServiceAccountSchema = z.object({
  type: z.string().optional(),
  project_id: z.string().optional(),
  private_key_id: z.string().optional(),
  private_key: z.string().optional(),
  client_email: z.string().optional(),
  client_id: z.string().optional(),
  auth_uri: z.string().optional(),
  token_uri: z.string().optional(),
}).passthrough();

export const SheetsConfigSchema = z
  .object({
    spreadsheetId: z.string().min(1).optional(),
    folderId: z.string().min(1).optional(),
    fileNamePattern: z.string().optional(),
    credentials: z.union([
      GoogleServiceAccountSchema,
      z.string().min(1, 'credentials debe ser un objeto JSON o ruta al archivo'),
    ]),
  })
  .refine((d) => d.spreadsheetId ?? d.folderId, {
    message: 'Se requiere spreadsheetId (hoja individual) o folderId (carpeta de Drive)',
  });

export const RestConfigSchema = z.object({
  baseUrl: z.string().url('baseUrl debe ser una URL válida'),
  /** Ruta relativa a baseUrl. Sin ella se pide la raíz, que rara vez sirve. */
  endpoint: z.string().optional(),
  params: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  authType: z.enum(['none', 'bearer', 'basic', 'apiKeyHeader']).optional(),
  authValue: z.string().optional(),
  authHeaderName: z.string().optional(),
  /** Campo canónico -> campo tal como llega del origen. */
  fieldMap: z.record(z.string()).optional(),
  dataPath: z.string().optional(),
  timeoutSec: z.number().int().min(1).max(300).optional(),
})
  .refine((d) => d.authType !== 'apiKeyHeader' || Boolean(d.authHeaderName), {
    message: 'Con autenticación por cabecera hay que indicar el nombre de la cabecera',
    path: ['authHeaderName'],
  });

export const FrecuenciaSyncSchema = z.enum([
  '30min',
  '1h',
  '4h',
  'daily',
  'manual',
]);

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateConnectorDto {
  nombre: string;
  tipo: TipoConector;
  config: Record<string, unknown>;
  frecuenciaSync?: string;
}

export interface UpdateConnectorDto {
  nombre?: string;
  config?: Record<string, unknown>;
  activo?: boolean;
  frecuenciaSync?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ConnectorService {
  // ─── Validate config per tipo ─────────────────────────────────────────────

  private validateConfig(
    tipo: TipoConector,
    config: Record<string, unknown>
  ): void {
    if (tipo === 'GOOGLE_SHEETS') {
      const result = SheetsConfigSchema.safeParse(config);
      if (!result.success) {
        throw new Error(
          `Configuración inválida para Google Sheets: ${result.error.issues[0]?.message}`
        );
      }
    } else if (tipo === 'REST_API') {
      const result = RestConfigSchema.safeParse(config);
      if (!result.success) {
        throw new Error(
          `Configuración inválida para REST API: ${result.error.issues[0]?.message}`
        );
      }
    }
    // POSTGRESQL and CSV: validation deferred to future stages
  }

  // ─── Ocultar credenciales ─────────────────────────────────────────────────

  private static readonly MASCARA = '[REDACTED]';

  /** Claves cuyo contenido nunca debe salir del servidor. */
  private static readonly CLAVES_SECRETAS = [
    'credentials', 'authValue', 'password', 'apiKey', 'secret', 'privateKey',
  ];

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...config };
    for (const clave of ConnectorService.CLAVES_SECRETAS) {
      if (clave in masked && masked[clave]) masked[clave] = ConnectorService.MASCARA;
    }
    // Las cabeceras libres son el sitio habitual para meter una API key.
    if (masked['headers'] && typeof masked['headers'] === 'object') {
      const h = masked['headers'] as Record<string, unknown>;
      masked['headers'] = Object.fromEntries(
        Object.keys(h).map((k) => [k, /token|key|auth|secret/i.test(k) ? ConnectorService.MASCARA : h[k]]),
      );
    }
    return masked;
  }

  /** Repone los valores reales donde el cliente devolvió la máscara. */
  private preservarSecretos(
    entrante: Record<string, unknown>,
    guardado: Record<string, unknown>,
  ): Record<string, unknown> {
    const salida = { ...entrante };
    for (const clave of ConnectorService.CLAVES_SECRETAS) {
      if (salida[clave] === ConnectorService.MASCARA && guardado[clave] !== undefined) {
        salida[clave] = guardado[clave];
      }
    }
    if (salida['headers'] && typeof salida['headers'] === 'object') {
      const nuevos = salida['headers'] as Record<string, unknown>;
      const viejos = (guardado['headers'] ?? {}) as Record<string, unknown>;
      salida['headers'] = Object.fromEntries(
        Object.entries(nuevos).map(([k, v]) =>
          v === ConnectorService.MASCARA && viejos[k] !== undefined ? [k, viejos[k]] : [k, v],
        ),
      );
    }
    return salida;
  }

  /**
   * Versión del conector apta para enviar al navegador.
   *
   * Antes `GET /connectors` devolvía el `config` íntegro —con la clave privada
   * de Google y el token de la API— a cualquier sesión de administrador. El
   * frontend solo necesita saber SI hay credencial, no cuál es.
   */
  publicView(conector: Conector): Conector {
    return {
      ...conector,
      config: this.maskConfig(conector.config as Record<string, unknown>),
    } as Conector;
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(data: CreateConnectorDto): Promise<Conector> {
    this.validateConfig(data.tipo, data.config);

    if (data.frecuenciaSync) {
      const result = FrecuenciaSyncSchema.safeParse(data.frecuenciaSync);
      if (!result.success) {
        throw new Error(`frecuenciaSync inválida: valores válidos son 30min, 1h, 4h, daily, manual`);
      }
    }

    logger.info('Creating connector', {
      nombre: data.nombre,
      tipo: data.tipo,
      config: this.maskConfig(data.config),
    });

    return conectoresRepo.create({
      nombre: data.nombre,
      tipo: data.tipo,
      config: data.config,
      frecuenciaSync: data.frecuenciaSync ?? 'daily',
    });
  }

  async list(): Promise<Conector[]> {
    return conectoresRepo.findAll();
  }

  async getById(id: string): Promise<Conector> {
    const conector = await conectoresRepo.findById(id);
    if (!conector) {
      const err = new Error(`Conector ${id} no encontrado`) as Error & {
        statusCode: number;
      };
      err.statusCode = 404;
      throw err;
    }
    return conector;
  }

  async update(id: string, data: UpdateConnectorDto): Promise<Conector> {
    const conector = await this.getById(id);

    // Como la lectura devuelve las credenciales enmascaradas, el formulario de
    // edición las reenvía como '[REDACTED]'. Reponerlas evita que guardar un
    // simple cambio de nombre borre el token sin que nadie se entere.
    if (data.config) {
      const config = this.preservarSecretos(
        data.config,
        (conector.config ?? {}) as Record<string, unknown>,
      );
      this.validateConfig(conector.tipo, config);
      data = { ...data, config };
    }

    if (data.frecuenciaSync) {
      const result = FrecuenciaSyncSchema.safeParse(data.frecuenciaSync);
      if (!result.success) {
        throw new Error(`frecuenciaSync inválida: valores válidos son 30min, 1h, 4h, daily, manual`);
      }
    }

    logger.info('Updating connector', {
      id,
      changes: data.config ? { ...data, config: this.maskConfig(data.config) } : data,
    });

    return conectoresRepo.update(id, data);
  }

  async delete(id: string): Promise<void> {
    await this.getById(id); // ensure it exists
    logger.info('Soft-deleting connector', { id });
    await conectoresRepo.softDelete(id);
  }

  // ─── Instantiate connector ────────────────────────────────────────────────

  instantiate(conector: Conector): BaseConnector {
    const config = conector.config as Record<string, unknown>;

    if (conector.tipo === 'GOOGLE_SHEETS') {
      return new SheetsConnector({
        spreadsheetId: config['spreadsheetId'] as string | undefined,
        folderId: config['folderId'] as string | undefined,
        fileNamePattern: config['fileNamePattern'] as string | undefined,
        credentials: config['credentials'] as Record<string, unknown> | string,
        name: conector.nombre,
      });
    }

    if (conector.tipo === 'REST_API') {
      return new RestConnector({
        baseUrl: config['baseUrl'] as string,
        headers: config['headers'] as Record<string, string> | undefined,
        authType: config['authType'] as 'none' | 'bearer' | 'basic' | undefined,
        authValue: config['authValue'] as string | undefined,
        name: conector.nombre,
      });
    }

    throw new Error(`Tipo de conector no soportado: ${conector.tipo}`);
  }

  // ─── Test connection ──────────────────────────────────────────────────────

  async testConnection(
    conectorOrDto: Conector | CreateConnectorDto
  ): Promise<ConnectionTestResult> {
    let instance: BaseConnector;

    if ('id' in conectorOrDto) {
      // Existing connector from DB
      instance = this.instantiate(conectorOrDto as Conector);
    } else {
      // New config — create ephemeral instance
      const dto = conectorOrDto as CreateConnectorDto;
      this.validateConfig(dto.tipo, dto.config);

      const ephemeral = {
        id: 'test',
        nombre: dto.nombre,
        tipo: dto.tipo,
        config: dto.config,
        activo: true,
        frecuenciaSync: 'manual',
        ultimaSync: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Conector;

      instance = this.instantiate(ephemeral);
    }

    return instance.test();
  }

  // ─── List sheets ──────────────────────────────────────────────────────────

  async listSheets(conectorId: string): Promise<string[]> {
    const conector = await this.getById(conectorId);

    if (conector.tipo !== 'GOOGLE_SHEETS') {
      throw new Error('listSheets solo está disponible para conectores de tipo GOOGLE_SHEETS');
    }

    const instance = this.instantiate(conector) as SheetsConnector;
    return instance.listSheets();
  }
}

export const connectorService = new ConnectorService();
