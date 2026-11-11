/**
 * Catálogo único de los grupos de capacidad instalada.
 *
 * Antes esto vivía duplicado como SQL crudo dentro de `capacidad.repo.ts`: la
 * lista de grupos y el `CASE` que clasifica cada servicio aparecían dos veces,
 * una por consulta. Cualquier ajuste a las reglas había que hacerlo en los dos
 * sitios y era cuestión de tiempo que se separaran.
 *
 * ## La base de conteo
 *
 * Un mismo mes admite dos cifras de demanda legítimas y muy distintas:
 *
 * - **pacientes** — visitas únicas (paciente + fecha). Un paciente al que se le
 *   hacen EMG y VCN en la misma cita ocupa *un* hueco de agenda.
 * - **estudios** — registros facturados. Ese mismo paciente generó *dos*.
 *
 * Cuál de las dos gobierna la ocupación depende de dónde esté el cuello de
 * botella de cada grupo, y eso lo dice su fórmula de recursos:
 *
 * - EMG / VCN: «3 salas × 3 pct/h × 8h × 5d × 4ss» → el límite son *pacientes*
 *   por hora de sala, así que la base es `pacientes`.
 * - Potenciales Evocados: el límite real es el estudio, no la cita. Una sola
 *   visita suele cubrir las modalidades visual, auditiva y somatosensorial, y
 *   cada una consume equipo y lectura por separado — de ahí que la operación
 *   reporte ~2,7 estudios por paciente. La base es `estudios`.
 *
 * `base` es solo el valor por omisión: `capacidad_instalada.base_conteo` lo
 * sobreescribe por grupo y mes sin necesidad de un despliegue.
 */
export type BaseConteo = 'pacientes' | 'estudios';
export interface GrupoCapacidad {
    grupo: string;
    nombre: string;
    /** Base por omisión. Se puede sobreescribir en la base de datos. */
    base: BaseConteo;
    /** Patrones LIKE sobre `servicios.nombre`, en mayúsculas. */
    patrones: string[];
    /**
     * Orden de evaluación al clasificar; menor gana. Solo hace falta cuando un
     * patrón es más específico que otro: «CONSULTA%NEUROLOG%PEDIATRI%» tiene que
     * evaluarse antes que «CONSULTA%NEUROLOG%», o el pediátrico nunca se
     * distinguiría del general.
     */
    prioridad?: number;
}
/** En orden de presentación. */
export declare const GRUPOS_CAPACIDAD: GrupoCapacidad[];
/** Tabla derivada con un renglón por grupo: `grupo`, `nombre`, `base_def`. */
export declare function sqlCatalogoGrupos(): string;
/**
 * Los grupos en el orden en que se EVALÚAN: menor prioridad primero y, a igual
 * prioridad, el de la lista. Lo usan tanto el `CASE` de SQL como
 * `grupoDeNombre`, a propósito: si cada uno calculara su propio orden, un grupo
 * nuevo con `prioridad` los separaría y el mismo servicio caería en grupos
 * distintos según se clasificara en la base o en memoria.
 */
export declare const GRUPOS_ORDENADOS: GrupoCapacidad[];
/**
 * `CASE` que traduce el nombre del servicio a su grupo, o NULL si no encaja en
 * ninguno. `col` es la columna a inspeccionar, p. ej. `sv.nombre`.
 */
export declare function sqlClasificacionGrupo(col: string): string;
/** `FIELD(...)` para ordenar por presentación. */
export declare function sqlOrdenGrupos(col: string): string;
/** Base por omisión de cada grupo, para resolver en memoria. */
export declare const BASE_POR_GRUPO: Record<string, BaseConteo>;
/**
 * Grupo de capacidad de un servicio según su nombre, o `null` si no encaja en
 * ninguno. Equivale al `CASE` de `sqlClasificacionGrupo`.
 */
export declare function grupoDeNombre(nombre: string | null | undefined): string | null;
//# sourceMappingURL=capacidad-grupos.d.ts.map