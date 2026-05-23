export declare const CRON_SCHEDULES: {
    readonly '30min': "*/30 * * * *";
    readonly '1h': "0 * * * *";
    readonly '4h': "0 */4 * * *";
    readonly daily: "0 20 * * *";
};
export declare function scheduleConnector(conectorId: string, nombre: string, cronExpression: string): void;
export declare function unscheduleConnector(conectorId: string): void;
export declare function initCron(): Promise<void>;
export declare function stopCron(): void;
//# sourceMappingURL=cron.service.d.ts.map