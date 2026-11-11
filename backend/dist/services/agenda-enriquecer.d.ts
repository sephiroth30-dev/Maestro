import type { FilaCita } from './agenda-mapeo.js';
/**
 * Cómo se asigna EPS y grupo de servicio a una cita, sin base de datos: los
 * resolutores llegan inyectados (en producción salen del catálogo de entidades,
 * profesionales y servicios; en las pruebas, de datos de mentira).
 */
export interface Resolutores {
    /** Nombre → id de entidad, por los alias del catálogo. */
    entidad(nombre: string | null | undefined): string | null;
    /** Nombre del profesional → su especialidad, si está catalogado. */
    especialidadDe(profesionalNombre: string | null | undefined): string | null;
    /** Referencia de la cita → nombre del servicio del catálogo (por palabras clave). */
    servicioNombre(referencia: string, especialidad: string | null): string | null;
}
export declare function enriquecerCita(f: FilaCita, r: Resolutores, epsPorConvenio: Map<number, string | null>): {
    entidadId: string | null;
    grupo: string | null;
};
//# sourceMappingURL=agenda-enriquecer.d.ts.map