/**
 * Búsqueda dentro de la ayuda.
 *
 * El índice se arma en memoria a partir de los artículos ya incrustados: son
 * unos cien fragmentos, así que filtrar con `useMemo` en cada tecla es
 * instantáneo y no hace falta debounce — mismo criterio que el resto de
 * buscadores de la aplicación.
 */

import type { Articulo } from './registry.js';

export interface Fragmento {
  articuloId: string;
  articuloTitulo: string;
  /** Encabezado ## o ### bajo el que vive el texto. Vacío en la entradilla. */
  seccion: string;
  texto: string;
}

export interface Resultado extends Fragmento {
  /** Trozo del texto alrededor de la coincidencia, para previsualizar. */
  extracto: string;
}

/**
 * Normaliza para comparar: minúsculas y sin tildes.
 *
 * Es imprescindible, no un adorno: en Colombia se teclea «liquidacion» y
 * «facturacion» sin tilde constantemente, y sin esto el buscador no encontraría
 * «liquidación» ni «facturación».
 */
export function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Deja el Markdown en texto plano legible para buscar y previsualizar. */
function aTextoPlano(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')          // bloques de código
    .replace(/<\/?(details|summary)[^>]*>/gi, ' ') // etiquetas de los desplegables
    .replace(/<[^>]+>/g, ' ')                 // cualquier otro HTML
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // imágenes
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // enlaces: se conserva el texto
    .replace(/[*_`>#|]/g, ' ')                // marcas de formato y tablas
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trocea cada artículo por sus encabezados. */
export function construirIndice(articulos: Articulo[]): Fragmento[] {
  const fragmentos: Fragmento[] = [];

  for (const art of articulos) {
    let seccion = '';
    let buffer: string[] = [];

    const volcar = (): void => {
      const texto = aTextoPlano(buffer.join('\n'));
      if (texto.length > 0) {
        fragmentos.push({
          articuloId: art.id,
          articuloTitulo: art.titulo,
          seccion,
          texto,
        });
      }
      buffer = [];
    };

    for (const linea of art.markdown.split('\n')) {
      const enc = /^(#{2,3})\s+(.*)$/.exec(linea);
      if (enc) {
        volcar();
        seccion = enc[2]!.replace(/[*_`]/g, '').trim();
      } else {
        buffer.push(linea);
      }
    }
    volcar();
  }

  return fragmentos;
}

/** Recorta el texto alrededor de la coincidencia. */
function extractoDe(texto: string, textoNorm: string, consultaNorm: string): string {
  const i = textoNorm.indexOf(consultaNorm);
  if (i === -1) return texto.slice(0, 140);
  const desde = Math.max(0, i - 50);
  const hasta = Math.min(texto.length, i + consultaNorm.length + 90);
  return (desde > 0 ? '…' : '') + texto.slice(desde, hasta).trim() + (hasta < texto.length ? '…' : '');
}

/**
 * Busca y ordena. Coincidir en un título pesa más que coincidir en el cuerpo:
 * quien escribe «honorarios» quiere el artículo de Honorarios, no un párrafo
 * cualquiera que mencione la palabra.
 */
export function buscar(
  indice: Fragmento[],
  articulos: Articulo[],
  consulta: string,
  limite = 30,
): Resultado[] {
  const q = norm(consulta.trim());
  if (q.length < 2) return [];

  // Un artículo cuyas palabras clave coincidan se considera coincidencia de título.
  const porClaves = new Set(
    articulos.filter((a) => a.claves.some((c) => norm(c).includes(q))).map((a) => a.id),
  );

  const puntuados: { r: Resultado; peso: number }[] = [];

  for (const f of indice) {
    const tituloNorm = norm(f.articuloTitulo);
    const seccionNorm = norm(f.seccion);
    const textoNorm = norm(f.texto);

    let peso = 0;
    if (tituloNorm === q) peso = 100;
    else if (tituloNorm.includes(q)) peso = 80;
    // Las claves van por delante del título de sección: son intención declarada
    // del autor. Quien busca «liquidacion» quiere el artículo de Honorarios,
    // no la pregunta frecuente que casualmente menciona la palabra.
    else if (porClaves.has(f.articuloId)) peso = 70;
    else if (seccionNorm.includes(q)) peso = 60;
    else if (textoNorm.includes(q)) peso = 20;

    if (peso === 0) continue;

    puntuados.push({
      peso,
      r: { ...f, extracto: extractoDe(f.texto, textoNorm, q) },
    });
  }

  // Una coincidencia de título dispara todos los fragmentos del artículo; se deja
  // solo el primero de cada uno para que un artículo no acapare la lista.
  const vistos = new Set<string>();
  return puntuados
    .sort((a, b) => b.peso - a.peso)
    .filter(({ r, peso }) => {
      if (peso < 60) return true;
      if (vistos.has(r.articuloId)) return false;
      vistos.add(r.articuloId);
      return true;
    })
    .slice(0, limite)
    .map(({ r }) => r);
}
