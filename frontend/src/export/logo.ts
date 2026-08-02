/**
 * Logo corporativo como PNG para incrustar en el PDF.
 *
 * jsPDF no dibuja SVG sin el plugin svg2pdf, asi que el logotipo vectorial se
 * rasteriza una sola vez por sesion y se memoiza.
 */

import logoSvg from '../assets/neurofic-logo.svg?raw';
import { rasterizeSvgString } from './svgToPng.js';
import type { RasterResult } from './svgToPng.js';

/** Relacion de aspecto del viewBox original (220 x 188). */
export const LOGO_RATIO = 188 / 220;

/** Debe coincidir con RGB.azul de brand.ts: el logo se funde con la banda. */
const LOGO_BG = '#1e40af';

let cached: RasterResult | null | undefined;

export async function getLogoPng(): Promise<RasterResult | null> {
  if (cached !== undefined) return cached;
  try {
    cached = await rasterizeSvgString(logoSvg, 220, 188, 2, LOGO_BG);
  } catch {
    cached = null;
  }
  return cached;
}
