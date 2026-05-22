// Redis disabled for initial deploy — using in-memory cache

const memCache = new Map<string, { value: string; expiresAt: number }>();

export const redis = {
  get: async (key: string): Promise<string | null> => {
    const entry = memCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
    return entry.value;
  },
  set: async (key: string, value: string, _mode?: string, ttl?: number): Promise<void> => {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : Date.now() + 3600_000;
    memCache.set(key, { value, expiresAt });
  },
  setex: async (key: string, ttl: number, value: string): Promise<void> => {
    memCache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
  },
  del: async (key: string): Promise<void> => { memCache.delete(key); },
  disconnect: async (): Promise<void> => { memCache.clear(); },
};

export async function connectRedis(): Promise<void> {
  // no-op
}

export async function disconnectRedis(): Promise<void> {
  memCache.clear();
}

export function getRedisClient(): typeof redis {
  return redis;
}
