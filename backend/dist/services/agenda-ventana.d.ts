/**
 * Fechas de la agenda en hora de Colombia, sin base de datos ni red.
 *
 * Colombia no tiene horario de verano: UTC-5 todo el año. Se calcula siempre en
 * hora de la clínica y no en la del servidor: a las 9 p. m. del 31 de octubre ya
 * es 1 de noviembre en UTC, y con el reloj del servidor la ventana de citas
 * saltaría un día (y de mes) antes de tiempo.
 */
/** «Hoy» en la clínica, `YYYY-MM-DD`. */
export declare function hoyEnBogota(ahora: Date): string;
/**
 * Rango de fechas de citas a sincronizar: de HOY al último día del mes
 * `mesesAdelante` meses después (1 = el mes siguiente).
 *
 * Por qué no más: la agenda de Medifolios rara vez llega más lejos, y pedir más
 * solo añade páginas. Por qué no menos: ver el mes siguiente ya cargado permite
 * a la administración anticiparse.
 */
export declare function ventanaCitas(ahora: Date, mesesAdelante?: number): {
    desde: string;
    hasta: string;
};
/**
 * ¿Es horario de trabajo de la clínica? Lunes a sábado, de 6:00 a 19:59.
 *
 * Fuera de ese horario la agenda no cambia de forma que importe, y sincronizarla
 * cada 15 minutos toda la noche solo cargaría a Medifolios sin aportar nada.
 */
export declare function enHorarioLaboral(ahora: Date): boolean;
/** `YYYY-MM-DD` menos `n` días (calendario, sin zona horaria de por medio). */
export declare function diasAntes(iso: string, n: number): string;
//# sourceMappingURL=agenda-ventana.d.ts.map