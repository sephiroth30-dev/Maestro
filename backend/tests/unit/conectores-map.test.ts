import type { RowDataPacket } from 'mysql2';
import { mapConector } from '../../src/repositories/conectores.map';

/**
 * Regresión: `mapConector` construye el objeto campo a campo y acaba en un
 * `as unknown as Conector`, de modo que omitir una columna NO da error de
 * compilación.
 *
 * Eso pasó con `es_fuente_activa`: la consulta la traía, el mapeador la
 * descartaba, y en la pantalla de Fuentes las tres señales que dependen de ese
 * campo —la etiqueta, el botón y el aviso de "ninguna fuente marcada"— se
 * quedaron congeladas aunque la base de datos sí tenía la fuente marcada.
 */
function fila(extra: Record<string, unknown> = {}): never {
  return {
    id: 'c1',
    nombre: 'Medifolios API',
    tipo: 'REST_API',
    config: '{"baseUrl":"https://ejemplo"}',
    activo: 1,
    es_fuente_activa: 0,
    frecuencia_sync: '1h',
    ultima_sync: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...extra,
  } as never;
}

type Mapeado = ReturnType<typeof mapConector> & { esFuenteActiva: boolean };

describe('mapConector', () => {
  it('convierte es_fuente_activa = 1 en esFuenteActiva = true', () => {
    const c = mapConector(fila({ es_fuente_activa: 1 })) as Mapeado;
    expect(c.esFuenteActiva).toBe(true);
  });

  it('convierte es_fuente_activa = 0 en esFuenteActiva = false', () => {
    const c = mapConector(fila({ es_fuente_activa: 0 })) as Mapeado;
    expect(c.esFuenteActiva).toBe(false);
  });

  it('no rompe si la columna no existe todavía (migración m18 sin aplicar)', () => {
    const sinColumna = fila();
    delete (sinColumna as unknown as Record<string, unknown>)['es_fuente_activa'];
    const c = mapConector(sinColumna) as Mapeado;
    // `false` es el estado seguro: equivale a "ninguna marcada", que ya tiene
    // su propio aviso en pantalla.
    expect(c.esFuenteActiva).toBe(false);
  });

  it('sigue distinguiendo `activo` de `esFuenteActiva`', () => {
    // Son dos cosas distintas: `activo` es si la fuente SE SINCRONIZA,
    // `esFuenteActiva` es si el dashboard LA MUESTRA.
    const c = mapConector(fila({ activo: 0, es_fuente_activa: 1 })) as Mapeado;
    expect(c.activo).toBe(false);
    expect(c.esFuenteActiva).toBe(true);
  });

  it('deja intactos los campos que ya mapeaba', () => {
    const c = mapConector(fila()) as Mapeado & { config: Record<string, unknown> };
    expect(c.id).toBe('c1');
    expect(c.nombre).toBe('Medifolios API');
    expect(c.frecuenciaSync).toBe('1h');
    expect(c.config['baseUrl']).toBe('https://ejemplo');
  });
});

// Mantiene la importación de tipos usada arriba sin activar noUnusedLocals.
export type _Row = RowDataPacket;
