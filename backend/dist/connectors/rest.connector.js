"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestConnector = void 0;
const logger_js_1 = require("../config/logger.js");
const base_connector_js_1 = require("./base.connector.js");
const REQUEST_TIMEOUT_MS = 10_000;
// ─── Implementation ───────────────────────────────────────────────────────────
class RestConnector extends base_connector_js_1.BaseConnector {
    config;
    tipo = 'REST_API';
    constructor(config) {
        super();
        this.config = config;
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
        return headers;
    }
    // ─── Fetch with timeout ───────────────────────────────────────────────────
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: this.buildHeaders(),
            });
            return response;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    // ─── test() ───────────────────────────────────────────────────────────────
    async test() {
        const start = Date.now();
        const url = this.config.baseUrl;
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
                details: { status: response.status, url },
            };
        }
        catch (err) {
            const latencyMs = Date.now() - start;
            const isTimeout = err instanceof Error && err.name === 'AbortError';
            const message = isTimeout
                ? 'Timeout después de 10 segundos'
                : err instanceof Error
                    ? err.message
                    : 'Error de conexión';
            logger_js_1.logger.warn('RestConnector test failed', {
                url,
                error: message,
            });
            return {
                success: false,
                message,
                latencyMs,
            };
        }
    }
    // ─── fetch() ─────────────────────────────────────────────────────────────
    async fetch(query) {
        const base = this.config.baseUrl.replace(/\/$/, '');
        const endpoint = query.endpoint ? `/${query.endpoint.replace(/^\//, '')}` : '';
        let url = `${base}${endpoint}`;
        // Append query params
        if (query.params && Object.keys(query.params).length > 0) {
            const searchParams = new URLSearchParams(query.params);
            if (query.limit)
                searchParams.set('limit', String(query.limit));
            if (query.offset)
                searchParams.set('offset', String(query.offset));
            url = `${url}?${searchParams.toString()}`;
        }
        else {
            const searchParams = new URLSearchParams();
            if (query.limit)
                searchParams.set('limit', String(query.limit));
            if (query.offset)
                searchParams.set('offset', String(query.offset));
            const qs = searchParams.toString();
            if (qs)
                url = `${url}?${qs}`;
        }
        const response = await this.fetchWithTimeout(url);
        if (!response.ok) {
            throw new Error(`REST API error: HTTP ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        // Support both array and envelope { data: [...] }
        let rawArray;
        if (Array.isArray(json)) {
            rawArray = json;
        }
        else if (json !== null &&
            typeof json === 'object' &&
            'data' in json &&
            Array.isArray(json['data'])) {
            rawArray = json['data'];
        }
        else {
            // Single object — wrap it
            rawArray = [json];
        }
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
            return row;
        });
        return {
            columns,
            rows,
            totalRows: rows.length,
            fetchedAt: new Date(),
            source: this.config.name ?? this.config.baseUrl,
        };
    }
}
exports.RestConnector = RestConnector;
//# sourceMappingURL=rest.connector.js.map