import { PrismaClient } from '@prisma/client';
export declare let prisma: PrismaClient;
export declare function renewPrismaClient(): void;
export declare function connectDatabase(): Promise<void>;
export declare function disconnectDatabase(): Promise<void>;
//# sourceMappingURL=prisma.d.ts.map