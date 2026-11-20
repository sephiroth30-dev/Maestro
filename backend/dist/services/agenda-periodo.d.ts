/**
 * Lógica pura del endpoint de agenda: qué fechas se consultan y cómo se arma la
 * respuesta. Sin base de datos, para poder probarla.
 *
 * El contrato de la respuesta (`AgendaResult`) vive también en
 * `frontend/src/api/reportes.ts`; deben coincidir.
 */
/**
 * Fechas de agenda de un periodo, recortadas a «de hoy en adelante».
 *
 * Una cita PENDIENTE no puede estar en el pasado: si el periodo ya terminó no
 * queda nada por atender, y si está en curso solo cuenta lo que falta. `null` =
 * no hay nada que consultar.
 */
export declare function periodoDeAgenda(p: {
    mesIdx: number;
    anio: number;
    startDate?: string;
    endDate?: string;
}, hoy: string): {
    desde: string;
    hasta: string;
} | null;
/**
 * Los `n` meses CERRADOS anteriores a la fecha dada (el mes en curso no cuenta: a
 * medias distorsionaría el promedio), del más reciente al más antiguo.
 */
export declare function mesesCerradosPrevios(hoy: string, n?: number): Array<{
    anio: number;
    mes: number;
}>;
/** Un mes del selector de Reportes. `futuro` = sin atenciones, existe solo porque ya tiene citas agendadas. */
export interface MesDisponibleFila {
    anio: number;
    mes: number;
    total: number;
    atenciones: number;
    futuro?: boolean;
}
/**
 * Meses SIN atenciones que ya tienen agenda: los posteriores al último mes con
 * datos, hasta el mes del horizonte (la fecha de la última cita cargada)
 * inclusive. Del más reciente al más antiguo.
 *
 * Sin atenciones no hay último mes y sin horizonte no hay agenda: en ambos casos
 * no se ofrece nada. Un horizonte que no pasa del último mes con datos tampoco
 * agrega nada.
 */
export declare function mesesFuturosConAgenda(ultimoMesConDatos: {
    anio: number;
    mes: number;
} | null, horizonte: string | null): MesDisponibleFila[];
/**
 * Lista del selector: los meses reales (marcados `futuro: false`) más los meses
 * futuros con agenda que aún no estén en ella. Orden anio DESC, mes DESC.
 * `reales` ya viene ordenado así desde el repositorio, pero no se depende de eso.
 */
export declare function agregarMesesFuturos(reales: Array<{
    anio: number;
    mes: number;
    total: number;
    atenciones: number;
}>, horizonte: string | null): MesDisponibleFila[];
export interface FilaEntidadAgenda {
    entidadId: string | null;
    entidad: string;
    tipo: string;
    citas: number;
    valor: number;
    citasSinValor: number;
}
export interface AgendaResultado {
    actualizado_en: string | null;
    horizonte: string | null;
    total: {
        citas: number;
        valor: number;
        citas_sin_valor: number;
    };
    por_entidad: Array<{
        entidad_id: string | null;
        entidad: string;
        tipo: string;
        citas: number;
        valor: number;
        citas_sin_valor: number;
        promedio_3m: number | null;
    }>;
    por_dia: Array<{
        fecha: string;
        citas: number;
        valor: number;
    }>;
}
/** `'YYYY-MM-DD HH:MM:SS'` (UTC, del pool) → ISO. `null` si no hay o no se entiende. */
export declare function aIso(s: string | null | undefined): string | null;
export declare function armarAgenda(porEntidad: FilaEntidadAgenda[], porDia: Array<{
    fecha: string;
    citas: number;
    valor: number;
}>, promedios: Map<string, number>, horizonte: string | null, ultimaOk: string | null): AgendaResultado;
export declare function agendaVacia(horizonte: string | null, ultimaOk: string | null): AgendaResultado;
//# sourceMappingURL=agenda-periodo.d.ts.map