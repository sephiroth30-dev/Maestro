/**
 * Descriptor de exportacion de Auditoria.
 *
 * Unica pagina cuyos datos NO estan completos en el cliente: la API pagina de
 * a 50 y el backend limita `limit` a 200. Por eso la pagina puede pasar filas
 * ya reunidas por `fetchAuditoriaAll` en vez de las de la pagina actual.
 */

import type { AuditLog } from '../../types/index.js';
import type { ExportDoc, ExportFilterChip } from '../types.js';
import { defineTable } from '../types.js';

export interface AuditoriaDocInput {
  periodLabel: string;
  filters: ExportFilterChip[];
  rows: AuditLog[];
  note?: string;
  labelAccion: (a: string) => string;
}

export function buildAuditoriaDoc(i: AuditoriaDocInput): ExportDoc {
  return {
    fileBase: 'auditoria',
    title: 'Registro de Auditoría',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: i.filters,
    // 8 columnas y un campo de detalle largo: vertical no alcanza.
    orientation: 'landscape',
    sections: [
      defineTable<AuditLog>({
        id: 'auditoria',
        title: 'Eventos',
        note: i.note,
        columns: [
          { key: 'fecha', header: 'Fecha y hora', accessor: (r) => r.createdAt, format: 'datetime', width: 20 },
          { key: 'usuario', header: 'Usuario', accessor: (r) => r.usuarioNombre ?? '(sistema)', width: 24 },
          { key: 'email', header: 'Correo', accessor: (r) => r.usuarioEmail ?? '', width: 28, hidden: true },
          { key: 'acción', header: 'Acción', accessor: (r) => i.labelAccion(r.accion), width: 24 },
          { key: 'entidad', header: 'Entidad', accessor: (r) => r.entidadTipo ?? '', width: 18 },
          { key: 'entidad_id', header: 'ID entidad', accessor: (r) => r.entidadId ?? '', width: 34, hidden: true },
          {
            key: 'detalle',
            header: 'Detalle',
            accessor: (r) => (r.detalle ? JSON.stringify(r.detalle) : ''),
            width: 60,
          },
          { key: 'ip', header: 'IP', accessor: (r) => r.ip ?? '', width: 16 },
        ],
        rows: i.rows,
      }),
    ],
  };
}
