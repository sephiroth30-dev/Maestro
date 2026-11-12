import type { CitaDia, Movimiento } from '../services/tv-movimientos.js';
export interface CitasDiaGuardadas {
    fechaDia: string;
    syncEn: string;
    citas: CitaDia[];
}
/** Las citas de hoy de la lectura anterior, o `null` si no hay. */
export declare function leerCitasDia(conectorId: string): Promise<CitasDiaGuardadas | null>;
/**
 * Reemplaza las citas de hoy de un conector Y registra los movimientos, en UNA transacción: si
 * algo falla no queda la lectura nueva sin sus movimientos (se perderían) ni al revés (se
 * repetirían en la siguiente vuelta). Siempre guarda una fila marcador, para distinguir
 * «hoy no hay citas» de «hoy no se ha leído».
 */
export declare function reemplazarCitasDia(conectorId: string, fechaDia: string, citas: CitaDia[], syncEn: Date, movimientos?: Movimiento[]): Promise<void>;
/** Códigos de las citas pendientes guardadas ahora (para detectar las nuevas). */
export declare function leerCodigosAgenda(conectorId: string): Promise<Set<number>>;
export declare function insertarMovimientos(movs: Movimiento[], creado: Date): Promise<void>;
export interface MovimientoGuardado {
    creado: string;
    tipo: string;
    cantidad: number;
    valor: number | null;
}
/** Los últimos movimientos desde `desde`, del más reciente al más antiguo. */
export declare function leerMovimientos(desde: Date, limite: number): Promise<MovimientoGuardado[]>;
export declare function purgarMovimientos(antes: Date): Promise<void>;
//# sourceMappingURL=tv.repo.d.ts.map