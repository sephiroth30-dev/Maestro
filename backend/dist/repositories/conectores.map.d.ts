import type { Conector, TipoConector } from '@prisma/client';
import type { RowDataPacket } from 'mysql2';
/**
 * Traducción de fila de MySQL a objeto `Conector`, aparte del repositorio.
 *
 * Está en su propio módulo porque no toca la base de datos: así se puede probar
 * sin levantar el pool ni cargar la configuración. Esa separación tiene motivo
 * concreto — el mapeador enumera los campos a mano y termina en un
 * `as unknown as Conector`, de modo que **olvidar una columna no produce error
 * de compilación**. Ocurrió con `es_fuente_activa`: la consulta la traía, esto
 * la descartaba, y la pantalla de Fuentes nunca llegó a enterarse de qué fuente
 * estaba marcada.
 */
export interface ConectorRow extends RowDataPacket {
    id: string;
    nombre: string;
    tipo: TipoConector;
    config: string | Record<string, unknown>;
    activo: number;
    es_fuente_activa: number | null;
    frecuencia_sync: string;
    ultima_sync: Date | null;
    created_at: Date;
    updated_at: Date;
}
export declare function mapConector(row: ConectorRow): Conector;
//# sourceMappingURL=conectores.map.d.ts.map