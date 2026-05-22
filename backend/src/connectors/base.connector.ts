// ─── Connector Types ──────────────────────────────────────────────────────────

export type ConnectorType = 'GOOGLE_SHEETS' | 'REST_API' | 'POSTGRESQL' | 'CSV';

export interface ConnectorQuery {
  sheetName?: string;       // for Sheets
  range?: string;           // for Sheets: "A1:Z1000"
  endpoint?: string;        // for REST API
  params?: Record<string, string>;
  limit?: number;
  offset?: number;
}

export interface DataRow {
  [key: string]: string | number | boolean | null;
}

export interface DataSet {
  columns: string[];
  rows: DataRow[];
  totalRows: number;
  fetchedAt: Date;
  source: string; // connector name
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

// ─── Abstract Base ────────────────────────────────────────────────────────────

export abstract class BaseConnector {
  abstract readonly tipo: ConnectorType;
  abstract test(): Promise<ConnectionTestResult>;
  abstract fetch(query: ConnectorQuery): Promise<DataSet>;
}
