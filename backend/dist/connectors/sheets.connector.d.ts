import { BaseConnector, type ConnectorQuery, type DataSet, type ConnectionTestResult } from './base.connector.js';
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
    credentials: Record<string, unknown> | string;
    name?: string;
}
export declare class SheetsConnector extends BaseConnector {
    private readonly config;
    readonly tipo: "GOOGLE_SHEETS";
    private sheetsClient;
    private authClient;
    constructor(config: SheetsConnectorConfig);
    private getAuth;
    private getSheets;
    private getDrive;
    test(): Promise<ConnectionTestResult>;
    private testSpreadsheet;
    private testFolder;
    fetch(query: ConnectorQuery): Promise<DataSet>;
    private fetchFromFolder;
    private fetchFromSpreadsheet;
    private readTab;
    private listSpreadsheets;
    listSheets(): Promise<string[]>;
}
//# sourceMappingURL=sheets.connector.d.ts.map