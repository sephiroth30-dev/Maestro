export declare const redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, _mode?: string, ttl?: number) => Promise<void>;
    setex: (key: string, ttl: number, value: string) => Promise<void>;
    del: (key: string) => Promise<void>;
    disconnect: () => Promise<void>;
};
export declare function connectRedis(): Promise<void>;
export declare function disconnectRedis(): Promise<void>;
export declare function flushReportesCache(): void;
export declare function getRedisClient(): typeof redis;
//# sourceMappingURL=redis.d.ts.map