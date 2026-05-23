import mysql from 'mysql2/promise';
export declare const pool: mysql.Pool;
export declare function renewPrismaClient(): void;
export declare function connectDatabase(): Promise<void>;
export declare function disconnectDatabase(): Promise<void>;
//# sourceMappingURL=prisma.d.ts.map