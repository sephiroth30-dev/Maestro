"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorService = exports.ConnectorService = exports.FrecuenciaSyncSchema = exports.RestConfigSchema = exports.SheetsConfigSchema = void 0;
const zod_1 = require("zod");
const conectores_repo_js_1 = require("../repositories/conectores.repo.js");
const sheets_connector_js_1 = require("../connectors/sheets.connector.js");
const rest_connector_js_1 = require("../connectors/rest.connector.js");
const logger_js_1 = require("../config/logger.js");
// ─── Zod Config Schemas ───────────────────────────────────────────────────────
const GoogleServiceAccountSchema = zod_1.z.object({
    type: zod_1.z.string().optional(),
    project_id: zod_1.z.string().optional(),
    private_key_id: zod_1.z.string().optional(),
    private_key: zod_1.z.string().optional(),
    client_email: zod_1.z.string().optional(),
    client_id: zod_1.z.string().optional(),
    auth_uri: zod_1.z.string().optional(),
    token_uri: zod_1.z.string().optional(),
}).passthrough();
exports.SheetsConfigSchema = zod_1.z
    .object({
    spreadsheetId: zod_1.z.string().min(1).optional(),
    folderId: zod_1.z.string().min(1).optional(),
    fileNamePattern: zod_1.z.string().optional(),
    credentials: zod_1.z.union([
        GoogleServiceAccountSchema,
        zod_1.z.string().min(1, 'credentials debe ser un objeto JSON o ruta al archivo'),
    ]),
})
    .refine((d) => d.spreadsheetId ?? d.folderId, {
    message: 'Se requiere spreadsheetId (hoja individual) o folderId (carpeta de Drive)',
});
exports.RestConfigSchema = zod_1.z.object({
    baseUrl: zod_1.z.string().url('baseUrl debe ser una URL válida'),
    /** Ruta relativa a baseUrl. Sin ella se pide la raíz, que rara vez sirve. */
    endpoint: zod_1.z.string().optional(),
    params: zod_1.z.record(zod_1.z.string()).optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    authType: zod_1.z.enum(['none', 'bearer', 'basic', 'apiKeyHeader']).optional(),
    authValue: zod_1.z.string().optional(),
    authHeaderName: zod_1.z.string().optional(),
    /** Campo canónico -> campo tal como llega del origen. */
    fieldMap: zod_1.z.record(zod_1.z.string()).optional(),
    dataPath: zod_1.z.string().optional(),
    timeoutSec: zod_1.z.number().int().min(1).max(300).optional(),
})
    .refine((d) => d.authType !== 'apiKeyHeader' || Boolean(d.authHeaderName), {
    message: 'Con autenticación por cabecera hay que indicar el nombre de la cabecera',
    path: ['authHeaderName'],
});
exports.FrecuenciaSyncSchema = zod_1.z.enum([
    '30min',
    '1h',
    '4h',
    'daily',
    'manual',
]);
// ─── Service ──────────────────────────────────────────────────────────────────
class ConnectorService {
    // ─── Validate config per tipo ─────────────────────────────────────────────
    validateConfig(tipo, config) {
        if (tipo === 'GOOGLE_SHEETS') {
            const result = exports.SheetsConfigSchema.safeParse(config);
            if (!result.success) {
                throw new Error(`Configuración inválida para Google Sheets: ${result.error.issues[0]?.message}`);
            }
        }
        else if (tipo === 'REST_API') {
            const result = exports.RestConfigSchema.safeParse(config);
            if (!result.success) {
                throw new Error(`Configuración inválida para REST API: ${result.error.issues[0]?.message}`);
            }
        }
        // POSTGRESQL and CSV: validation deferred to future stages
    }
    // ─── Ocultar credenciales ─────────────────────────────────────────────────
    static MASCARA = '[REDACTED]';
    /** Claves cuyo contenido nunca debe salir del servidor. */
    static CLAVES_SECRETAS = [
        'credentials', 'authValue', 'password', 'apiKey', 'secret', 'privateKey',
    ];
    maskConfig(config) {
        const masked = { ...config };
        for (const clave of ConnectorService.CLAVES_SECRETAS) {
            if (clave in masked && masked[clave])
                masked[clave] = ConnectorService.MASCARA;
        }
        // Las cabeceras libres son el sitio habitual para meter una API key.
        if (masked['headers'] && typeof masked['headers'] === 'object') {
            const h = masked['headers'];
            masked['headers'] = Object.fromEntries(Object.keys(h).map((k) => [k, /token|key|auth|secret/i.test(k) ? ConnectorService.MASCARA : h[k]]));
        }
        return masked;
    }
    /** Repone los valores reales donde el cliente devolvió la máscara. */
    preservarSecretos(entrante, guardado) {
        const salida = { ...entrante };
        for (const clave of ConnectorService.CLAVES_SECRETAS) {
            if (salida[clave] === ConnectorService.MASCARA && guardado[clave] !== undefined) {
                salida[clave] = guardado[clave];
            }
        }
        if (salida['headers'] && typeof salida['headers'] === 'object') {
            const nuevos = salida['headers'];
            const viejos = (guardado['headers'] ?? {});
            salida['headers'] = Object.fromEntries(Object.entries(nuevos).map(([k, v]) => v === ConnectorService.MASCARA && viejos[k] !== undefined ? [k, viejos[k]] : [k, v]));
        }
        return salida;
    }
    /**
     * Versión del conector apta para enviar al navegador.
     *
     * Antes `GET /connectors` devolvía el `config` íntegro —con la clave privada
     * de Google y el token de la API— a cualquier sesión de administrador. El
     * frontend solo necesita saber SI hay credencial, no cuál es.
     */
    publicView(conector) {
        return {
            ...conector,
            config: this.maskConfig(conector.config),
        };
    }
    // ─── CRUD ─────────────────────────────────────────────────────────────────
    async create(data) {
        this.validateConfig(data.tipo, data.config);
        if (data.frecuenciaSync) {
            const result = exports.FrecuenciaSyncSchema.safeParse(data.frecuenciaSync);
            if (!result.success) {
                throw new Error(`frecuenciaSync inválida: valores válidos son 30min, 1h, 4h, daily, manual`);
            }
        }
        logger_js_1.logger.info('Creating connector', {
            nombre: data.nombre,
            tipo: data.tipo,
            config: this.maskConfig(data.config),
        });
        return conectores_repo_js_1.conectoresRepo.create({
            nombre: data.nombre,
            tipo: data.tipo,
            config: data.config,
            frecuenciaSync: data.frecuenciaSync ?? 'daily',
        });
    }
    async list() {
        return conectores_repo_js_1.conectoresRepo.findAll();
    }
    async getById(id) {
        const conector = await conectores_repo_js_1.conectoresRepo.findById(id);
        if (!conector) {
            const err = new Error(`Conector ${id} no encontrado`);
            err.statusCode = 404;
            throw err;
        }
        return conector;
    }
    async update(id, data) {
        const conector = await this.getById(id);
        // Como la lectura devuelve las credenciales enmascaradas, el formulario de
        // edición las reenvía como '[REDACTED]'. Reponerlas evita que guardar un
        // simple cambio de nombre borre el token sin que nadie se entere.
        if (data.config) {
            const config = this.preservarSecretos(data.config, (conector.config ?? {}));
            this.validateConfig(conector.tipo, config);
            data = { ...data, config };
        }
        if (data.frecuenciaSync) {
            const result = exports.FrecuenciaSyncSchema.safeParse(data.frecuenciaSync);
            if (!result.success) {
                throw new Error(`frecuenciaSync inválida: valores válidos son 30min, 1h, 4h, daily, manual`);
            }
        }
        logger_js_1.logger.info('Updating connector', {
            id,
            changes: data.config ? { ...data, config: this.maskConfig(data.config) } : data,
        });
        return conectores_repo_js_1.conectoresRepo.update(id, data);
    }
    async delete(id) {
        await this.getById(id); // ensure it exists
        logger_js_1.logger.info('Soft-deleting connector', { id });
        await conectores_repo_js_1.conectoresRepo.softDelete(id);
    }
    // ─── Instantiate connector ────────────────────────────────────────────────
    instantiate(conector) {
        const config = conector.config;
        if (conector.tipo === 'GOOGLE_SHEETS') {
            return new sheets_connector_js_1.SheetsConnector({
                spreadsheetId: config['spreadsheetId'],
                folderId: config['folderId'],
                fileNamePattern: config['fileNamePattern'],
                credentials: config['credentials'],
                name: conector.nombre,
            });
        }
        if (conector.tipo === 'REST_API') {
            return new rest_connector_js_1.RestConnector({
                baseUrl: config['baseUrl'],
                headers: config['headers'],
                authType: config['authType'],
                authValue: config['authValue'],
                name: conector.nombre,
            });
        }
        throw new Error(`Tipo de conector no soportado: ${conector.tipo}`);
    }
    // ─── Test connection ──────────────────────────────────────────────────────
    async testConnection(conectorOrDto) {
        let instance;
        if ('id' in conectorOrDto) {
            // Existing connector from DB
            instance = this.instantiate(conectorOrDto);
        }
        else {
            // New config — create ephemeral instance
            const dto = conectorOrDto;
            this.validateConfig(dto.tipo, dto.config);
            const ephemeral = {
                id: 'test',
                nombre: dto.nombre,
                tipo: dto.tipo,
                config: dto.config,
                activo: true,
                frecuenciaSync: 'manual',
                ultimaSync: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            instance = this.instantiate(ephemeral);
        }
        return instance.test();
    }
    // ─── List sheets ──────────────────────────────────────────────────────────
    async listSheets(conectorId) {
        const conector = await this.getById(conectorId);
        if (conector.tipo !== 'GOOGLE_SHEETS') {
            throw new Error('listSheets solo está disponible para conectores de tipo GOOGLE_SHEETS');
        }
        const instance = this.instantiate(conector);
        return instance.listSheets();
    }
}
exports.ConnectorService = ConnectorService;
exports.connectorService = new ConnectorService();
//# sourceMappingURL=connector.service.js.map