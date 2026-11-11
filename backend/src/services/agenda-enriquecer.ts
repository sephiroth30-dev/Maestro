import { grupoDeNombre } from '../config/capacidad-grupos.js';
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

export function enriquecerCita(
  f: FilaCita,
  r: Resolutores,
  epsPorConvenio: Map<number, string | null>,
): { entidadId: string | null; grupo: string | null } {
  // EPS: primero la del catálogo de convenios (el mismo nombre que usan los
  // consumos); si no hay, el nombre del convenio contra los alias de Entidades.
  const epsNombre = f.convenioCod !== null ? epsPorConvenio.get(f.convenioCod) ?? null : null;
  const entidadId = (epsNombre ? r.entidad(epsNombre) : null) ?? r.entidad(f.convenioNombre);

  // Grupo, con la MISMA cadena que las atenciones: palabras clave del catálogo
  // (con el ascenso de «consulta genérica» a la de la especialidad del
  // profesional) y luego el grupo por nombre. Si las palabras clave no resuelven,
  // se intenta el nombre de la referencia tal cual.
  const especialidad = r.especialidadDe(f.profesionalNombre);
  const grupo = grupoDeNombre(r.servicioNombre(f.referenciaNombre, especialidad)) ?? grupoDeNombre(f.referenciaNombre);
  return { entidadId, grupo };
}
