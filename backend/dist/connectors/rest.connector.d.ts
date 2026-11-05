import { z } from 'zod';
import { BaseConnector, type ConnectorQuery, type DataSet, type ConnectionTestResult } from './base.connector.js';
/**
 * Esquema y tipo viven juntos a propósito.
 *
 * Antes el tipo estaba aquí y el esquema de validación en `connector.service.ts`:
 * dos definiciones de la misma forma, que divergieron sin que nadie lo notara.
 * El resultado fue que `instantiate()` dejó de pasar la mitad de los campos al
 * conector — se guardaban en la base y no llegaban nunca a la sincronización.
 * Derivando el tipo del esquema con `z.infer`, un campo nuevo no puede quedarse
 * fuera de uno de los dos.
 */
export declare const RestConfigSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    baseUrl: z.ZodString;
    /** Ruta relativa a baseUrl. Sin ella se pide la raíz, que rara vez sirve. */
    endpoint: z.ZodOptional<z.ZodString>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    /**
     * - `apiKeyHeader`: cabecera propia con un valor fijo.
     * - `login`: la API no acepta un token fijo, hay que pedirlo con usuario y
     *   contraseña y reenviarlo después. Es el caso de Medifolios.
     */
    authType: z.ZodOptional<z.ZodEnum<["none", "bearer", "basic", "apiKeyHeader", "login"]>>;
    authValue: z.ZodOptional<z.ZodString>;
    /** Nombre de la cabecera cuando authType es apiKeyHeader. */
    authHeaderName: z.ZodOptional<z.ZodString>;
    /** Base del login si difiere de baseUrl. Por omisión, la misma. */
    loginBaseUrl: z.ZodOptional<z.ZodString>;
    /** Ruta del login relativa a su base, p. ej. 'auth'. */
    loginEndpoint: z.ZodOptional<z.ZodString>;
    /** Medifolios exige form-urlencoded; otras APIs usan JSON. */
    loginBodyFormat: z.ZodOptional<z.ZodEnum<["form", "json"]>>;
    loginUsuario: z.ZodOptional<z.ZodString>;
    /**
     * Se llama `password` a propósito: esa clave exacta ya está en la lista de
     * secretos que `connector.service.ts` enmascara al leer y repone al guardar.
     */
    password: z.ZodOptional<z.ZodString>;
    /** Campos fijos extra del cuerpo del login, p. ej. { token_authenticator: '' }. */
    loginBodyExtra: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    /** Ruta del token dentro de la respuesta del login, p. ej. 'data.token'. */
    loginTokenPath: z.ZodOptional<z.ZodString>;
    /** Dónde viaja el token en las llamadas siguientes. */
    tokenPlacement: z.ZodOptional<z.ZodEnum<["header", "queryParam", "both"]>>;
    /** Nombre de la cabecera o del parámetro, según tokenPlacement. */
    tokenParamName: z.ZodOptional<z.ZodString>;
    /** Nombre de la cabecera cuando tokenPlacement es 'both'. */
    tokenHeaderName: z.ZodOptional<z.ZodString>;
    /**
     * Códigos que se interpretan como "el token ya no sirve" y disparan un
     * relogin. Configurable porque no todas las APIs devuelven 401: las que
     * corren sobre CodeIgniter responden a veces 200 con el error en el cuerpo.
     */
    loginRetryStatuses: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    /**
     * Activa el recorrido de páginas. Sin esto el conector trae solo la primera
     * y el resto se pierde **sin ningún error**, que para facturación es el peor
     * fallo posible: el total sale bajo y nada lo delata.
     */
    paginar: z.ZodOptional<z.ZodBoolean>;
    /** Nombre del parámetro de página. */
    paginaParam: z.ZodOptional<z.ZodString>;
    /** Nombre del parámetro de tamaño de página. */
    limiteParam: z.ZodOptional<z.ZodString>;
    /** Registros por página. */
    limite: z.ZodOptional<z.ZodNumber>;
    /** Número de la primera página: 1 en casi todas las APIs, 0 en algunas. */
    paginaInicial: z.ZodOptional<z.ZodNumber>;
    /** Ruta al total de páginas en la respuesta, p. ej. 'totalPaginas'. */
    totalPaginasPath: z.ZodOptional<z.ZodString>;
    /**
     * Tope de páginas. Al alcanzarlo se falla con un error explícito en vez de
     * devolver un conjunto incompleto que parecería correcto.
     */
    maxPaginas: z.ZodOptional<z.ZodNumber>;
    /**
     * Traduce los nombres de campo del origen a los que el mapeador reconoce.
     * Clave = campo canónico, valor = campo tal como viene en la respuesta.
     *
     * Hace falta porque el mapeador detecta columnas con expresiones regulares
     * pensadas para hojas en español, y fallan con nombres tipo `valor_total`
     * (`\b` no coincide antes de `_`) o `montoFacturado`.
     */
    fieldMap: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    dataPath: z.ZodOptional<z.ZodString>;
    /** Segundos. Por defecto 10; el histórico completo suele necesitar más. */
    timeoutSec: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    password?: string | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | "login" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    loginBaseUrl?: string | undefined;
    loginEndpoint?: string | undefined;
    loginBodyFormat?: "json" | "form" | undefined;
    loginUsuario?: string | undefined;
    loginBodyExtra?: Record<string, string> | undefined;
    loginTokenPath?: string | undefined;
    tokenPlacement?: "both" | "header" | "queryParam" | undefined;
    tokenParamName?: string | undefined;
    tokenHeaderName?: string | undefined;
    loginRetryStatuses?: number[] | undefined;
    paginar?: boolean | undefined;
    paginaParam?: string | undefined;
    limiteParam?: string | undefined;
    limite?: number | undefined;
    paginaInicial?: number | undefined;
    totalPaginasPath?: string | undefined;
    maxPaginas?: number | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    password?: string | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | "login" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    loginBaseUrl?: string | undefined;
    loginEndpoint?: string | undefined;
    loginBodyFormat?: "json" | "form" | undefined;
    loginUsuario?: string | undefined;
    loginBodyExtra?: Record<string, string> | undefined;
    loginTokenPath?: string | undefined;
    tokenPlacement?: "both" | "header" | "queryParam" | undefined;
    tokenParamName?: string | undefined;
    tokenHeaderName?: string | undefined;
    loginRetryStatuses?: number[] | undefined;
    paginar?: boolean | undefined;
    paginaParam?: string | undefined;
    limiteParam?: string | undefined;
    limite?: number | undefined;
    paginaInicial?: number | undefined;
    totalPaginasPath?: string | undefined;
    maxPaginas?: number | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}>, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    password?: string | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | "login" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    loginBaseUrl?: string | undefined;
    loginEndpoint?: string | undefined;
    loginBodyFormat?: "json" | "form" | undefined;
    loginUsuario?: string | undefined;
    loginBodyExtra?: Record<string, string> | undefined;
    loginTokenPath?: string | undefined;
    tokenPlacement?: "both" | "header" | "queryParam" | undefined;
    tokenParamName?: string | undefined;
    tokenHeaderName?: string | undefined;
    loginRetryStatuses?: number[] | undefined;
    paginar?: boolean | undefined;
    paginaParam?: string | undefined;
    limiteParam?: string | undefined;
    limite?: number | undefined;
    paginaInicial?: number | undefined;
    totalPaginasPath?: string | undefined;
    maxPaginas?: number | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    password?: string | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | "login" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    loginBaseUrl?: string | undefined;
    loginEndpoint?: string | undefined;
    loginBodyFormat?: "json" | "form" | undefined;
    loginUsuario?: string | undefined;
    loginBodyExtra?: Record<string, string> | undefined;
    loginTokenPath?: string | undefined;
    tokenPlacement?: "both" | "header" | "queryParam" | undefined;
    tokenParamName?: string | undefined;
    tokenHeaderName?: string | undefined;
    loginRetryStatuses?: number[] | undefined;
    paginar?: boolean | undefined;
    paginaParam?: string | undefined;
    limiteParam?: string | undefined;
    limite?: number | undefined;
    paginaInicial?: number | undefined;
    totalPaginasPath?: string | undefined;
    maxPaginas?: number | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}>, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    password?: string | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | "login" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    loginBaseUrl?: string | undefined;
    loginEndpoint?: string | undefined;
    loginBodyFormat?: "json" | "form" | undefined;
    loginUsuario?: string | undefined;
    loginBodyExtra?: Record<string, string> | undefined;
    loginTokenPath?: string | undefined;
    tokenPlacement?: "both" | "header" | "queryParam" | undefined;
    tokenParamName?: string | undefined;
    tokenHeaderName?: string | undefined;
    loginRetryStatuses?: number[] | undefined;
    paginar?: boolean | undefined;
    paginaParam?: string | undefined;
    limiteParam?: string | undefined;
    limite?: number | undefined;
    paginaInicial?: number | undefined;
    totalPaginasPath?: string | undefined;
    maxPaginas?: number | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}, {
    baseUrl: string;
    params?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    password?: string | undefined;
    endpoint?: string | undefined;
    authType?: "none" | "bearer" | "basic" | "apiKeyHeader" | "login" | undefined;
    authValue?: string | undefined;
    authHeaderName?: string | undefined;
    loginBaseUrl?: string | undefined;
    loginEndpoint?: string | undefined;
    loginBodyFormat?: "json" | "form" | undefined;
    loginUsuario?: string | undefined;
    loginBodyExtra?: Record<string, string> | undefined;
    loginTokenPath?: string | undefined;
    tokenPlacement?: "both" | "header" | "queryParam" | undefined;
    tokenParamName?: string | undefined;
    tokenHeaderName?: string | undefined;
    loginRetryStatuses?: number[] | undefined;
    paginar?: boolean | undefined;
    paginaParam?: string | undefined;
    limiteParam?: string | undefined;
    limite?: number | undefined;
    paginaInicial?: number | undefined;
    totalPaginasPath?: string | undefined;
    maxPaginas?: number | undefined;
    fieldMap?: Record<string, string> | undefined;
    dataPath?: string | undefined;
    timeoutSec?: number | undefined;
}>;
export type RestConnectorConfig = z.infer<typeof RestConfigSchema> & {
    name?: string;
};
/**
 * Guarda el token de sesión fuera del conector.
 *
 * La instancia del conector se reconstruye en cada sincronización, así que un
 * campo de instancia obligaría a un login por corrida. El almacén lo provee
 * `connector.service.ts`, con una entrada por conector.
 */
