/**
 * Normalización de las citas que devuelve Medifolios, sin base de datos ni red.
 *
 * El conector REST ya aplana cada cita con `fieldMap` (rutas con punto):
 *
 *   codAsignacion ← codAsignacion          estado    ← estadoCita.codEstado
 *   fechaInicioCita ← fechaInicioCita      origen    ← origenCita
 *   codConvenio ← convenio.codConvenio     convenio  ← convenio.nomConvenio
 *   referencia ← referencia.nomReferencia  cups      ← referencia.codigoCupsCums
 *   profesional ← profesional.nomProfesional
 *
 * Aquí se filtra y se limpia. Se guarda lo mínimo: **no hay datos de pacientes**,
 * porque para proyectar no hacen falta.
 */
export declare const FIELD_MAP_CITAS: Record<string, string>;
export type FilaCruda = Record<string, string | number | boolean | null | undefined>;
export interface FilaCita {
    codAsignacion: number;
    /** `P` pendiente, `C` cumplida, `I` incumplida. */
    estado: string;
    /** `YYYY-MM-DD`, en hora de la clínica (no se convierte de zona). */
    fechaDia: string;
    /** `YYYY-MM-DD HH:MM:SS` */
    fechaCita: string;
    convenioCod: number | null;
    convenioNombre: string;
    referenciaNombre: string;
    cups: string | null;
    profesionalNombre: string | null;
}
export interface ResultadoMapeo {
    filas: FilaCita[];
    descartadas: {
        noPendiente: number;
        noAgenda: number;
        sinFecha: number;
        sinCodigo: number;
        duplicadas: number;
    };
}
/**
 * Acepta `YYYY-MM-DD HH:MM[:SS]`, `YYYY-MM-DDTHH:MM[:SS][.sss][Z]`, `DD/MM/YYYY
 * [HH:MM[:SS]]` y solo la fecha. La especificación no dice el formato de
 * `fechaInicioCita` (sí el de `fechaSolicitud`), así que se toleran los
 * habituales en vez de apostar por uno y perder todas las citas si falla.
 *
 * NO se convierte de zona horaria: la hora es la de la clínica. Pasarla por
 * `Date` la desplazaría y una cita de las 8 p. m. caería en el día siguiente.
 */
export declare function parseFechaCita(raw: unknown): {
    fechaDia: string;
    fechaCita: string;
} | null;
/**
 * Un nombre que empieza por «{» o «[» es un objeto o arreglo entero que llegó
 * donde se esperaba un texto (el campo anidado no existe con ese nombre en la
 * respuesta). No es un nombre: se trata como vacío para que se note, en vez de
 * guardar un JSON como si fuera el convenio.
 */
export declare const texto: (v: unknown) => string;
/**
 * Se queda con las citas de AGENDA en los estados pedidos (por omisión solo las
 * PENDIENTES), limpias y sin repetir.
 *
 * El filtro por estado y origen ya viaja en la petición (`estadoCita=P`), pero se
 * repite aquí a propósito: es barato y es la defensa si la API ignorara un
 * parámetro. Una cita cumplida contada como agendada se contaría dos veces (ya
 * está facturada), y una cancelada o de imagenología no consume la agenda.
 */
export declare function normalizarCitas(rows: FilaCruda[], estadosPermitidos?: readonly string[]): ResultadoMapeo;
//# sourceMappingURL=agenda-mapeo.d.ts.map