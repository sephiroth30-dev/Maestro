import { BaseConnector, type ConnectorQuery, type DataSet, type ConnectionTestResult } from './base.connector.js';
export interface RestConnectorConfig {
    baseUrl: string;
    /** Ruta que se cuelga de baseUrl, p. ej. 'facturacion/atenciones'. */
    endpoint?: string;
    /** Parámetros fijos de consulta, p. ej. { desde: '2026-01-01' }. */
    params?: Record<string, string>;
    headers?: Record<string, string>;
    /**
     * `apiKeyHeader` cubre las APIs que autentican con una cabecera propia en vez
     * de `Authorization` — como Medifolios, que usa `X-Auth-Token`.
     */
    authType?: 'none' | 'bearer' | 'basic' | 'apiKeyHeader';
    authValue?: string;
    /** Nombre de la cabecera cuando authType es apiKeyHeader. */
    authHeaderName?: string;
    /**
     * Traduce los nombres de campo del origen a los que el mapeador reconoce.
     * Clave = campo canónico, valor = campo tal como viene en la respuesta.
     *
     * Hace falta porque el mapeador detecta columnas con expresiones regulares
     * pensadas para hojas en español, y fallan con nombres tipo `valor_total`
     * (`\b` no coincide antes de `_`) o `montoFacturado`.
     */
    fieldMap?: Record<string, string>;
    /** Segundos. Por defecto 10; el histórico completo suele necesitar más. */
    timeoutSec?: number;
    /** Ruta dentro del JSON donde vive el arreglo, p. ej. 'resultado.items'. */
    dataPath?: string;
    name?: string;
}
/**
 * Campos que el mapeador de atenciones sabe reconocer. `fieldMap` traduce a
 * estos nombres exactos, elegidos para caer siempre dentro de los patrones de
 * `sheet-atencion-mapper.ts`.
 */
export declare const CAMPOS_CANONICOS: readonly ["fecha", "descripcion", "autorizacion", "entidad", "profesional", "valor", "paciente", "documento"];
export declare class RestConnector extends BaseConnector {
    private readonly config;
    readonly tipo: "REST_API";
    constructor(config: RestConnectorConfig);
    private timeoutMs;
    private buildHeaders;
    private fetchWithTimeout;
    test(): Promise<ConnectionTestResult>;
    /** La ruta y los parámetros salen de la configuración; la consulta puede
     *  añadir o sobrescribir. */
    private buildUrl;
    /**
     * Localiza el arreglo de registros dentro de la respuesta.
     *
     * Con `dataPath` se navega la ruta indicada ('resultado.items'); sin él se
     * prueban las envolturas habituales. Devolver el objeto entero envuelto es el
     * último recurso: es lo que provoca que el mapeador vea una sola fila sin
     * columnas reconocibles y aborte sin insertar nada.
     */
    private extraerArreglo;
    /**
     * Renombra los campos del origen a los nombres canónicos que el mapeador
     * reconoce. Los campos no mapeados se conservan tal cual: no estorban y
     * ayudan a diagnosticar desde el diagnóstico de columnas.
     */
    private traducir;
    fetch(query: ConnectorQuery): Promise<DataSet>;
}
//# sourceMappingURL=rest.connector.d.ts.map