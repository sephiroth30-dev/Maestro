export declare const ACCION: {
    readonly LOGIN: "LOGIN";
    readonly LOGIN_FALLIDO: "LOGIN_FALLIDO";
    readonly LOGOUT: "LOGOUT";
    readonly CAMBIO_PASSWORD: "CAMBIO_PASSWORD";
    readonly RESET_PASSWORD: "RESET_PASSWORD";
    readonly USUARIO_CREADO: "USUARIO_CREADO";
    readonly USUARIO_ACTUALIZADO: "USUARIO_ACTUALIZADO";
    readonly USUARIO_ELIMINADO: "USUARIO_ELIMINADO";
    readonly AJUSTE_CREADO: "AJUSTE_CREADO";
    readonly AJUSTE_AUTORIZADO: "AJUSTE_AUTORIZADO";
    readonly AJUSTE_RECHAZADO: "AJUSTE_RECHAZADO";
    readonly AJUSTE_ELIMINADO: "AJUSTE_ELIMINADO";
    readonly LIQUIDACION_GENERADA: "LIQUIDACION_GENERADA";
    readonly LIQUIDACION_APROBADA: "LIQUIDACION_APROBADA";
    readonly LIQUIDACION_PAGADA: "LIQUIDACION_PAGADA";
    readonly LIQUIDACION_REVERTIDA: "LIQUIDACION_REVERTIDA";
    readonly CONECTOR_CREADO: "CONECTOR_CREADO";
    readonly CONECTOR_ACTUALIZADO: "CONECTOR_ACTUALIZADO";
    readonly CONECTOR_ELIMINADO: "CONECTOR_ELIMINADO";
    readonly SYNC_INICIADO: "SYNC_INICIADO";
    readonly DATOS_ELIMINADOS: "DATOS_ELIMINADOS";
    readonly CAPACIDAD_CONFIGURADA: "CAPACIDAD_CONFIGURADA";
    readonly CAPACIDAD_ELIMINADA: "CAPACIDAD_ELIMINADA";
};
export type Accion = (typeof ACCION)[keyof typeof ACCION];
export interface AuditLogMapped {
    id: string;
    usuarioId: string | null;
    usuarioNombre: string | null;
    usuarioEmail: string | null;
    accion: string;
    entidadTipo: string | null;
    entidadId: string | null;
    detalle: Record<string, unknown> | null;
    ip: string | null;
    createdAt: string;
}
export interface InsertAuditData {
    usuarioId?: string | null;
    accion: string;
    entidadTipo?: string | null;
    entidadId?: string | null;
    detalle?: Record<string, unknown> | null;
    ip?: string | null;
}
export interface FindManyParams {
    page?: number;
    limit?: number;
    usuarioId?: string;
    accion?: string;
    desde?: string;
    hasta?: string;
}
declare class AuditoriaRepository {
    insert(data: InsertAuditData): Promise<void>;
    findMany(params: FindManyParams): Promise<{
        rows: AuditLogMapped[];
        total: number;
    }>;
    listAcciones(): Promise<string[]>;
}
export declare const auditoriaRepo: AuditoriaRepository;
export {};
//# sourceMappingURL=auditoria.repo.d.ts.map