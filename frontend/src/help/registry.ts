/**
 * Catálogo de artículos de ayuda.
 *
 * Los .md de `content/` son LA FUENTE DE VERDAD de la documentación de usuario:
 * de aquí sale tanto el panel de la aplicación como los manuales en PDF
 * (`scripts/md-a-pdf.py --manual`). No hay una segunda copia que mantener.
 *
 * Vite resuelve el glob en tiempo de compilación e incrusta los textos, así que
 * no hay peticiones al servidor ni riesgo de que falte un archivo en producción.
 */

import { tieneAcceso } from '../lib/permisos.js';
import type { UsuarioConAcceso } from '../lib/permisos.js';

export interface Articulo {
  id: string;
  titulo: string;
  /** Módulo que hay que tener para verlo. Sin él, es visible para todos. */
  modulo?: string;
  /** Posición en el índice y en el manual generado. */
  orden: number;
  /** Términos que deben encontrarlo aunque no aparezcan en el texto. */
  claves: string[];
  /** Cuerpo en Markdown, ya sin el bloque de metadatos. */
  markdown: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Parsea el bloque `clave: valor` del encabezado. Sin dependencias. */
function parsear(ruta: string, crudo: string): Articulo | null {
  const m = FRONTMATTER.exec(crudo);
  if (!m) {
    console.warn(`[ayuda] ${ruta} no tiene bloque de metadatos; se omite.`);
    return null;
  }

  const meta: Record<string, string> = {};
  for (const linea of m[1]!.split('\n')) {
    const i = linea.indexOf(':');
    if (i === -1) continue;
    meta[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }

  const id = meta.id ?? '';
  const titulo = meta.titulo ?? '';
  if (!id || !titulo) {
    console.warn(`[ayuda] ${ruta} necesita al menos "id" y "titulo"; se omite.`);
    return null;
  }

  return {
    id,
    titulo,
    modulo: meta.modulo || undefined,
    orden: Number(meta.orden ?? 999),
    claves: (meta.claves ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    markdown: crudo.slice(m[0].length).trim(),
  };
}

const CRUDOS = import.meta.glob('./content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Todos los artículos, ordenados. El filtro por permisos va aparte. */
export const ARTICULOS: Articulo[] = Object.entries(CRUDOS)
  .map(([ruta, crudo]) => parsear(ruta, crudo))
  .filter((a): a is Articulo => a !== null)
  .sort((a, b) => a.orden - b.orden);

/** Los que este usuario puede ver. */
export function articulosVisibles(user: UsuarioConAcceso | null | undefined): Articulo[] {
  return ARTICULOS.filter((a) => tieneAcceso(user, a.modulo));
}

export function buscarArticulo(id: string): Articulo | undefined {
  return ARTICULOS.find((a) => a.id === id);
}
