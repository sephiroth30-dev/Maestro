/**
 * Rasteriza un SVG (las graficas de recharts, el logo) a PNG usando solo APIs
 * del navegador — sin html2canvas.
 *
 * Funciona porque recharts emite un <svg> real con los atributos de
 * presentacion inline (fill, stroke), no via clases CSS.
 */

/** Escala fija, NO devicePixelRatio: un Mac Retina y un PC de escritorio
 *  deben producir exactamente el mismo archivo. */
const SCALE = 2;
const FONT = 'Helvetica, Arial, sans-serif';

/** Por debajo de esto lo capturado es un icono, no una grafica. */
const MIN_CHART_PX = 80;

export interface RasterResult {
  dataUrl: string;
  w: number;
  h: number;
}

/** Rasteriza una cadena SVG con dimensiones conocidas. */
export async function rasterizeSvgString(
  xml: string,
  w: number,
  h: number,
  scale = SCALE,
  bg = '#ffffff',
): Promise<RasterResult | null> {
  if (!w || !h) return null;

  // Blob URL en vez de base64: btoa() lanza excepcion con acentos
  // ("Miercoles" en el eje X basta para romperlo) y evita el limite de
  // longitud de las data-URL. Al ser mismo origen, no contamina el canvas.
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('No se pudo rasterizar el SVG'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(scale, scale);
    // Fondo opaco: un PNG transparente se ve mal en los visores de PDF. El
    // color es configurable para que el logo se funda con la banda azul en vez
    // de arrastrar un recuadro blanco.
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return { dataUrl: canvas.toDataURL('image/png'), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Captura el primer <svg> dentro de `host` y lo devuelve como PNG.
 * Devuelve null (nunca lanza) si la gráfica no esta montada o no mide nada,
 * para que una grafica ausente no tumbe la exportacion completa.
 */
export async function svgToPng(host: HTMLElement | null): Promise<RasterResult | null> {
  if (!host) return null;
  // La superficie de recharts primero: si la tarjeta esta en estado de error o
  // de carga, el primer <svg> del contenedor es el icono de lucide y acabaria
  // incrustado a media pagina como si fuera la gráfica.
  const svg =
    host.querySelector<SVGSVGElement>('svg.recharts-surface') ?? host.querySelector('svg');
  if (!svg) return null;

  const rect = svg.getBoundingClientRect();
  const w = Math.round(rect.width || Number(svg.getAttribute('width')) || 0);
  const h = Math.round(rect.height || Number(svg.getAttribute('height')) || 0);
  if (!w || !h) return null;
  // Un icono de 14x14 no es una grafica.
  if (w < MIN_CHART_PX || h < MIN_CHART_PX) return null;

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);

  // El rasterizador corre en un documento aislado donde el CSS de la pagina no
  // cascadea, asi que la tipografia se inyecta explicitamente.
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = `text{font-family:${FONT};}.recharts-tooltip-wrapper{display:none;}`;
  clone.insertBefore(style, clone.firstChild);

  try {
    const xml = new XMLSerializer().serializeToString(clone);
    return await rasterizeSvgString(xml, w, h);
  } catch {
    return null;
  }
}
