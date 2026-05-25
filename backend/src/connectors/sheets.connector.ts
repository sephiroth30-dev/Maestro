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
  /** Single spreadsheet mode */
  spreadsheetId?: string;
  /** Folder mode: sync all spreadsheets inside this Drive folder */
  folderId?: string;
  /**
   * Optional regex (case-insensitive) to filter Drive files by name.
   * Only files whose name matches are synced. Example: "^CUADRE"
   */
  fileNamePattern?: string;
  /**
   * Explicit sheet/tab name to read. When set, that tab is tried first.
   * In folder mode, each spreadsheet uses this tab if it exists, otherwise
   * falls back to auto-detection (consolidated → date tabs → first sheet).
   * Example: "BASE_CONSOLIDADA_ANUAL"
   */
  sheetName?: string;
  credentials: Record<string, unknown> | string;
  name?: string;
}

// ─── V10.2 date-tab detection ─────────────────────────────────────────────────
// Mirrors isDateSheetName_() from the original Apps Script.
// Valid tab names: "2 ENERO", "15 MARZO", "ENERO 2", "2 DE ENERO", etc.

const MESES = new Set([
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]);

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Consolidated annual/base tabs — contain ALL records pre-merged.
// Preferred over individual date tabs when present.
const CONSOLIDATED_PATTERNS = [
  /base.*consolidada/i,
  /consolidada.*anual/i,
  /consolidada/i,
  /base.*anual/i,
];

