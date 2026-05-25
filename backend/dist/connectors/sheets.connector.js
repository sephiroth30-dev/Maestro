"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SheetsConnector = void 0;
const googleapis_1 = require("googleapis");
const logger_js_1 = require("../config/logger.js");
const base_connector_js_1 = require("./base.connector.js");
// ─── V10.2 date-tab detection ─────────────────────────────────────────────────
// Mirrors isDateSheetName_() from the original Apps Script.
// Valid tab names: "2 ENERO", "15 MARZO", "ENERO 2", "2 DE ENERO", etc.
const MESES = new Set([
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]);
function stripDiacritics(s) {
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
function isConsolidatedSheetName(name) {
    return CONSOLIDATED_PATTERNS.some((p) => p.test(name));
}
function isDateSheetName(name) {
    const normalized = stripDiacritics(name)
        .toUpperCase()
        .replace(/[-_]/g, ' ')
        .replace(/\bDE\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const parts = normalized.split(' ');
    if (parts.length !== 2)
        return false;
    const [a, b] = parts;
    const aIsDay = /^\d{1,2}$/.test(a) && parseInt(a, 10) >= 1 && parseInt(a, 10) <= 31;
    const bIsDay = /^\d{1,2}$/.test(b) && parseInt(b, 10) >= 1 && parseInt(b, 10) <= 31;
    const aIsMes = MESES.has(a);
    const bIsMes = MESES.has(b);
    return (aIsDay && bIsMes) || (aIsMes && bIsDay);
}
// Wraps a sheet name in single quotes for use in a Sheets API range.
function quoteSheetName(name) {
    return `'${name.replace(/'/g, "''")}'`;
}
// ─── Implementation ───────────────────────────────────────────────────────────
class SheetsConnector extends base_connector_js_1.BaseConnector {
    config;
    tipo = 'GOOGLE_SHEETS';
    sheetsClient = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authClient = null;
    constructor(config) {
        super();
        this.config = config;
    }
    // ─── Auth ─────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getAuth() {
        if (this.authClient)
            return this.authClient;
        const credentials = typeof this.config.credentials === 'string'
            ? { keyFile: this.config.credentials }
            : { credentials: this.config.credentials };
        // Include drive.metadata.readonly when folder mode is active so the
        // service account can list files inside the folder.
        const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
        if (this.config.folderId) {
            scopes.push('https://www.googleapis.com/auth/drive.metadata.readonly');
        }
        this.authClient = new googleapis_1.google.auth.GoogleAuth({ ...credentials, scopes });
        return this.authClient;
    }
    async getSheets() {
        if (this.sheetsClient)
            return this.sheetsClient;
        const auth = await this.getAuth();
        this.sheetsClient = googleapis_1.google.sheets({ version: 'v4', auth });
        return this.sheetsClient;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getDrive() {
        const auth = await this.getAuth();
        return googleapis_1.google.drive({ version: 'v3', auth });
    }
    // ─── test() ───────────────────────────────────────────────────────────────
    async test() {
        const start = Date.now();
        try {
            if (this.config.folderId) {
                return await this.testFolder(start);
            }
            return await this.testSpreadsheet(start);
        }
        catch (err) {
            const latencyMs = Date.now() - start;
            const message = err instanceof Error ? err.message : 'Error desconocido';
            logger_js_1.logger.warn('SheetsConnector test failed', { error: message });
            return { success: false, message: `Error de conexión: ${message}`, latencyMs };
        }
    }
    async testSpreadsheet(start) {
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
        let strategy;
        if (this.config.sheetName && tabNames.includes(this.config.sheetName)) {
            strategy = `hoja explícita "${this.config.sheetName}"`;
        }
        else {
            const consolidatedTab = tabNames.find(isConsolidatedSheetName);
            if (consolidatedTab) {
                strategy = `hoja consolidada "${consolidatedTab}"`;
            }
            else {
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
    async testFolder(start) {
        const drive = await this.getDrive();
        const folderId = this.config.folderId;
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
    async fetch(query) {
        if (this.config.folderId) {
            return this.fetchFromFolder(this.config.folderId);
        }
        if (!this.config.spreadsheetId) {
            throw new Error('SheetsConnector requires spreadsheetId or folderId in config');
        }
        return this.fetchFromSpreadsheet(this.config.spreadsheetId, query);
    }
    // ─── Folder mode: discover + merge all spreadsheets ──────────────────────
    async fetchFromFolder(folderId) {
        const spreadsheetIds = await this.listSpreadsheets(folderId);
        if (spreadsheetIds.length === 0) {
            logger_js_1.logger.warn('No spreadsheets found in folder', { folderId });
            return { columns: [], rows: [], totalRows: 0, fetchedAt: new Date(), source: this.config.name ?? folderId };
        }
        logger_js_1.logger.info('Syncing spreadsheets from folder', { folderId, count: spreadsheetIds.length });
        const allRows = [];
        let columns = [];
        for (const spreadsheetId of spreadsheetIds) {
            try {
                const dataset = await this.fetchFromSpreadsheet(spreadsheetId, {});
                if (dataset.columns.length > columns.length)
                    columns = dataset.columns;
                allRows.push(...dataset.rows);
                logger_js_1.logger.info('Spreadsheet synced', { spreadsheetId, rows: dataset.totalRows });
            }
            catch (err) {
                logger_js_1.logger.warn('Skipping spreadsheet due to error', {
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
    async fetchFromSpreadsheet(spreadsheetId, query) {
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
                logger_js_1.logger.info('Reading explicit tab from config', { spreadsheetId, tab: this.config.sheetName });
                return this.readTab(sheets, spreadsheetId, this.config.sheetName, query);
            }
            // Tab not present in this spreadsheet — fall through to auto-detection
            logger_js_1.logger.info('Configured sheetName not found, auto-detecting', { spreadsheetId, sheetName: this.config.sheetName });
        }
        // ── Priority 2: consolidated annual base tab (has all records in one place) ─
        const consolidatedTab = allTabNames.find(isConsolidatedSheetName);
        if (consolidatedTab) {
            logger_js_1.logger.info('Found consolidated tab, reading it directly', { spreadsheetId, tab: consolidatedTab });
            return this.readTab(sheets, spreadsheetId, consolidatedTab, query);
        }
        // ── Priority 3: date-named tabs (V10.2 monthly spreadsheet pattern) ───────
        const dateTabs = allTabNames.filter(isDateSheetName);
        if (dateTabs.length === 0) {
            logger_js_1.logger.warn('No date-named or consolidated tabs found, using default range', { spreadsheetId, tabs: allTabNames });
            return this.readTab(sheets, spreadsheetId, '', query);
        }
        logger_js_1.logger.info('Reading date tabs', { spreadsheetId, count: dateTabs.length, tabs: dateTabs });
        // Build ranges array: "'{tabName}'!A:Z"
        const ranges = dateTabs.map((name) => `${quoteSheetName(name)}!A:Z`);
        const batchResponse = await sheets.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
            valueRenderOption: 'UNFORMATTED_VALUE',
            dateTimeRenderOption: 'FORMATTED_STRING',
        });
        const allRows = [];
        let columns = [];
        for (const rangeData of batchResponse.data.valueRanges ?? []) {
            const values = rangeData.values ?? [];
            if (values.length === 0)
                continue;
            const rawHeaders = values[0];
            const tabColumns = rawHeaders.map((h) => String(h ?? '').trim());
            if (tabColumns.length > columns.length)
                columns = tabColumns;
            for (const rawRow of values.slice(1)) {
                const row = rawRow;
                const hasContent = row.some((c) => c !== null && c !== undefined && c !== '');
                if (!hasContent)
                    continue;
                const dataRow = {};
                for (let i = 0; i < tabColumns.length; i++) {
                    const col = tabColumns[i];
                    if (!col)
                        continue;
                    dataRow[col] = row[i] ?? null;
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
    async readTab(sheets, spreadsheetId, sheetName, query) {
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
        const rawHeaders = values[0];
        const columns = rawHeaders.map((h) => String(h ?? '').trim());
        const rows = [];
        for (const rawRow of values.slice(1)) {
            const row = rawRow;
            const hasContent = row.some((c) => c !== null && c !== undefined && c !== '');
            if (!hasContent)
                continue;
            const dataRow = {};
            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                if (!col)
                    continue;
                dataRow[col] = row[i] ?? null;
            }
            rows.push(dataRow);
        }
        let result = rows;
        if (query.offset)
            result = result.slice(query.offset);
        if (query.limit)
            result = result.slice(0, query.limit);
        return {
            columns,
            rows: result,
            totalRows: rows.length,
            fetchedAt: new Date(),
            source: this.config.name ?? spreadsheetId,
        };
    }
    // ─── Drive helpers ────────────────────────────────────────────────────────
    async listSpreadsheets(folderId) {
        const drive = await this.getDrive();
        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
            fields: 'files(id,name)',
            orderBy: 'name',
            pageSize: 100,
        });
        const files = response.data.files ?? [];
        // Apply fileNamePattern filter if configured
        const pattern = this.config.fileNamePattern?.trim();
        const filtered = pattern
            ? files.filter((f) => {
                try {
                    return new RegExp(pattern, 'i').test(f.name);
                }
                catch {
                    logger_js_1.logger.warn('Invalid fileNamePattern — skipping filter', { pattern });
                    return true;
                }
            })
            : files;
        if (pattern) {
            logger_js_1.logger.info('File name filter applied', {
                pattern,
                total: files.length,
                matched: filtered.length,
                skipped: files.map((f) => f.name).filter((n) => !new RegExp(pattern, 'i').test(n)),
            });
        }
        return filtered.map((f) => f.id).filter(Boolean);
    }
    // ─── listSheets() ─────────────────────────────────────────────────────────
    async listSheets() {
        const spreadsheetId = this.config.spreadsheetId;
        if (!spreadsheetId)
            return [];
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
exports.SheetsConnector = SheetsConnector;
//# sourceMappingURL=sheets.connector.js.map