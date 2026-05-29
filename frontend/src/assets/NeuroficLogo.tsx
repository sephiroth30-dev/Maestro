/**
 * NeuroficLogo — Logosímbolo corporativo de Neurofic.
 *
 * Construido a partir del Manual de Identidad Visual Corporativa Neurofic.
 * Representa las pulsaciones del cerebro humano mediante una cuadrícula
 * de tonos grises con un cuadrado rojo de impacto.
 *
 * Paleta oficial (CMYK → HEX):
 *   K:60% #666666 · K:50% #808080 · K:20% #CCCCCC
 *   K:10% #E6E6E6 · Rojo C:0 M:100 Y:75 K:0 → #D4162A
 *
 * Vista: lateral izquierda del cerebro.
 *   - Lóbulo frontal (izquierda): el más alto.
 *   - Surco central: dip sutil en la parte superior.
 *   - Lóbulo parietal/occipital (derecha): ligeramente más bajo.
 *   - Extensión temporal: parte inferior izquierda prominente.
 */

import React from 'react';

interface Props {
  size?: number;
  className?: string;
}

// ViewBox 0 0 220 188
// Silueta trazada punto a punto sobre el logo original.
const BRAIN =
  'M 108 175 ' +
  // Inferior-izquierda (lóbulo temporal) → lado izquierdo subiendo
  'C 90 175 60 164 38 148 ' +
  'C 16 132 4 108 5 86 ' +
  // Lado izquierdo subiendo → inicio lóbulo frontal
  'C 6 64 16 48 30 38 ' +
  'C 42 28 58 20 72 15 ' +
  // CIMA del lóbulo frontal (izquierda, el más alto)
  'C 80 11 90 13 98 21 ' +
  // Surco central (dip sutil)
  'C 102 27 112 27 116 21 ' +
  // Lóbulo parietal (derecha, ligeramente más bajo que el frontal)
  'C 120 15 134 13 150 17 ' +
  // Lado derecho bajando
  'C 168 21 184 36 192 58 ' +
  'C 198 76 197 98 188 116 ' +
  // Inferior-derecha
  'C 178 134 162 148 144 156 ' +
  'C 130 164 118 170 108 175 ' +
  'Z';

// ── Cuadrícula ────────────────────────────────────────────────────────────────
// 5 columnas × 5 filas · cuadrado 30 px · separación 4 px · paso 34 px
// Columnas x: 20, 54, 88, 122, 156
// Filas    y: 16, 50, 84, 118, 152
//
// Gradiente cromático:
//   Centro-arriba: más oscuro (K 55-60%)
//   Bordes-abajo:  más claro  (K 10-20%)
// Cuadrado rojo corporativo en columna 3, fila 2

const SQ = 30;
const GRID: { x: number; y: number; fill: string }[] = [
  // — Fila 0 (y=16) · oscuro · parte superior, cols 1-3 visibles ————————
  { x:  54, y: 16, fill: '#6A6A6A' },
  { x:  88, y: 16, fill: '#5D5D5D' },
  { x: 122, y: 16, fill: '#696969' },

  // — Fila 1 (y=50) · oscuro medio · K 50-55% ——————————————————————————
  { x:  20, y: 50, fill: '#7C7C7C' },
  { x:  54, y: 50, fill: '#636363' },
  { x:  88, y: 50, fill: '#5A5A5A' },
  { x: 122, y: 50, fill: '#656565' },
  { x: 156, y: 50, fill: '#8A8A8A' },

  // — Fila 2 (y=84) · medio + ROJO corporativo en col 3 ————————————————
  { x:  20, y: 84, fill: '#7E7E7E' },
  { x:  54, y: 84, fill: '#6A6A6A' },
  { x:  88, y: 84, fill: '#6F6F6F' },
  { x: 122, y: 84, fill: '#D4162A' },   // ← Rojo corporativo
  { x: 156, y: 84, fill: '#939393' },

  // — Fila 3 (y=118) · gris claro · K 20-30% ——————————————————————————
  { x:  20, y: 118, fill: '#9A9A9A' },
  { x:  54, y: 118, fill: '#939393' },
  { x:  88, y: 118, fill: '#969696' },
  { x: 122, y: 118, fill: '#9E9E9E' },
  { x: 156, y: 118, fill: '#ABABAB' },

  // — Fila 4 (y=152) · muy claro · K 10% · parcialmente recortada ——————
  { x:  54, y: 152, fill: '#BABABA' },
  { x:  88, y: 152, fill: '#B7B7B7' },
  { x: 122, y: 152, fill: '#BEBEBE' },
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

      {/* Cuadrícula recortada a la silueta */}
      <g clipPath="url(#nf-brain-clip)">
        {GRID.map((sq, i) => (
          <rect
            key={i}
            x={sq.x}
            y={sq.y}
            width={SQ}
            height={SQ}
            fill={sq.fill}
          />
        ))}
      </g>
    </svg>
  );
}
