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

export function mapConector(row: ConectorRow): Conector {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    config: (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) as Record<string, unknown>,
    // `activo` y `esFuenteActiva` son cosas distintas: la primera dice si el
    // conector SE SINCRONIZA, la segunda si el dashboard LO MUESTRA.
    activo: Boolean(row.activo),
    // Si `m18` aún no se aplicó, la columna no viene en el SELECT y esto da
    // `false` — el mismo estado que "ninguna fuente marcada", que ya tiene su
    // aviso en pantalla. No hace falta guardia extra.
    esFuenteActiva: Boolean(row.es_fuente_activa),
    frecuenciaSync: row.frecuencia_sync,
    ultimaSync: row.ultima_sync,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as unknown as Conector;
}