function isConsolidatedSheetName(name: string): boolean {
  return CONSOLIDATED_PATTERNS.some((p) => p.test(name));
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

// Wraps a sheet name in single quotes for use in a Sheets API range.
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

  // ─── Auth ─────────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getAuth(): Promise<any> {
    if (this.authClient) return this.authClient;

    const credentials =
      typeof this.config.credentials === 'string'
        ? { keyFile: this.config.credentials }
        : { credentials: this.config.credentials };

    // Include drive.metadata.readonly when folder mode is active so the
    // service account can list files inside the folder.
    const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
    if (this.config.folderId) {
      scopes.push('https://www.googleapis.com/auth/drive.metadata.readonly');
    }

    this.authClient = new google.auth.GoogleAuth({ ...credentials, scopes });
    return this.authClient;
  }

  private async getSheets(): Promise<sheets_v4.Sheets> {
    if (this.sheetsClient) return this.sheetsClient;
    const auth = await this.getAuth();
    this.sheetsClient = google.sheets({ version: 'v4', auth });
    return this.sheetsClient;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getDrive(): Promise<any> {
    const auth = await this.getAuth();
    return google.drive({ version: 'v3', auth });
  }

  // ─── test() ───────────────────────────────────────────────────────────────

  async test(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (this.config.folderId) {
        return await this.testFolder(start);
      }
      return await this.testSpreadsheet(start);
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Error desconocido';
      logger.warn('SheetsConnector test failed', { error: message });
      return { success: false, message: `Error de conexión: ${message}`, latencyMs };
    }
  }

  private async testSpreadsheet(start: number): Promise<ConnectionTestResult> {
    if (!this.config.spreadsheetId) {
      return { success: false, message: 'spreadsheetId no configurado', latencyMs: 0 };
    }
    const sheets = await this.getSheets();
    const response = await sheets.spreadsheets.get({
      spreadsheetId: this.config.spreadsheetId,
      fields: 'spreadsheetId,properties.title,sheets.properties.title',
    });

    const latencyMs = Date.now() - start;
    const title = response.data.properties?.title ?? 'Untitled';
    const tabNames = (response.data.sheets ?? []).map((s) => s.properties?.title ?? '');

    // Report which reading strategy will be used
    let strategy: string;
    if (this.config.sheetName && tabNames.includes(this.config.sheetName)) {
      strategy = `hoja explícita "${this.config.sheetName}"`;
    } else {
      const consolidatedTab = tabNames.find(isConsolidatedSheetName);
      if (consolidatedTab) {
        strategy = `hoja consolidada "${consolidatedTab}"`;
      } else {
        const dateTabs = tabNames.filter(isDateSheetName);
        strategy = dateTabs.length > 0
          ? `${dateTabs.length} hoja(s) de fechas (${dateTabs.slice(0, 3).join(', ')}…)`
          : `primera hoja (sin hojas de fecha ni consolidada)`;
      }
    }

    return {
      success: true,
      message: `Conectado a "${title}" — ${strategy}`,
      latencyMs,
      details: { spreadsheetId: this.config.spreadsheetId, title, totalTabs: tabNames.length, strategy },
    };
  }

  private async testFolder(start: number): Promise<ConnectionTestResult> {
    const drive = await this.getDrive();
    const folderId = this.config.folderId!;

    // Check folder itself exists
    const meta = await drive.files.get({
      fileId: folderId,
      fields: 'id,name',
    });

    const folderName = meta.data.name ?? folderId;
    const spreadsheetIds = await this.listSpreadsheets(folderId);
    const latencyMs = Date.now() - start;

    return {
      success: true,
      message: `Carpeta "${folderName}" — ${spreadsheetIds.length} planilla(s) encontrada(s)`,
      latencyMs,
      details: { folderId, folderName, spreadsheets: spreadsheetIds.length },
    };
  }

  // ─── fetch() ─────────────────────────────────────────────────────────────

  async fetch(query: ConnectorQuery): Promise<DataSet> {
    if (this.config.folderId) {
      return this.fetchFromFolder(this.config.folderId);
    }

    if (!this.config.spreadsheetId) {
      throw new Error('SheetsConnector requires spreadsheetId or folderId in config');
    }

    return this.fetchFromSpreadsheet(this.config.spreadsheetId, query);
  }

  // ─── Folder mode: discover + merge all spreadsheets ──────────────────────

  private async fetchFromFolder(folderId: string): Promise<DataSet> {
    const spreadsheetIds = await this.listSpreadsheets(folderId);

    if (spreadsheetIds.length === 0) {
      logger.warn('No spreadsheets found in folder', { folderId });
      return { columns: [], rows: [], totalRows: 0, fetchedAt: new Date(), source: this.config.name ?? folderId };
    }

    logger.info('Syncing spreadsheets from folder', { folderId, count: spreadsheetIds.length });

    const allRows: DataRow[] = [];
    let columns: string[] = [];

    for (const spreadsheetId of spreadsheetIds) {
      try {
        const dataset = await this.fetchFromSpreadsheet(spreadsheetId, {});
        if (dataset.columns.length > columns.length) columns = dataset.columns;
        allRows.push(...dataset.rows);
        logger.info('Spreadsheet synced', { spreadsheetId, rows: dataset.totalRows });
      } catch (err) {
        logger.warn('Skipping spreadsheet due to error', {
          spreadsheetId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      columns,
      rows: allRows,
      totalRows: allRows.length,
      fetchedAt: new Date(),
      source: this.config.name ?? folderId,
    };
  }

  // ─── Spreadsheet mode: detect date tabs + merge rows ─────────────────────

  private async fetchFromSpreadsheet(
    spreadsheetId: string,
    query: ConnectorQuery,
  ): Promise<DataSet> {
    const sheets = await this.getSheets();

    // If a specific tab is requested via query, use it directly
    if (query.sheetName) {
      return this.readTab(sheets, spreadsheetId, query.sheetName, query);
    }

    // List all tabs to decide reading strategy
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    const allTabNames = (response.data.sheets ?? [])
      .map((s) => s.properties?.title ?? '')
      .filter(Boolean);

    // ── Priority 1: explicit sheetName from connector config ──────────────────
    if (this.config.sheetName) {
      if (allTabNames.includes(this.config.sheetName)) {
        logger.info('Reading explicit tab from config', { spreadsheetId, tab: this.config.sheetName });
        return this.readTab(sheets, spreadsheetId, this.config.sheetName, query);
      }
      // Tab not present in this spreadsheet — fall through to auto-detection
      logger.info('Configured sheetName not found, auto-detecting', { spreadsheetId, sheetName: this.config.sheetName });
    }

    // ── Priority 2: consolidated annual base tab (has all records in one place) ─
    const consolidatedTab = allTabNames.find(isConsolidatedSheetName);
    if (consolidatedTab) {
      logger.info('Found consolidated tab, reading it directly', { spreadsheetId, tab: consolidatedTab });
      return this.readTab(sheets, spreadsheetId, consolidatedTab, query);
    }

    // ── Priority 3: date-named tabs (V10.2 monthly spreadsheet pattern) ───────
    const dateTabs = allTabNames.filter(isDateSheetName);

    if (dateTabs.length === 0) {
      logger.warn('No date-named or consolidated tabs found, using default range', { spreadsheetId, tabs: allTabNames });
      return this.readTab(sheets, spreadsheetId, '', query);
    }

    logger.info('Reading date tabs', { spreadsheetId, count: dateTabs.length, tabs: dateTabs });

    // Build ranges array: "'{tabName}'!A:Z"
    const ranges = dateTabs.map((name) => `${quoteSheetName(name)}!A:Z`);

    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const allRows: DataRow[] = [];
    let columns: string[] = [];

    for (const rangeData of batchResponse.data.valueRanges ?? []) {
      const values = rangeData.values ?? [];
      if (values.length === 0) continue;

      const rawHeaders = values[0] as unknown[];
      const tabColumns = rawHeaders.map((h) => String(h ?? '').trim());
      if (tabColumns.length > columns.length) columns = tabColumns;

      for (const rawRow of values.slice(1)) {
        const row = rawRow as unknown[];
        const hasContent = row.some((c) => c !== null && c !== undefined && c !== '');
        if (!hasContent) continue;

        const dataRow: DataRow = {};
        for (let i = 0; i < tabColumns.length; i++) {
          const col = tabColumns[i];
          if (!col) continue;
          dataRow[col] = (row[i] as string | number | boolean | null | undefined) ?? null;
        }
        allRows.push(dataRow);
      }
    }

    return {
      columns,
      rows: allRows,
      totalRows: allRows.length,
      fetchedAt: new Date(),
      source: this.config.name ?? spreadsheetId,
    };
  }

  // ─── Read a single tab ────────────────────────────────────────────────────

  private async readTab(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string,
    sheetName: string,
    query: ConnectorQuery,
  ): Promise<DataSet> {
    const rangeBase = query.range ?? 'A:Z';
    const fullRange = sheetName ? `${quoteSheetName(sheetName)}!${rangeBase}` : rangeBase;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: fullRange,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const values = response.data.values ?? [];

    if (values.length === 0) {
      return { columns: [], rows: [], totalRows: 0, fetchedAt: new Date(), source: this.config.name ?? spreadsheetId };
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

    let result = rows;
    if (query.offset) result = result.slice(query.offset);
    if (query.limit) result = result.slice(0, query.limit);

    return {
      columns,
      rows: result,
      totalRows: rows.length,
      fetchedAt: new Date(),
      source: this.config.name ?? spreadsheetId,
    };
  }

  // ─── Drive helpers ────────────────────────────────────────────────────────

  private async listSpreadsheets(folderId: string): Promise<string[]> {
    const drive = await this.getDrive();
    const response = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id,name)',
      orderBy: 'name',
      pageSize: 100,
    });

    const files = (response.data.files as Array<{ id: string; name: string }>) ?? [];

    // Apply fileNamePattern filter if configured
    const pattern = this.config.fileNamePattern?.trim();
    const filtered = pattern
      ? files.filter((f) => {
          try {
            return new RegExp(pattern, 'i').test(f.name);
          } catch {
            logger.warn('Invalid fileNamePattern — skipping filter', { pattern });
            return true;
          }
        })
      : files;

    if (pattern) {
      logger.info('File name filter applied', {
        pattern,
        total: files.length,
        matched: filtered.length,
        skipped: files.map((f) => f.name).filter(
          (n) => !new RegExp(pattern, 'i').test(n)
        ),
      });
    }

    return filtered.map((f) => f.id).filter(Boolean) as string[];
  }

  // ─── listSheets() ─────────────────────────────────────────────────────────

  async listSheets(): Promise<string[]> {
    const spreadsheetId = this.config.spreadsheetId;
    if (!spreadsheetId) return [];
    const sheets = await this.getSheets();
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties.title',
    });
    return (response.data.sheets ?? [])
      .map((s) => s.properties?.title ?? '')
      .filter(Boolean);
  }
}
