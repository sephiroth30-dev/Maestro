import { z } from 'zod';
import type { Conector, TipoConector } from '@prisma/client';
import { BaseConnector, type ConnectionTestResult } from '../connectors/base.connector.js';
export declare const SheetsConfigSchema: z.ZodEffects<z.ZodObject<{
    spreadsheetId: z.ZodOptional<z.ZodString>;
    folderId: z.ZodOptional<z.ZodString>;
    fileNamePattern: z.ZodOptional<z.ZodString>;
    credentials: z.ZodUnion<[z.ZodObject<{
        type: z.ZodOptional<z.ZodString>;
        project_id: z.ZodOptional<z.ZodString>;
        private_key_id: z.ZodOptional<z.ZodString>;
        private_key: z.ZodOptional<z.ZodString>;
        client_email: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        auth_uri: z.ZodOptional<z.ZodString>;
        token_uri: z.ZodOptional<z.ZodString>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        type: z.ZodOptional<z.ZodString>;
        project_id: z.ZodOptional<z.ZodString>;
        private_key_id: z.ZodOptional<z.ZodString>;
        private_key: z.ZodOptional<z.ZodString>;
        client_email: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        auth_uri: z.ZodOptional<z.ZodString>;
        token_uri: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        type: z.ZodOptional<z.ZodString>;
        project_id: z.ZodOptional<z.ZodString>;
        private_key_id: z.ZodOptional<z.ZodString>;
        private_key: z.ZodOptional<z.ZodString>;
        client_email: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        auth_uri: z.ZodOptional<z.ZodString>;
        token_uri: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">>, z.ZodString]>;
}, "strip", z.ZodTypeAny, {
    credentials: string | z.objectOutputType<{
        type: z.ZodOptional<z.ZodString>;
        project_id: z.ZodOptional<z.ZodString>;
        private_key_id: z.ZodOptional<z.ZodString>;
        private_key: z.ZodOptional<z.ZodString>;
        client_email: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        auth_uri: z.ZodOptional<z.ZodString>;
        token_uri: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">;
    spreadsheetId?: string | undefined;
    folderId?: string | undefined;
    fileNamePattern?: string | undefined;
}, {
    credentials: string | z.objectInputType<{
        type: z.ZodOptional<z.ZodString>;
        project_id: z.ZodOptional<z.ZodString>;
        private_key_id: z.ZodOptional<z.ZodString>;
        private_key: z.ZodOptional<z.ZodString>;
        client_email: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        auth_uri: z.ZodOptional<z.ZodString>;
        token_uri: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">;
    spreadsheetId?: string | undefined;
    folderId?: string | undefined;
    fileNamePattern?: string | undefined;
}>, {
    credentials: string | z.objectOutputType<{
        type: z.ZodOptional<z.ZodString>;
        project_id: z.ZodOptional<z.ZodString>;
        private_key_id: z.ZodOptional<z.ZodString>;
        private_key: z.ZodOptional<z.ZodString>;
        client_email: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        auth_uri: z.ZodOptional<z.ZodString>;
        token_uri: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">;
    spreadsheetId?: string | undefined;
    folderId?: string | undefined;
    fileNamePattern?: string | undefined;
}, {
    credentials: string | z.objectInputType<{
        type: z.ZodOptional<z.ZodString>;
        project_id: z.ZodOptional<z.ZodString>;
        private_key_id: z.ZodOptional<z.ZodString>;
        private_key: z.ZodOptional<z.ZodString>;
        client_email: z.ZodOptional<z.ZodString>;
        client_id: z.ZodOptional<z.ZodString>;
        auth_uri: z.ZodOptional<z.ZodString>;
        token_uri: z.ZodOptional<z.ZodString>;
    }, z.ZodTypeAny, "passthrough">;
    spreadsheetId?: string | undefined;
    folderId?: string | undefined;
    fileNamePattern?: string | undefined;
}>;
export declare const RestConfigSchema: z.ZodEffects<z.ZodObject<{
    baseUrl: z.ZodString;
    /** Ruta relativa a baseUrl. Sin ella se pide la raíz, que rara vez sirve. */
    endpoint: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    authType: z.ZodOptional<z.ZodEnum<["none", "bearer", "basic", "apiKeyHeader"]>>;
    authValue: z.ZodOptional<z.ZodString>;
    authHeaderName: z.ZodOptional<z.ZodString>;
    /** Campo canónico -> campo tal como llega del origen. */
    fieldMap: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    dataPath: z.ZodOptional<z.ZodString>;
    timeoutSec: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}>, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}>;
export declare const FrecuenciaSyncSchema: z.ZodEnum<["30min", "1h", "4h", "daily", "manual"]>;
export interface CreateConnectorDto {
    nombre: string;
    tipo: TipoConector;
    config: Record<string, unknown>;
    frecuenciaSync?: string;
}
export interface UpdateConnectorDto {
    nombre?: string;
    config?: Record<string, unknown>;
    activo?: boolean;
    frecuenciaSync?: string;
}
export declare class ConnectorService {
    private validateConfig;
    private static readonly MASCARA;
    /** Claves cuyo contenido nunca debe salir del servidor. */
    private static readonly CLAVES_SECRETAS;
    private maskConfig;
    /** Repone los valores reales donde el cliente devolvió la máscara. */
    private preservarSecretos;
    /**
     * Versión del conector apta para enviar al navegador.
     *
     * Antes `GET /connectors` devolvía el `config` íntegro —con la clave privada
     * de Google y el token de la API— a cualquier sesión de administrador. El
     * frontend solo necesita saber SI hay credencial, no cuál es.
     */
    publicView(conector: Conector): Conector;
    create(data: CreateConnectorDto): Promise<Conector>;
    list(): Promise<Conector[]>;
    getById(id: string): Promise<Conector>;
    update(id: string, data: UpdateConnectorDto): Promise<Conector>;
    delete(id: string): Promise<void>;
    instantiate(conector: Conector): BaseConnector;
    testConnection(conectorOrDto: Conector | CreateConnectorDto): Promise<ConnectionTestResult>;
    listSheets(conectorId: string): Promise<string[]>;
}
export declare const connectorService: ConnectorService;
//# sourceMappingURL=connector.service.d.ts.map