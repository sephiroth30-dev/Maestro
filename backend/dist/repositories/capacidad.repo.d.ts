import { type BaseConteo } from '../config/capacidad-grupos.js';
export interface CapacidadMapped {
    id: string;
    grupo: string;
    nombre: string;
    anio: number;
    mesIdx: number;
    capacidad: number;
    recursos: string | null;
    baseConteo: BaseConteo | null;
    createdAt: string;
    updatedAt: string;
}
export interface UtilizacionMapped {
    grupo: string;
    nombre: string;
    capacidad: number | null;
    /** Qué cifra gobierna la ocupación de este grupo. */
    base: BaseConteo;
    /** Visitas únicas: paciente + día. */
    pacientes: number;
    /** Registros facturados. */
    estudios: number;
    /** Registros sin identificación de paciente, que no se pudieron deduplicar. */
    sinPaciente: number;
    /**
     * La cifra de la base — `estudios` o `pacientes` según el grupo.
     *
     * Se conserva el nombre `sesiones` porque es el que ya consumen la pantalla y
     * las exportaciones; ahora es explícitamente «la demanda que se compara contra
     * la capacidad», no «visitas únicas» como antes.
     */
    sesiones: number;
    pctOcupacion: number | null;
    disponible: number | null;
}
/** Una fila por grupo Y por mes: es lo que permite exportar el histórico. */
export interface UtilizacionMesMapped extends UtilizacionMapped {
    anio: number;
    mesIdx: number;
}
export interface UpsertCapacidadData {
    grupo: string;
    nombre: string;
    anio: number;
    mesIdx: number;
    capacidad: number;
    recursos?: string | null;
    baseConteo?: BaseConteo | null;
}
export declare class CapacidadRepository {
    upsert(data: UpsertCapacidadData): Promise<CapacidadMapped>;
    findByAnio(anio: number): Promise<CapacidadMapped[]>;
    deleteOne(grupo: string, anio: number, mesIdx: number): Promise<void>;
    /**
     * Utilización de un mes.
     *
     * Devuelve las DOS cifras de demanda —visitas y estudios— y cuál de ellas
     * gobierna la ocupación. Antes solo devolvía una, sin decir cuál era, y por eso
     * no se podía conciliar con «Mix por Servicio»: en Potenciales Evocados la
     * pantalla mostraba 56 (visitas) mientras el área reportaba 151 (estudios), y
     * ninguna de las dos era un error.
     */
    getUtilizacion(anio: number, mesIdx: number): Promise<UtilizacionMapped[]>;
    /**
     * Utilización mes a mes en un rango, para ver y exportar el histórico.
     *
     * Se resuelve en UNA consulta agrupando por (año, mes, grupo) en vez de
     * repetir la consulta mensual N veces: el conteo de visitas deduplica por
     * paciente y fecha, así que doce llamadas serían doce recorridos completos.
     *
     * Solo aparecen los meses con actividad o con capacidad configurada; un mes
     * enteramente vacío no genera filas.
     */
    getUtilizacionRango(desdeAnio: number, desdeMes: number, hastaAnio: number, hastaMes: number): Promise<UtilizacionMesMapped[]>;
}
export declare const capacidadRepo: CapacidadRepository;
/** Se expone para las pruebas: permite reiniciar las sondas entre casos. */
export declare function _resetSondasCapacidad(): void;
//# sourceMappingURL=capacidad.repo.d.ts.map