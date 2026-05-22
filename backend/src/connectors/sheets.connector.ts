import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';
import { logger } from '../config/logger.js';
import {
  BaseConnector,
  type ConnectorQuery,
  type DataSet,
  type DataRow,
  type ConnectionTestResult,
} from './base.connector.js';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface SheetsConnectorConfig {
  spreadsheetId: string;
  credentials: Record<string, unknown> | string; // JSON object or path to file
  name?: string;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export class SheetsConnector extends BaseConnector {
  readonly tipo = 'GOOGLE_SHEETS' as const;

  private sheetsClient: sheets_v4.Sheets | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private authClient: any = null;

  constructor(private readonly config: SheetsConnectorConfig) {
    super();
  }

  // ─── Lazy auth init ───────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getAuth(): Promise<any> {
    if (this.authClient) return this.authClient;

    const credentials =
      typeof this.config.credentials === 'string'
        ? { keyFile: this.config.credentials }
        : { credentials: this.config.credentials };

    this.authClient = new google.auth.GoogleAuth({
      ...credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    return this.authClient;
  }

  private async getSheets(): Promise<sheets_v4.Sheets> {
    if (this.sheetsClient) return this.sheetsClient;

    const auth = await this.getAuth();
    this.sheetsClient = google.sheets({ version: 'v4', auth });
    return this.sheetsClient;
  }

  // ─── test() ───────────────────────────────────────────────────────────────

  async test(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const sheets = await this.getSheets();
      const response = await sheets.spreadsheets.get({
        spreadsheetId: this.config.spreadsheetId,
        fields: 'spreadsheetId,properties.title',
      });

      const latencyMs = Date.now() - start;
      const title = response.data.properties?.title ?? 'Untitled';

      return {
        success: true,
        message: `Conectado a "${title}"`,
        latencyMs,
        details: {
          spreadsheetId: this.config.spreadsheetId,
          title,
        },
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      logger.warn('SheetsConnector test failed', {
        spreadsheetId: this.config.spreadsheetId,
        error: message,
      });
      return {
        success: false,
        message: `Error de conexión: ${message}`,
        latencyMs,
      };
    }
  }

  // ─── fetch() ─────────────────────────────────────────────────────────────

  async fetch(query: ConnectorQuery): Promise<DataSet> {
    const sheets = await this.getSheets();
    const sheetName = query.sheetName ?? '';
    const range = query.range ?? 'A1:Z1000';
    const fullRange = sheetName ? `${sheetName}!${range}` : range;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: this.config.spreadsheetId,
      range: fullRange,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const values = response.data.values ?? [];

    if (values.length === 0) {
      return {
        columns: [],
        rows: [],
        totalRows: 0,
        fetchedAt: new Date(),
        source: this.config.name ?? this.config.spreadsheetId,
      };
    }

    // First row is headers
    const rawHeaders = values[0] as unknown[];
    const columns = rawHeaders.map((h) =>
      String(h ?? '').trim()
    );

    const dataRows = values.slice(1);
    const rows: DataRow[] = [];

    for (const rawRow of dataRows) {
      const row = rawRow as unknown[];
      // Skip fully empty rows
      const hasContent = row.some(
        (cell) => cell !== null && cell !== undefined && cell !== ''
      );
      if (!hasContent) continue;

      const dataRow: DataRow = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (!col) continue;
        const cell = row[i] as string | number | boolean | null | undefined;
        dataRow[col] = cell !== undefined ? (cell as string | number | boolean | null) : null;
      }
      rows.push(dataRow);
    }

    // Apply limit/offset
    let result = rows;
    if (query.offset) result = result.slice(query.offset);
    if (query.limit) result = result.slice(0, query.limit);

    return {
      columns,
      rows: result,
      totalRows: rows.length,
      fetchedAt: new Date(),
      source: this.config.name ?? this.config.spreadsheetId,
    };
  }

  // ─── listSheets() ─────────────────────────────────────────────────────────

  async listSheets(): Promise<string[]> {
    const sheets = await this.getSheets();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'sheets.properties.title',
    });

    return (response.data.sheets ?? []).map(
      (s) => s.properties?.title ?? ''
    ).filter(Boolean);
  }
}
