/**
 * Descriptor de exportación de Capacidad instalada.
 *
 * La pantalla muestra tarjetas, no una tabla; el descriptor convierte
 * `UtilizacionGrupo[]` en filas. No hay una sola columna monetaria, así que el
 * preset "Vista médicos" se oculta automáticamente.
 *
 * Las tablas llevan las columnas «Base», «Visitas» y «Estudios» además de la
 * demanda: sin ellas, un archivo exportado con 151 en Potenciales Evocados y 56
 * en otro grupo no permite saber que las dos cifras miden cosas distintas, que es
 * exactamente la confusión que este módulo tenía en pantalla.
 */

import type { UtilizacionGrupo } from '../../types/index.js';
import type { ExportDoc, ExportFilterChip } from '../types.js';
import { defineTable } from '../types.js';

/** Fila del histórico: la utilización de un grupo en un mes concreto. */
export interface FilaHistorico extends UtilizacionGrupo {
  anio: number;
  mesIdx: number;
}

/** Rótulo legible de la base, igual que en pantalla. */
const SUSTANTIVO: Record<UtilizacionGrupo['base'], string> = {
  pacientes: 'visitas',
  estudios: 'estudios',
};

export interface CapacidadDocInput {
  periodLabel: string;
  filters: ExportFilterChip[];
  grupos: UtilizacionGrupo[];
  kpis: {
    totalSesiones: number;
    totalVisitas: number;
    totalEstudios: number;
    totalSinPaciente: number;
    totalCapacidad: number;
    pctGlobal: number | null;
    gruposConCap: number;
  };
  estadoDe: (pct: number | null) => string;
  /** Presente en modo rango: una fila por grupo y mes. */
  historico?: FilaHistorico[];
  nombreMes?: (m: number) => string;
}

/** Columnas comunes a las dos tablas, para no repetir la definición. */
function columnasDemanda<T extends UtilizacionGrupo>(estadoDe: (p: number | null) => string) {
  return [
    { key: 'capacidad', header: 'Capacidad', accessor: (r: T) => r.capacidad, format: 'number' as const },
    { key: 'base', header: 'Base', accessor: (r: T) => SUSTANTIVO[r.base] },
    { key: 'sesiones', header: 'Demanda', accessor: (r: T) => r.sesiones, format: 'number' as const },
    { key: 'pacientes', header: 'Visitas', accessor: (r: T) => r.pacientes, format: 'number' as const },
    { key: 'estudios', header: 'Estudios', accessor: (r: T) => r.estudios, format: 'number' as const },
    { key: 'pct', header: 'Ocupación', accessor: (r: T) => r.pctOcupacion, format: 'percent' as const },
    { key: 'disponible', header: 'Disponible', accessor: (r: T) => r.disponible, format: 'number' as const },
    { key: 'estado', header: 'Estado', accessor: (r: T) => estadoDe(r.pctOcupacion) },
  ];
}

const NOTA_BASE =
  'La columna Base dice contra qué se compara la capacidad de cada grupo: «visitas» '
  + 'agrupa las atenciones del mismo paciente en la misma fecha (EMG y VCN en una cita '
  + 'ocupan un solo hueco de agenda); «estudios» cuenta los registros facturados '
  + '(en Potenciales Evocados una visita cubre varias modalidades). La columna Demanda '
  + 'repite la cifra de la base y es la que genera el porcentaje de ocupación.';

export function buildCapacidadDoc(i: CapacidadDocInput): ExportDoc {
  const notaSinPaciente = i.kpis.totalSinPaciente > 0
    ? ` ${i.kpis.totalSinPaciente} registros del período llegaron sin identificación de `
      + 'paciente: al no poder agruparse por visita, cada uno cuenta como una visita propia.'
    : '';

  return {
    fileBase: 'capacidad-instalada',
    title: 'Capacidad Instalada',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: i.filters,
    orientation: 'landscape',
    sections: [
      {
        kind: 'kpis',
        id: 'resumen',
        title: 'Resumen de utilización',
        items: [
          { label: 'Demanda total', value: i.kpis.totalSesiones, format: 'number' },
          { label: 'Visitas únicas', value: i.kpis.totalVisitas, format: 'number' },
          { label: 'Estudios facturados', value: i.kpis.totalEstudios, format: 'number' },
          { label: 'Capacidad total', value: i.kpis.totalCapacidad, format: 'number' },
          { label: 'Ocupación global', value: i.kpis.pctGlobal, format: 'percent' },
          { label: 'Grupos con capacidad definida', value: i.kpis.gruposConCap, format: 'number' },
        ],
      },
      ...(i.historico && i.historico.length > 0
        ? [
            defineTable<FilaHistorico>({
              id: 'historico',
              title: 'Utilización mes a mes',
              note:
                'Una fila por grupo y mes. Solo aparecen los meses con actividad o con '
                + `capacidad configurada. ${NOTA_BASE}`,
              columns: [
                {
                  key: 'periodo',
                  header: 'Período',
                  accessor: (r) => `${i.nombreMes ? i.nombreMes(r.mesIdx) : r.mesIdx} ${r.anio}`,
                  width: 18,
                },
                { key: 'nombre', header: 'Servicio', accessor: (r) => r.nombre, width: 30 },
                ...columnasDemanda<FilaHistorico>(i.estadoDe),
              ],
              rows: i.historico,
              totals: {
                label: 'TOTAL',
                values: {
                  capacidad: i.historico.reduce((s, r) => s + (r.capacidad ?? 0), 0),
                  sesiones: i.historico.reduce((s, r) => s + r.sesiones, 0),
                  pacientes: i.historico.reduce((s, r) => s + r.pacientes, 0),
                  estudios: i.historico.reduce((s, r) => s + r.estudios, 0),
                },
              },
            }),
          ]
        : []),
      defineTable<UtilizacionGrupo>({
        id: 'utilizacion',
        title: 'Utilización por servicio',
        note:
          'Los grupos sin capacidad configurada aparecen sin porcentaje de ocupación. '
          + NOTA_BASE + notaSinPaciente,
        columns: [
          { key: 'nombre', header: 'Servicio', accessor: (r) => r.nombre, width: 32 },
          { key: 'grupo', header: 'Grupo', accessor: (r) => r.grupo, hidden: true },
          ...columnasDemanda<UtilizacionGrupo>(i.estadoDe),
        ],
        rows: i.grupos,
        totals: {
          label: 'TOTAL',
          values: {
            capacidad: i.kpis.totalCapacidad,
            sesiones: i.kpis.totalSesiones,
            pacientes: i.kpis.totalVisitas,
            estudios: i.kpis.totalEstudios,
            pct: i.kpis.pctGlobal,
          },
        },
      }),
    ],
  };
}
