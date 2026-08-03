import { logger } from '../config/logger.js';
import {
  BaseConnector,
  type ConnectorQuery,
  type DataSet,
  type DataRow,
  type ConnectionTestResult,
} from './base.connector.js';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface RestConnectorConfig {
  baseUrl: string;
  /** Ruta que se cuelga de baseUrl, p. ej. 'facturacion/atenciones'. */
  endpoint?: string;
  /** Parámetros fijos de consulta, p. ej. { desde: '2026-01-01' }. */
  params?: Record<string, string>;
  headers?: Record<string, string>;
  /**
   * `apiKeyHeader` cubre las APIs que autentican con una cabecera propia en vez
   * de `Authorization` — como Medifolios, que usa `X-Auth-Token`.
   */
  authType?: 'none' | 'bearer' | 'basic' | 'apiKeyHeader';
  authValue?: string;
  /** Nombre de la cabecera cuando authType es apiKeyHeader. */
  authHeaderName?: string;
  /**
   * Traduce los nombres de campo del origen a los que el mapeador reconoce.
   * Clave = campo canónico, valor = campo tal como viene en la respuesta.
   *
   * Hace falta porque el mapeador detecta columnas con expresiones regulares
   * pensadas para hojas en español, y fallan con nombres tipo `valor_total`
   * (`\b` no coincide antes de `_`) o `montoFacturado`.
   */
  fieldMap?: Record<string, string>;
  /** Segundos. Por defecto 10; el histórico completo suele necesitar más. */
  timeoutSec?: number;
  /** Ruta dentro del JSON donde vive el arreglo, p. ej. 'resultado.items'. */
  dataPath?: string;
  name?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Campos que el mapeador de atenciones sabe reconocer. `fieldMap` traduce a
 * estos nombres exactos, elegidos para caer siempre dentro de los patrones de
 * `sheet-atencion-mapper.ts`.
 */
export const CAMPOS_CANONICOS = [
  'fecha',
  'descripcion',
  'autorizacion',
  'entidad',
  'profesional',
  'valor',
  'paciente',
  'documento',
] as const;

// ─── Implementation ───────────────────────────────────────────────────────────

export class RestConnector extends BaseConnector {
  readonly tipo = 'REST_API' as const;

  constructor(private readonly config: RestConnectorConfig) {
    super();
  }

  private timeoutMs(): number {
    const s = this.config.timeoutSec;
    // Tope de 5 minutos: por encima el cron se solaparía con la corrida siguiente.
    return s && s > 0 ? Math.min(s, 300) * 1000 : DEFAULT_TIMEOUT_MS;
  }

  // ─── Build headers ────────────────────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(this.config.headers ?? {}),
    };

    if (this.config.authType === 'bearer' && this.config.authValue) {
      headers['Authorization'] = `Bearer ${this.config.authValue}`;
    } else if (this.config.authType === 'basic' && this.config.authValue) {
      headers['Authorization'] = `Basic ${this.config.authValue}`;
    } else if (this.config.authType === 'apiKeyHeader' && this.config.authValue) {
      headers[this.config.authHeaderName || 'X-Auth-Token'] = this.config.authValue;
    }

    return headers;
  }

  // ─── Fetch with timeout ───────────────────────────────────────────────────

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs());

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: this.buildHeaders(),
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ─── test() ───────────────────────────────────────────────────────────────

  async test(): Promise<ConnectionTestResult> {
    const start = Date.now();
    // Se prueba la ruta REAL que usará la sincronización: comprobar solo la URL
    // base daría verde aunque el endpoint no exista o no autorice.
    const url = this.buildUrl({});

    try {
      const response = await this.fetchWithTimeout(url);
      const latencyMs = Date.now() - start;

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`,
          latencyMs,
          details: { status: response.status },
        };
      }

      return {
        success: true,
        message: `Conectado (HTTP ${response.status})`,
        latencyMs,
        details: { status: response.status, url },
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const isTimeout =
        err instanceof Error && err.name === 'AbortError';
      const message = isTimeout
        ? `Timeout después de ${this.timeoutMs() / 1000} segundos`
        : err instanceof Error
        ? err.message
        : 'Error de conexión';

      logger.warn('RestConnector test failed', {
        url,
        error: message,
      });

      return {
        success: false,
        message,
        latencyMs,
      };
    }
  }

  // ─── fetch() ─────────────────────────────────────────────────────────────

  /** La ruta y los parámetros salen de la configuración; la consulta puede
   *  añadir o sobrescribir. */
  private buildUrl(query: ConnectorQuery): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const ruta = query.endpoint ?? this.config.endpoint ?? '';
    const endpoint = ruta ? `/${ruta.replace(/^\//, '')}` : '';

    const searchParams = new URLSearchParams({
      ...(this.config.params ?? {}),
      ...(query.params ?? {}),
    });
    if (query.limit) searchParams.set('limit', String(query.limit));
    if (query.offset) searchParams.set('offset', String(query.offset));

    const qs = searchParams.toString();
    return qs ? `${base}${endpoint}?${qs}` : `${base}${endpoint}`;
  }

  /**
   * Localiza el arreglo de registros dentro de la respuesta.
   *
   * Con `dataPath` se navega la ruta indicada ('resultado.items'); sin él se
   * prueban las envolturas habituales. Devolver el objeto entero envuelto es el
   * último recurso: es lo que provoca que el mapeador vea una sola fila sin
   * columnas reconocibles y aborte sin insertar nada.
   */
  private extraerArreglo(json: unknown): unknown[] {
    if (this.config.dataPath) {
      let nodo: unknown = json;
      for (const parte of this.config.dataPath.split('.')) {
        if (nodo === null || typeof nodo !== 'object') break;
        nodo = (nodo as Record<string, unknown>)[parte];
      }
      if (Array.isArray(nodo)) return nodo;
      logger.warn('RestConnector: dataPath no apunta a un arreglo', {
        dataPath: this.config.dataPath,
      });
    }

    if (Array.isArray(json)) return json;

    if (json !== null && typeof json === 'object') {
      const obj = json as Record<string, unknown>;
      for (const clave of ['data', 'datos', 'items', 'results', 'resultado', 'registros']) {
        if (Array.isArray(obj[clave])) return obj[clave] as unknown[];
      }
    }

    return [json];
  }

  /**
   * Renombra los campos del origen a los nombres canónicos que el mapeador
   * reconoce. Los campos no mapeados se conservan tal cual: no estorban y
   * ayudan a diagnosticar desde el diagnóstico de columnas.
   */
  private traducir(row: DataRow): DataRow {
    const mapa = this.config.fieldMap;
    if (!mapa || Object.keys(mapa).length === 0) return row;

    const salida: DataRow = { ...row };
    for (const [canonico, origen] of Object.entries(mapa)) {
      if (!origen || !(origen in row)) continue;
      salida[canonico] = row[origen]!;
    }
    return salida;
  }

  async fetch(query: ConnectorQuery): Promise<DataSet> {
    const url = this.buildUrl(query);

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(
        `REST API error: HTTP ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json() as unknown;

    const rawArray = this.extraerArreglo(json);

    if (rawArray.length === 0) {
      return {
        columns: [],
        rows: [],
        totalRows: 0,
        fetchedAt: new Date(),
        source: this.config.name ?? this.config.baseUrl,
      };
    }

    // Derive columns from first object
    const firstItem = rawArray[0];
    const columns =
      firstItem !== null && typeof firstItem === 'object'
        ? Object.keys(firstItem as Record<string, unknown>)
        : [];

    const rows: DataRow[] = rawArray.map((item) => {
      if (item === null || typeof item !== 'object') {
        return { value: String(item) };
      }
      const row: DataRow = {};
      for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
        if (
          v === null ||
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean'
        ) {
          row[k] = v;
        } else {
          row[k] = JSON.stringify(v);
        }
      }
      return this.traducir(row);
    });

    return {
      // Las columnas se toman de una fila ya traducida: es lo que verá el
      // mapeador, y lo que debe mostrar el diagnóstico de columnas.
      columns: rows.length > 0 ? Object.keys(rows[0]!) : columns,
      rows,
      totalRows: rows.length,
      fetchedAt: new Date(),
      source: this.config.name ?? this.config.baseUrl,
    };
  }
}
