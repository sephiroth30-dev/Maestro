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

// ─── V10.2 date-tab detection ─────────────────────────────────────────────────
// Mirrors isDateSheetName_() from the original Apps Script.
// Valid tab names: "2 ENERO", "15 MARZO", "ENERO 2", etc.

const MESES = new Set([
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]);

function stripDiacritics(s: string): string {
  // ̀-ͯ = Unicode combining diacritical marks block
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isDateSheetName(name: string): boolean {
  const normalized = stripDiacritics(name)
    .toUpperCase()
    .replace(/[-_]/g, ' ')
    .replace(/\bDE\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = normalized.split(' ');
  if (parts.length !== 2) return false;

  const [a, b] = parts;
  const aIsDay = /^\d{1,2}$/.test(a) && parseInt(a, 10) >= 1 && parseInt(a, 10) <= 31;
  const bIsDay = /^\d{1,2}$/.test(b) && parseInt(b, 10) >= 1 && parseInt(b, 10) <= 31;
  const aIsMes = MESES.has(a);
  const bIsMes = MESES.has(b);

  return (aIsDay && bIsMes) || (aIsMes && bIsDay);
}

// Escapes a sheet name for use in a Sheets API range (wraps in single quotes,
// escaping embedded single quotes as '').
function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
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
        fields: 'spreadsheetId,properties.title,sheets.properties.title',
      });

      const latencyMs = Date.now() - start;
      const title = response.data.properties?.title ?? 'Untitled';
      const tabNames = (response.data.sheets ?? []).map((s) => s.properties?.title ?? '');
      const dateTabs = tabNames.filter(isDateSheetName);

      return {
        success: true,
        message: `Conectado a "${title}" — ${dateTabs.length} hoja(s) de atención encontradas`,
        latencyMs,
        details: {
          spreadsheetId: this.config.spreadsheetId,
          title,
          totalTabs: tabNames.length,
          dateTabs: dateTabs.length,
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
  // When query.sheetName is specified, reads that single tab.
  // Otherwise auto-detects all date-named tabs (V10.2 pattern) and merges them.

  async fetch(query: ConnectorQuery): Promise<DataSet> {
    const sheets = await this.getSheets();

    // Specific tab requested — single read
    if (query.sheetName) {
      return this.readTab(sheets, query.sheetName, query);
    }

    // Auto-detect date-named tabs
    const allTabNames = await this.listSheets();
    const dateTabs = allTabNames.filter(isDateSheetName);

    if (dateTabs.length === 0) {
      logger.warn('No date-named tabs found, falling back to default range', {
        spreadsheetId: this.config.spreadsheetId,
        tabs: allTabNames,
      });
      return this.readTab(sheets, '', query);
    }

    logger.info('Reading date tabs from spreadsheet', {
      spreadsheetId: this.config.spreadsheetId,
      count: dateTabs.length,
      tabs: dateTabs,
    });

    const allRows: DataRow[] = [];
    let columns: string[] = [];

    for (const tabName of dateTabs) {
      try {
        const dataset = await this.readTab(sheets, tabName, {});
        if (dataset.columns.length > columns.length) {
          columns = dataset.columns;
        }
        allRows.push(...dataset.rows);
      } catch (err) {
        logger.warn('Skipping tab due to read error', {
          tabName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      columns,
      rows: allRows,
      totalRows: allRows.length,
      fetchedAt: new Date(),
      source: this.config.name ?? this.config.spreadsheetId,
    };
  }

  // ─── readTab() ────────────────────────────────────────────────────────────

  private async readTab(
    sheets: sheets_v4.Sheets,
    sheetName: string,
    query: ConnectorQuery,
  ): Promise<DataSet> {
    const rangeBase = query.range ?? 'A:Z';
    const fullRange = sheetName ? `${quoteSheetName(sheetName)}!${rangeBase}` : rangeBase;

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

    const rawHeaders = values[0] as unknown[];
    const columns = rawHeaders.map((h) => String(h ?? '').trim());

    const rows: DataRow[] = [];
    for (const rawRow of values.slice(1)) {
      const row = rawRow as unknown[];
      const hasContent = row.some((c) => c !== null && c !== undefined && c !== '');
      if (!hasContent) continue;

      const dataRow: DataRow = {};
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (!col) continue;
        dataRow[col] = (row[i] as string | number | boolean | null | undefined) ?? null;
      }
      rows.push(dataRow);
    }

    // Apply offset/limit only when reading a single requested tab
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

    return (response.data.sheets ?? [])
      .map((s) => s.properties?.title ?? '')
      .filter(Boolean);
  }
}
