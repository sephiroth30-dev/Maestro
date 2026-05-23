"use strict";
// Redis disabled for initial deploy — using in-memory cache
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.connectRedis = connectRedis;
exports.disconnectRedis = disconnectRedis;
exports.flushReportesCache = flushReportesCache;
exports.getRedisClient = getRedisClient;
const memCache = new Map();
exports.redis = {
    get: async (key) => {
        const entry = memCache.get(key);
        if (!entry)
            return null;
        if (Date.now() > entry.expiresAt) {
            memCache.delete(key);
            return null;
        }
        return entry.value;
    },
    set: async (key, value, _mode, ttl) => {
        const expiresAt = ttl ? Date.now() + ttl * 1000 : Date.now() + 3600_000;
        memCache.set(key, { value, expiresAt });
    },
    setex: async (key, ttl, value) => {
        memCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    },
    del: async (key) => { memCache.delete(key); },
    disconnect: async () => { memCache.clear(); },
};
async function connectRedis() {
    // no-op
}
async function disconnectRedis() {
    memCache.clear();
}
function flushReportesCache() {
    const prefixes = ['kpis:', 'entidades:', 'cumplimiento:', 'diasemana:', 'tendencia:'];
    for (const key of memCache.keys()) {
        if (prefixes.some((p) => key.startsWith(p))) {
            memCache.delete(key);
        }
    }
}
function getRedisClient() {
    return exports.redis;
}
//# sourceMappingURL=redis.js.map