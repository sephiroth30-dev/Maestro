import { BaseConnector, type ConnectorQuery, type DataSet, type ConnectionTestResult } from './base.connector.js';
export interface RestConnectorConfig {
    baseUrl: string;
    headers?: Record<string, string>;
    authType?: 'none' | 'bearer' | 'basic';
    authValue?: string;
    name?: string;
}
export declare class RestConnector extends BaseConnector {
    private readonly config;
    readonly tipo: "REST_API";
    constructor(config: RestConnectorConfig);
    private buildHeaders;
    private fetchWithTimeout;
    test(): Promise<ConnectionTestResult>;
    fetch(query: ConnectorQuery): Promise<DataSet>;
}
//# sourceMappingURL=rest.connector.d.ts.map