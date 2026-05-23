export type ConnectorType = 'GOOGLE_SHEETS' | 'REST_API' | 'POSTGRESQL' | 'CSV';
export interface ConnectorQuery {
    sheetName?: string;
    range?: string;
    endpoint?: string;
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
    source: string;
}
export interface ConnectionTestResult {
    success: boolean;
    message: string;
    latencyMs?: number;
    details?: Record<string, unknown>;
}
export declare abstract class BaseConnector {
    abstract readonly tipo: ConnectorType;
    abstract test(): Promise<ConnectionTestResult>;
    abstract fetch(query: ConnectorQuery): Promise<DataSet>;
}
//# sourceMappingURL=base.connector.d.ts.map