export interface TokenSessionStore {
    getToken(): string | undefined;
    setToken(token: string): void;
    clearToken(): void;
}
/**
 * Campos que el mapeador de atenciones sabe reconocer. `fieldMap` traduce a
 * estos nombres exactos, elegidos para caer siempre dentro de los patrones de
 * `sheet-atencion-mapper.ts`.
 */
export declare const CAMPOS_CANONICOS: readonly ["fecha", "descripcion", "autorizacion", "entidad", "profesional", "valor", "paciente", "documento"];
export declare class RestConnector extends BaseConnector {
    private readonly config;
    private readonly session?;
    readonly tipo: "REST_API";
    /** Token de la sesión en curso. Se siembra del almacén compartido. */
    private cachedToken?;
    constructor(config: RestConnectorConfig, session?: TokenSessionStore | undefined);
    private timeoutMs;
    private usaLogin;
    private buildHeaders;
    /** `both` manda el token por los dos caminos, como los clientes de referencia
     *  de Medifolios, para no depender de cuál espera cada endpoint. */
    private tokenEnCabecera;
    private tokenEnQueryParam;
    private nombreCabeceraToken;
    private fetchWithTimeout;
    /**
     * Pide un token con usuario y contraseña.
     *
     * No reutiliza `buildHeaders()` porque el cuerpo del login puede ser
     * form-urlencoded, y porque mandar el token viejo en el propio login no tiene
     * sentido.
     */
    private login;
    /** Garantiza que haya un token disponible. Con `forzar`, pide uno nuevo. */
    private ensureToken;
    test(): Promise<ConnectionTestResult>;
    /** La ruta y los parámetros salen de la configuración; la consulta puede
     *  añadir o sobrescribir. */
    private buildUrl;
    /** Oculta el token cuando la URL va a un log o a la interfaz. */
    private urlSinToken;
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
    /**
     * Recorre las páginas hasta agotarlas.
     *
     * Se corta por tres vías, en orden: el total de páginas que informe la
     * respuesta, una página vacía (para las APIs que no informan el total), y el
     * tope de seguridad. El tope **lanza error** en vez de devolver lo acumulado:
     * un conjunto incompleto de facturación se ve igual de sano que uno completo,
     * y nadie notaría que falta medio año.
     */
    private traerTodasLasPaginas;
    /**
     * Una petición, con un solo reintento: si el token caducó, se pide otro y se
     * repite. No hay forma de saber de antemano cuánto dura —la API no lo
     * expone—, así que reaccionar al rechazo es la única estrategia posible.
     */
    private pedirJson;
    private armarDataSet;
}
//# sourceMappingURL=rest.connector.d.ts.map