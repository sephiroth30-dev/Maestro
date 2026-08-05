/**
 * Presets del dialogo de exportacion y politica de acceso a valores.
 */

import type { Rol } from '../types/index.js';

export type PresetId = 'todo' | 'sin-valores' | 'solo-tablas' | 'resumen';

export interface ExportPreset {
  id: PresetId;
  label: string;
  hint: string;
}

export const PRESETS: ExportPreset[] = [
  { id: 'todo', label: 'Todo', hint: 'Incluye todas las secciones y columnas' },
  {
    id: 'sin-valores',
    label: 'Vista médicos (sin valores)',
    hint: 'Solo cantidades: oculta toda columna monetaria',
  },
  { id: 'solo-tablas', label: 'Solo tablas', hint: 'Omite las gráficas' },
  {
    id: 'resumen',
    label: 'Resumen ejecutivo',
    hint: 'Indicadores y gráficas, sin tablas de detalle',
  },
];

/**
 * Roles que NO pueden ver información financiera.
 *
 * Para ellos el modo "sin valores" es obligatorio, no una comodidad: el
 * dialogo bloquea las columnas monetarias y el generador las descarta aunque
 * la seleccion llegara manipulada.
 */
const ROLES_SIN_VALORES: readonly Rol[] = ['ADMISIONES'];

export function puedeVerValores(rol: string | undefined): boolean {
  if (!rol) return false;
  return !ROLES_SIN_VALORES.includes(rol as Rol);
}
