/**
 * Arranca la evaluación en segundo plano y responde enseguida.
 *
 * Si el candado está ocupado (una sincronización en curso, u otra evaluación) NO se
 * toca el estado guardado: antes se escribía un «error» que borraba el último
 * resultado bueno, o marcaba como fallida una evaluación que seguía corriendo.
 * Nunca lanza.
 */
export declare function iniciarBacktest(conectorId: string): Promise<{
    iniciado: boolean;
    motivo?: string;
}>;
//# sourceMappingURL=agenda-backtest.service.d.ts.map