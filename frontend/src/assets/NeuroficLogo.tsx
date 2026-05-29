/**
 * NeuroficLogo — Logosímbolo corporativo de Neurofic.
 *
 * Reconstruido desde el Manual de Identidad Visual Corporativa Neurofic (PDF).
 * Colores extraídos directamente de los vectores del PDF:
 *   49% → #7D7C7E · 58% → #969696 · 66% → #AAAAAC
 *   75% → #C0BFC1 · 83% → #D5D4D5 · 92% → #EAEAEA
 *   Rojo corporativo rgb(93.72%, 7.84%, 25.10%) → #EF1440
 *   Fondo cerebro K:10% → #E6E6E6
 *
 * Vista: lateral izquierda del cerebro.
 *   - Lóbulo frontal (izquierda): el más alto.
 *   - Surco central: dip sutil en la parte superior.
 *   - Lóbulo parietal (derecha): ligeramente más bajo.
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
// Colores y posiciones extraídos del PDF vectorial del manual de identidad.
// Cuadrado rojo corporativo en columna 3 (x=122), fila 3 (y=118).

const SQ = 30;
const GRID: { x: number; y: number; fill: string }[] = [
  // — Fila 0 (y=16) · parcial superior · cols 1-3 ————————————————————
  { x:  54, y: 16, fill: '#D5D4D5' },  // 83%
  { x:  88, y: 16, fill: '#AAAAAC' },  // 66%
  { x: 122, y: 16, fill: '#7D7C7E' },  // 49%

  // — Fila 1 (y=50) · 5 columnas ——————————————————————————————————————
  { x:  20, y: 50, fill: '#969696' },  // 58%
  { x:  54, y: 50, fill: '#7D7C7E' },  // 49%
  { x:  88, y: 50, fill: '#D5D4D5' },  // 83%
  { x: 122, y: 50, fill: '#969696' },  // 58%
  { x: 156, y: 50, fill: '#C0BFC1' },  // 75%

  // — Fila 2 (y=84) · 5 columnas ——————————————————————————————————————
  { x:  20, y: 84, fill: '#D5D4D5' },  // 83%
  { x:  54, y: 84, fill: '#EAEAEA' },  // 92%
  { x:  88, y: 84, fill: '#7D7C7E' },  // 49%
  { x: 122, y: 84, fill: '#C0BFC1' },  // 75%
  { x: 156, y: 84, fill: '#AAAAAC' },  // 66%

  // — Fila 3 (y=118) · ROJO corporativo en col 3 ——————————————————————
  { x:  20, y: 118, fill: '#7D7C7E' }, // 49%
  { x:  54, y: 118, fill: '#C0BFC1' }, // 75%
  { x:  88, y: 118, fill: '#969696' }, // 58%
  { x: 122, y: 118, fill: '#EF1440' }, // ← Rojo corporativo
  { x: 156, y: 118, fill: '#EAEAEA' }, // 92%

  // — Fila 4 (y=152) · parcial inferior · cols 1, 3, 4 ————————————————
  { x:  54, y: 152, fill: '#D5D4D5' }, // 83%
  { x: 122, y: 152, fill: '#C0BFC1' }, // 75%
  { x: 156, y: 152, fill: '#969696' }, // 58%
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
