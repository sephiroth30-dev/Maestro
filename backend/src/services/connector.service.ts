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

export const SheetsConfigSchema = z.object({
  spreadsheetId: z.string().min(1, 'spreadsheetId es requerido'),
  credentials: z.union([
    GoogleServiceAccountSchema,
    z.string().min(1, 'credentials debe ser un objeto JSON o ruta al archivo'),
  ]),
});

export const RestConfigSchema = z.object({
  baseUrl: z.string().url('baseUrl debe ser una URL válida'),
  headers: z.record(z.string()).optional(),
  authType: z.enum(['none', 'bearer', 'basic']).optional(),
  authValue: z.string().optional(),
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

  // ─── Mask credentials in logs ─────────────────────────────────────────────

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    const masked = { ...config };
    if ('credentials' in masked) {
      masked['credentials'] = '[REDACTED]';
    }
    if ('authValue' in masked) {
      masked['authValue'] = '[REDACTED]';
    }
    return masked;
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

    if (data.config) {
      this.validateConfig(conector.tipo, data.config);
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
        spreadsheetId: config['spreadsheetId'] as string,
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
