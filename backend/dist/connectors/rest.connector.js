"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestConnector = exports.CAMPOS_CANONICOS = exports.RestConfigSchema = void 0;
const zod_1 = require("zod");
const logger_js_1 = require("../config/logger.js");
const base_connector_js_1 = require("./base.connector.js");
// ─── Config ───────────────────────────────────────────────────────────────────
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
exports.RestConfigSchema = zod_1.z
    .object({
    baseUrl: zod_1.z.string().url('baseUrl debe ser una URL válida'),
    /** Ruta relativa a baseUrl. Sin ella se pide la raíz, que rara vez sirve. */
    endpoint: zod_1.z.string().optional(),
    params: zod_1.z.record(zod_1.z.string()).optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    /**
     * - `apiKeyHeader`: cabecera propia con un valor fijo.
     * - `login`: la API no acepta un token fijo, hay que pedirlo con usuario y
     *   contraseña y reenviarlo después. Es el caso de Medifolios.
     */
    authType: zod_1.z.enum(['none', 'bearer', 'basic', 'apiKeyHeader', 'login']).optional(),
    authValue: zod_1.z.string().optional(),
    /** Nombre de la cabecera cuando authType es apiKeyHeader. */
    authHeaderName: zod_1.z.string().optional(),
    // ── Autenticación por login ──
    /** Base del login si difiere de baseUrl. Por omisión, la misma. */
    loginBaseUrl: zod_1.z.string().url().optional(),
    /** Ruta del login relativa a su base, p. ej. 'auth'. */
    loginEndpoint: zod_1.z.string().optional(),
    /** Medifolios exige form-urlencoded; otras APIs usan JSON. */
    loginBodyFormat: zod_1.z.enum(['form', 'json']).optional(),
    loginUsuario: zod_1.z.string().optional(),
    /**
     * Se llama `password` a propósito: esa clave exacta ya está en la lista de
     * secretos que `connector.service.ts` enmascara al leer y repone al guardar.
     */
    password: zod_1.z.string().optional(),
    /** Campos fijos extra del cuerpo del login, p. ej. { token_authenticator: '' }. */
    loginBodyExtra: zod_1.z.record(zod_1.z.string()).optional(),
    /** Ruta del token dentro de la respuesta del login, p. ej. 'data.token'. */
    loginTokenPath: zod_1.z.string().optional(),
    /** Dónde viaja el token en las llamadas siguientes. */
    tokenPlacement: zod_1.z.enum(['header', 'queryParam']).optional(),
    /** Nombre de la cabecera o del parámetro, según tokenPlacement. */
    tokenParamName: zod_1.z.string().optional(),
    /**
     * Códigos que se interpretan como "el token ya no sirve" y disparan un
     * relogin. Configurable porque no todas las APIs devuelven 401: las que
     * corren sobre CodeIgniter responden a veces 200 con el error en el cuerpo.
     */
    loginRetryStatuses: zod_1.z.array(zod_1.z.number().int()).optional(),
    /**
     * Traduce los nombres de campo del origen a los que el mapeador reconoce.
     * Clave = campo canónico, valor = campo tal como viene en la respuesta.
     *
     * Hace falta porque el mapeador detecta columnas con expresiones regulares
     * pensadas para hojas en español, y fallan con nombres tipo `valor_total`
     * (`\b` no coincide antes de `_`) o `montoFacturado`.
     */
    fieldMap: zod_1.z.record(zod_1.z.string()).optional(),
    dataPath: zod_1.z.string().optional(),
    /** Segundos. Por defecto 10; el histórico completo suele necesitar más. */
    timeoutSec: zod_1.z.number().int().min(1).max(300).optional(),
})
    .refine((d) => d.authType !== 'apiKeyHeader' || Boolean(d.authHeaderName), {
    message: 'Con autenticación por cabecera hay que indicar el nombre de la cabecera',
    path: ['authHeaderName'],
})
    .refine((d) => d.authType !== 'login' ||
    Boolean(d.loginEndpoint && d.loginUsuario && d.password &&
        d.loginBodyFormat && d.loginTokenPath && d.tokenPlacement), {
    message: 'Con autenticación por login hacen falta: ruta del login, usuario, contraseña, '
        + 'formato del cuerpo, ruta del token en la respuesta y dónde enviarlo',
    path: ['loginEndpoint'],
});
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_STATUSES = [401, 403];
/**
 * Campos que el mapeador de atenciones sabe reconocer. `fieldMap` traduce a
 * estos nombres exactos, elegidos para caer siempre dentro de los patrones de
 * `sheet-atencion-mapper.ts`.
 */
