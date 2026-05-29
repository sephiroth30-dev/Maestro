/**
 * NeuroficLogo — Logosímbolo corporativo de Neurofic.
 *
 * Silueta y cuadrícula extraídas directamente del PDF vectorial
 * del Manual de Identidad Visual Corporativa Neurofic mediante
 * análisis geométrico (union de polígonos con Shapely).
 *
 * Colores exactos del PDF:
 *   #7D7C7E (49%) · #969696 (58%) · #AAAAAC (66%)
 *   #C0BFC1 (75%) · #D5D4D5 (83%) · #EAEAEA (92%)
 *   #EF1440 — Rojo corporativo (C:0 M:100 Y:75 K:0)
 *   #E6E6E6 — Fondo K:10%
 *
 * ViewBox 0 0 220 188 · Posiciones de cuadros: reescaladas desde PDF.
 */

import React from 'react';

interface Props {
  size?: number;
  className?: string;
}

// Silueta del cerebro — unión de todos los paths del PDF simplificada a 31 puntos.
const BRAIN =
  'M -2.4 74.6 L 0.1 109.0 L 6.9 116.8 L 37.9 119.6 ' +
  'L 54.1 137.7 L 72.6 144.9 L 99.8 144.8 L 135.3 174.4 ' +
  'L 144.8 186.8 L 163.0 195.8 L 182.8 185.5 L 184.9 173.7 ' +
  'L 199.5 160.7 L 205.7 150.3 L 214.8 132.0 L 216.0 114.8 ' +
  'L 223.3 92.5 L 220.3 76.9 L 209.6 69.2 L 206.7 49.6 ' +
  'L 193.4 37.2 L 184.5 19.9 L 173.6 15.9 L 152.7 0.3 ' +
  'L 130.4 -3.1 L 80.6 3.0 L 63.4 18.4 L 45.6 21.1 ' +
  'L 25.7 30.9 L 5.6 53.9 L -2.4 74.6 Z';

// ── Cuadrícula ────────────────────────────────────────────────────────────────
// Posiciones derivadas del análisis vectorial del PDF.
// Columnas x: 29, 65, 101, 137, 173  (paso ~36 px)
// Filas    y: -18, 17, 52, 88, 123, 158  (paso ~35 px, SQ 34×33)
// El clipPath del cerebro recorta automáticamente filas y columnas parciales.
// Cuadrado rojo: col 3 (x=137), fila 3 (y=88).

const SQ_W = 34;
const SQ_H = 33;

const GRID: { x: number; y: number; fill: string }[] = [
  // — Fila 0 (y=−18) · parcial superior · recortada por la silueta ————
  { x:  29, y: -18, fill: '#969696' },   // 58%
  { x:  65, y: -18, fill: '#D5D4D5' },   // 83%
  { x: 101, y: -18, fill: '#AAAAAC' },   // 66%
  { x: 137, y: -18, fill: '#7D7C7E' },   // 49%
  { x: 173, y: -18, fill: '#C0BFC1' },   // 75%

  // — Fila 1 (y=17) · completa ——————————————————————————————————————
  { x:  29, y: 17, fill: '#969696' },    // 58%
  { x:  65, y: 17, fill: '#7D7C7E' },    // 49%
  { x: 101, y: 17, fill: '#D5D4D5' },    // 83%
  { x: 137, y: 17, fill: '#969696' },    // 58%
  { x: 173, y: 17, fill: '#C0BFC1' },    // 75%

  // — Fila 2 (y=52) · completa ——————————————————————————————————————
  { x:  29, y: 52, fill: '#D5D4D5' },    // 83%
  { x:  65, y: 52, fill: '#EAEAEA' },    // 92%
  { x: 101, y: 52, fill: '#7D7C7E' },    // 49%
  { x: 137, y: 52, fill: '#C0BFC1' },    // 75%
  { x: 173, y: 52, fill: '#AAAAAC' },    // 66%

  // — Fila 3 (y=88) · ROJO corporativo en col 3 ——————————————————————
  { x:  29, y: 88, fill: '#7D7C7E' },    // 49%
  { x:  65, y: 88, fill: '#C0BFC1' },    // 75%
  { x: 101, y: 88, fill: '#969696' },    // 58%
  { x: 137, y: 88, fill: '#EF1440' },    // ← Rojo corporativo
  { x: 173, y: 88, fill: '#EAEAEA' },    // 92%

  // — Fila 4 (y=123) · parcial inferior ————————————————————————————
  { x:  65, y: 123, fill: '#D5D4D5' },   // 83%
  { x: 101, y: 123, fill: '#EAEAEA' },   // 92%
  { x: 137, y: 123, fill: '#C0BFC1' },   // 75%
  { x: 173, y: 123, fill: '#969696' },   // 58%

  // — Fila 5 (y=158) · parcial base ————————————————————————————————
  { x: 137, y: 158, fill: '#D5D4D5' },   // 83%
  { x: 173, y: 158, fill: '#7D7C7E' },   // 49%
];

export default function NeuroficLogo({ size = 80, className }: Props): React.ReactElement {
  return (
    <svg
      viewBox="0 0 220 188"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Neurofic — Centro de Neurofisiología Clínica"
      role="img"
    >
      <defs>
        <clipPath id="nf-brain-clip">
          <path d={BRAIN} />
        </clipPath>
      </defs>

      {/* Fondo del cerebro — K:10% */}
      <path d={BRAIN} fill="#E6E6E6" />

      {/* Cuadrícula recortada a la silueta del cerebro */}
      <g clipPath="url(#nf-brain-clip)">
        {GRID.map((sq, i) => (
          <rect
            key={i}
            x={sq.x}
            y={sq.y}
            width={SQ_W}
            height={SQ_H}
            fill={sq.fill}
          />
        ))}
      </g>
    </svg>
  );
}
