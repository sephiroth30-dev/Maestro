/**
 * Descriptor de exportacion de Capacidad instalada.
 *
 * La pantalla muestra tarjetas, no una tabla; el descriptor convierte
 * `UtilizacionGrupo[]` en filas. No hay una sola columna monetaria, asi que el
 * preset "Vista médicos" se oculta automaticamente.
 */

import type { UtilizacionGrupo } from '../../types/index.js';
import type { ExportDoc, ExportFilterChip } from '../types.js';
import { defineTable } from '../types.js';

export interface CapacidadDocInput {
  periodLabel: string;
  filters: ExportFilterChip[];
  grupos: UtilizacionGrupo[];
  kpis: { totalSesiones: number; totalCapacidad: number; pctGlobal: number | null; gruposConCap: number };
  estadoDe: (pct: number | null) => string;
}

export function buildCapacidadDoc(i: CapacidadDocInput): ExportDoc {
  return {
    fileBase: 'capacidad-instalada',
    title: 'Capacidad Instalada',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: i.filters,
    orientation: 'portrait',
    sections: [
      {
        kind: 'kpis',
        id: 'resumen',
        title: 'Resumen de utilizacion',
        items: [
          { label: 'Sesiones realizadas', value: i.kpis.totalSesiones, format: 'number' },
          { label: 'Capacidad total', value: i.kpis.totalCapacidad, format: 'number' },
          { label: 'Ocupación global', value: i.kpis.pctGlobal, format: 'percent' },
          { label: 'Grupos con capacidad definida', value: i.kpis.gruposConCap, format: 'number' },
        ],
      },
      defineTable<UtilizacionGrupo>({
        id: 'utilizacion',
        title: 'Utilización por servicio',
        note: 'Los grupos sin capacidad configurada aparecen sin porcentaje de ocupacion.',
        columns: [
          { key: 'nombre', header: 'Servicio', accessor: (r) => r.nombre, width: 32 },
          { key: 'grupo', header: 'Grupo', accessor: (r) => r.grupo, hidden: true },
          { key: 'capacidad', header: 'Capacidad', accessor: (r) => r.capacidad, format: 'number' },
          { key: 'sesiones', header: 'Sesiones', accessor: (r) => r.sesiones, format: 'number' },
          { key: 'pct', header: 'Ocupación', accessor: (r) => r.pctOcupacion, format: 'percent' },
          { key: 'disponible', header: 'Disponible', accessor: (r) => r.disponible, format: 'number' },
          { key: 'estado', header: 'Estado', accessor: (r) => i.estadoDe(r.pctOcupacion) },
        ],
        rows: i.grupos,
        totals: {
          label: 'TOTAL',
          values: {
            capacidad: i.kpis.totalCapacidad,
            sesiones: i.kpis.totalSesiones,
            pct: i.kpis.pctGlobal,
          },
        },
      }),
    ],
  };
}
