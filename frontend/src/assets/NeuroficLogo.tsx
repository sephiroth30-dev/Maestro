/**
 * NeuroficLogo — SVG del símbolo corporativo de Neurofic.
 *
 * Basado en el Manual de Identidad Visual Corporativa Neurofic.
 * Paleta oficial (CMYK → HEX):
 *   K:60% → #666666  |  K:50% → #808080  |  K:20% → #CCCCCC
 *   K:10% → #E6E6E6  |  Rojo C:0 M:100 Y:75 K:0 → #D4162A
 *
 * El logosímbolo representa las pulsaciones del cerebro humano.
 * La cuadrícula en tonos grises simboliza transparencia y confianza;
 * el cuadrado rojo genera impacto visual.
 */

import React from 'react';

interface Props {
  size?: number;
  className?: string;
}

// Brain silhouette path — vista lateral izquierda
const BRAIN =
  'M 52 78 C 45 78 30 74 19 64 C 8 54 3 42 4 30 ' +
  'C 5 18 13 10 24 8 C 32 5 42 8 48 15 ' +
  'C 50 12 55 9 62 9 C 71 9 82 14 89 24 ' +
  'C 96 33 95 48 88 59 C 81 69 67 75 57 77 Z';

// Grid layout: 5 columnas (x=8,24,40,56,72), 5 filas (y=9,25,41,57,71)
// Tamaño de cada cuadrado: 14×14 px
// Colores ordenados de oscuro (arriba) a claro (abajo), rojo en col 3, fila 2
const SQ = 14;
const GRID: { x: number; y: number; fill: string }[] = [
  // Fila 0 — los más oscuros (K:60%)
  { x: 24, y:  9, fill: '#636363' },
  { x: 40, y:  9, fill: '#5A5A5A' },
  { x: 56, y:  9, fill: '#686868' },

  // Fila 1 — oscuro medio (K:50–55%)
  { x:  8, y: 25, fill: '#787878' },
  { x: 24, y: 25, fill: '#5F5F5F' },
  { x: 40, y: 25, fill: '#565656' },
  { x: 56, y: 25, fill: '#626262' },
  { x: 72, y: 25, fill: '#888888' },

  // Fila 2 — medio + rojo de marca
  { x:  8, y: 41, fill: '#828282' },
  { x: 24, y: 41, fill: '#6C6C6C' },
  { x: 40, y: 41, fill: '#747474' },
  { x: 56, y: 41, fill: '#D4162A' }, // ← Rojo corporativo
  { x: 72, y: 41, fill: '#939393' },

  // Fila 3 — gris claro (K:20–30%)
  { x:  8, y: 57, fill: '#9C9C9C' },
  { x: 24, y: 57, fill: '#979797' },
  { x: 40, y: 57, fill: '#9A9A9A' },
  { x: 56, y: 57, fill: '#A3A3A3' },
  { x: 72, y: 57, fill: '#ABABAB' },

  // Fila 4 — los más claros (K:10–20%)
  { x: 24, y: 71, fill: '#B8B8B8' },
  { x: 40, y: 71, fill: '#B5B5B5' },
  { x: 56, y: 71, fill: '#BCBCBC' },
];

export default function NeuroficLogo({ size = 80, className }: Props): React.ReactElement {
  return (
    <svg
      viewBox="0 0 100 88"
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

      {/* Cuadrícula de identidad, recortada a la silueta */}
      <g clipPath="url(#nf-brain-clip)">
        {GRID.map((sq, i) => (
          <rect key={i} x={sq.x} y={sq.y} width={SQ} height={SQ} fill={sq.fill} rx="0.5" />
        ))}
      </g>
    </svg>
  );
}
