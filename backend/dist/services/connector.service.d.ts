import { z } from 'zod';
import type { Conector, TipoConector } from '@prisma/client';
import { BaseConnector, type ConnectionTestResult } from '../connectors/base.connector.js';
import { RestConnector, RestConfigSchema, type RestConnectorConfig } from '../connectors/rest.connector.js';
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
export { RestConfigSchema };
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
    instantiate(conector: Conector, opciones?: {
        efimero?: boolean;
    }): BaseConnector;
    /**
     * Un conector REST con la MISMA credencial y el MISMO token que el original,
     * pero apuntando a otro endpoint (citas, convenios).
     *
     * Comparte el almacén de token a propósito: Medifolios emite un solo token
     * vigente por usuario, así que dos sesiones con la misma credencial se
     * invalidarían entre sí (es lo que causó los 401 de la sincronización). Quien lo
     * use debe además tomar el candado de sincronización del conector.
     */
    instantiateRestConCambios(conector: Conector, cambios: Partial<RestConnectorConfig>): RestConnector;
    testConnection(conectorOrDto: Conector | CreateConnectorDto): Promise<ConnectionTestResult>;
    listSheets(conectorId: string): Promise<string[]>;
}
export declare const connectorService: ConnectorService;
//# sourceMappingURL=connector.service.d.ts.map