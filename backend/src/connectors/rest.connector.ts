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
  headers?: Record<string, string>;
  authType?: 'none' | 'bearer' | 'basic';
  authValue?: string;
  name?: string;
}

const REQUEST_TIMEOUT_MS = 10_000;

// ─── Implementation ───────────────────────────────────────────────────────────

export class RestConnector extends BaseConnector {
  readonly tipo = 'REST_API' as const;

  constructor(private readonly config: RestConnectorConfig) {
    super();
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
    }

    return headers;
  }

  // ─── Fetch with timeout ───────────────────────────────────────────────────

  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
    const url = this.config.baseUrl;

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
        ? 'Timeout después de 10 segundos'
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

  async fetch(query: ConnectorQuery): Promise<DataSet> {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const endpoint = query.endpoint ? `/${query.endpoint.replace(/^\//, '')}` : '';
    let url = `${base}${endpoint}`;

    // Append query params
    if (query.params && Object.keys(query.params).length > 0) {
      const searchParams = new URLSearchParams(query.params);
      if (query.limit) searchParams.set('limit', String(query.limit));
      if (query.offset) searchParams.set('offset', String(query.offset));
      url = `${url}?${searchParams.toString()}`;
    } else {
      const searchParams = new URLSearchParams();
      if (query.limit) searchParams.set('limit', String(query.limit));
      if (query.offset) searchParams.set('offset', String(query.offset));
      const qs = searchParams.toString();
      if (qs) url = `${url}?${qs}`;
    }

    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new Error(
        `REST API error: HTTP ${response.status} ${response.statusText}`
      );
    }

    const json = await response.json() as unknown;

    // Support both array and envelope { data: [...] }
    let rawArray: unknown[];
    if (Array.isArray(json)) {
      rawArray = json;
    } else if (
      json !== null &&
      typeof json === 'object' &&
      'data' in json &&
      Array.isArray((json as Record<string, unknown>)['data'])
    ) {
      rawArray = (json as Record<string, unknown>)['data'] as unknown[];
    } else {
      // Single object — wrap it
      rawArray = [json];
    }

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
      return row;
    });

    return {
      columns,
      rows,
      totalRows: rows.length,
      fetchedAt: new Date(),
      source: this.config.name ?? this.config.baseUrl,
    };
  }
}