exports.CAMPOS_CANONICOS = [
    'fecha',
    'descripcion',
    'autorizacion',
    'entidad',
    'profesional',
    'valor',
    'paciente',
    'documento',
];
/** Navega un JSON por una ruta con puntos ('data.token'). */
function navegarPorPuntos(json, ruta) {
    let nodo = json;
    for (const parte of ruta.split('.')) {
        if (nodo === null || typeof nodo !== 'object')
            return undefined;
        nodo = nodo[parte];
    }
    return nodo;
}
// ─── Implementation ───────────────────────────────────────────────────────────
class RestConnector extends base_connector_js_1.BaseConnector {
    config;
    session;
    tipo = 'REST_API';
    /** Token de la sesión en curso. Se siembra del almacén compartido. */
    cachedToken;
    constructor(config, session) {
        super();
        this.config = config;
        this.session = session;
    }
    timeoutMs() {
        const s = this.config.timeoutSec;
        // Tope de 5 minutos: por encima el cron se solaparía con la corrida siguiente.
        return s && s > 0 ? Math.min(s, 300) * 1000 : DEFAULT_TIMEOUT_MS;
    }
    usaLogin() {
        return this.config.authType === 'login';
    }
    // ─── Build headers ────────────────────────────────────────────────────────
    buildHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(this.config.headers ?? {}),
        };
        if (this.config.authType === 'bearer' && this.config.authValue) {
            headers['Authorization'] = `Bearer ${this.config.authValue}`;
        }
        else if (this.config.authType === 'basic' && this.config.authValue) {
            headers['Authorization'] = `Basic ${this.config.authValue}`;
        }
        else if (this.config.authType === 'apiKeyHeader' && this.config.authValue) {
            headers[this.config.authHeaderName || 'X-Auth-Token'] = this.config.authValue;
        }
        else if (this.usaLogin() && this.config.tokenPlacement === 'header' && this.cachedToken) {
            headers[this.config.tokenParamName || 'X-Auth-Token'] = this.cachedToken;
        }
        return headers;
    }
    // ─── Fetch with timeout ───────────────────────────────────────────────────
    async fetchWithTimeout(url, options = {}, headers) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs());
        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: headers ?? this.buildHeaders(),
            });
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    // ─── Login ────────────────────────────────────────────────────────────────
    /**
     * Pide un token con usuario y contraseña.
     *
     * No reutiliza `buildHeaders()` porque el cuerpo del login puede ser
     * form-urlencoded, y porque mandar el token viejo en el propio login no tiene
     * sentido.
     */
    async login() {
        const base = (this.config.loginBaseUrl ?? this.config.baseUrl).replace(/\/$/, '');
        const ruta = (this.config.loginEndpoint ?? '').replace(/^\//, '');
        const url = `${base}/${ruta}`;
        const campos = {
            usuario: this.config.loginUsuario ?? '',
            password: this.config.password ?? '',
            ...(this.config.loginBodyExtra ?? {}),
        };
        const esForm = this.config.loginBodyFormat === 'form';
        const body = esForm
            ? new URLSearchParams(campos).toString()
            : JSON.stringify(campos);
        const response = await this.fetchWithTimeout(url, { method: 'POST', body }, {
            'Content-Type': esForm
                ? 'application/x-www-form-urlencoded'
                : 'application/json',
            Accept: 'application/json',
        });
        if (!response.ok) {
            throw new Error(`Login falló: HTTP ${response.status} ${response.statusText}`);
        }
        const json = (await response.json());
        const token = navegarPorPuntos(json, this.config.loginTokenPath ?? '');
        if (typeof token !== 'string' || token.length === 0) {
            // Las claves de primer nivel ayudan a corregir `loginTokenPath` sin
            // exponer el contenido de la respuesta en el log.
            const claves = json !== null && typeof json === 'object' ? Object.keys(json).join(', ') : typeof json;
            throw new Error(`El login respondió correctamente pero no se encontró un token en `
                + `"${this.config.loginTokenPath}". Claves recibidas: ${claves}`);
        }
        logger_js_1.logger.info('RestConnector: login correcto', { url, source: this.config.name });
        return token;
    }
    /** Garantiza que haya un token disponible. Con `forzar`, pide uno nuevo. */
    async ensureToken(forzar) {
        if (!this.usaLogin())
            return;
        if (!forzar) {
            const guardado = this.session?.getToken();
            if (guardado) {
                this.cachedToken = guardado;
                return;
            }
            if (this.cachedToken)
                return;
        }
        this.cachedToken = await this.login();
        this.session?.setToken(this.cachedToken);
    }
    // ─── test() ───────────────────────────────────────────────────────────────
    async test() {
        const start = Date.now();
        try {
            // Con login, la prueba empieza por autenticarse: es el punto que más
            // falla, y hay que distinguirlo de un endpoint inexistente.
            await this.ensureToken(false);
        }
        catch (err) {
            return {
                success: false,
                message: err instanceof Error ? err.message : 'Error de autenticación',
                latencyMs: Date.now() - start,
            };
        }
        // Se prueba la ruta REAL que usará la sincronización: comprobar solo la URL
        // base daría verde aunque el endpoint no exista o no autorice.
        const url = this.buildUrl({});
        try {
            const response = await this.fetchWithTimeout(url);
            const latencyMs = Date.now() - start;
            if (!response.ok) {
                return {
                    success: false,
                    message: `HTTP ${response.status}: ${response.statusText}`,
                    latencyMs,
                    details: { status: response.status },
                };
            }
            return {
                success: true,
                message: `Conectado (HTTP ${response.status})`,
                latencyMs,
                details: { status: response.status, url: this.urlSinToken(url) },
            };
        }
        catch (err) {
            const latencyMs = Date.now() - start;
            const isTimeout = err instanceof Error && err.name === 'AbortError';
            const message = isTimeout
                ? `Timeout después de ${this.timeoutMs() / 1000} segundos`
                : err instanceof Error
                    ? err.message
                    : 'Error de conexión';
            logger_js_1.logger.warn('RestConnector test failed', { url: this.urlSinToken(url), error: message });
            return { success: false, message, latencyMs };
        }
    }
    // ─── fetch() ─────────────────────────────────────────────────────────────
    /** La ruta y los parámetros salen de la configuración; la consulta puede
     *  añadir o sobrescribir. */
    buildUrl(query) {
        const base = this.config.baseUrl.replace(/\/$/, '');
        const ruta = query.endpoint ?? this.config.endpoint ?? '';
        const endpoint = ruta ? `/${ruta.replace(/^\//, '')}` : '';
        const searchParams = new URLSearchParams({
            ...(this.config.params ?? {}),
            ...(query.params ?? {}),
        });
        if (query.limit)
            searchParams.set('limit', String(query.limit));
        if (query.offset)
            searchParams.set('offset', String(query.offset));
        // Medifolios espera el token aquí, no en una cabecera.
        if (this.usaLogin() && this.config.tokenPlacement === 'queryParam' && this.cachedToken) {
            searchParams.set(this.config.tokenParamName || 'token', this.cachedToken);
        }
        const qs = searchParams.toString();
        return qs ? `${base}${endpoint}?${qs}` : `${base}${endpoint}`;
    }
    /** Oculta el token cuando la URL va a un log o a la interfaz. */
    urlSinToken(url) {
        if (!this.usaLogin() || this.config.tokenPlacement !== 'queryParam')
            return url;
        const nombre = this.config.tokenParamName || 'token';
        return url.replace(new RegExp(`([?&]${nombre}=)[^&]*`), '$1[REDACTED]');
    }
    /**
     * Localiza el arreglo de registros dentro de la respuesta.
     *
     * Con `dataPath` se navega la ruta indicada ('resultado.items'); sin él se
     * prueban las envolturas habituales. Devolver el objeto entero envuelto es el
     * último recurso: es lo que provoca que el mapeador vea una sola fila sin
     * columnas reconocibles y aborte sin insertar nada.
     */
    extraerArreglo(json) {
        if (this.config.dataPath) {
            const nodo = navegarPorPuntos(json, this.config.dataPath);
            if (Array.isArray(nodo))
                return nodo;
            logger_js_1.logger.warn('RestConnector: dataPath no apunta a un arreglo', {
                dataPath: this.config.dataPath,
            });
        }
        if (Array.isArray(json))
            return json;
        if (json !== null && typeof json === 'object') {
            const obj = json;
            for (const clave of ['data', 'datos', 'items', 'results', 'resultado', 'registros']) {
                if (Array.isArray(obj[clave]))
                    return obj[clave];
            }
        }
        return [json];
    }
    /**
     * Renombra los campos del origen a los nombres canónicos que el mapeador
     * reconoce. Los campos no mapeados se conservan tal cual: no estorban y
     * ayudan a diagnosticar desde el diagnóstico de columnas.
     */
    traducir(row) {
        const mapa = this.config.fieldMap;
        if (!mapa || Object.keys(mapa).length === 0)
            return row;
        const salida = { ...row };
        for (const [canonico, origen] of Object.entries(mapa)) {
            if (!origen || !(origen in row))
                continue;
            salida[canonico] = row[origen];
        }
        return salida;
    }
    async fetch(query) {
        await this.ensureToken(false);
        return this.fetchConReintento(query, 0);
    }
    /**
     * Un solo reintento: si el token caducó, se pide otro y se repite. No hay
     * forma de saber de antemano cuánto dura —la API no lo expone—, así que
     * reaccionar al rechazo es la única estrategia posible.
     */
    async fetchConReintento(query, intento) {
        const url = this.buildUrl(query);
        const response = await this.fetchWithTimeout(url);
        const statusReintentables = this.config.loginRetryStatuses ?? DEFAULT_RETRY_STATUSES;
        if (this.usaLogin() && intento === 0 && statusReintentables.includes(response.status)) {
            logger_js_1.logger.info('RestConnector: token rechazado, reintentando con login nuevo', {
                status: response.status,
                source: this.config.name,
            });
            this.session?.clearToken();
            this.cachedToken = undefined;
            await this.ensureToken(true);
            return this.fetchConReintento(query, intento + 1);
        }
        if (!response.ok) {
            throw new Error(`REST API error: HTTP ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        const rawArray = this.extraerArreglo(json);
        if (rawArray.length === 0) {
            return {
                columns: [],
                rows: [],
                totalRows: 0,
                fetchedAt: new Date(),
                source: this.config.name ?? this.config.baseUrl,
            };
        }
        // Derive columns from first object
        const firstItem = rawArray[0];
        const columns = firstItem !== null && typeof firstItem === 'object'
            ? Object.keys(firstItem)
            : [];
        const rows = rawArray.map((item) => {
            if (item === null || typeof item !== 'object') {
                return { value: String(item) };
            }
            const row = {};
            for (const [k, v] of Object.entries(item)) {
                if (v === null ||
                    typeof v === 'string' ||
                    typeof v === 'number' ||
                    typeof v === 'boolean') {
                    row[k] = v;
                }
                else {
                    row[k] = JSON.stringify(v);
                }
            }
            return this.traducir(row);
        });
        return {
            // Las columnas se toman de una fila ya traducida: es lo que verá el
            // mapeador, y lo que debe mostrar el diagnóstico de columnas.
            columns: rows.length > 0 ? Object.keys(rows[0]) : columns,
            rows,
            totalRows: rows.length,
            fetchedAt: new Date(),
            source: this.config.name ?? this.config.baseUrl,
        };
    }
}
exports.RestConnector = RestConnector;
//# sourceMappingURL=rest.connector.js.map