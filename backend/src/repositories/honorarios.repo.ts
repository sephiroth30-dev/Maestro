import { pool } from '../config/prisma.js';
import type { RowDataPacket } from 'mysql2';

export interface HonorariosLineaDB {
  profesional_id: string;
  profesional_nombre: string;       // internal key: PERLAZA, LAVERDE, …
  profesional_display: string;      // nombre_completo ?? nombre
  servicio_nombre: string | null;
  servicio_tipo_conteo: string;
  entidad_tipo: string | null;      // 'EPS' | 'PARTICULAR' | 'CONVENIO' | …
  entidad_nombre: string | null;    // needed for NUEVA EPS / VIVA 1A / DALELA
  cnt: number;                      // raw atencion rows
  cnt_sesiones: number;             // distinct patient+date (for tipo_conteo='sesion')
  total_valor: number;              // SUM(valor_bruto) for % calculations
}

export async function getLineasHonorarios(
  mesIdx: number,
  anio: number,
): Promise<HonorariosLineaDB[]> {
  const [rows] = await pool.query<(RowDataPacket & HonorariosLineaDB)[]>(
    `SELECT
        p.id                                                  AS profesional_id,
        p.nombre                                              AS profesional_nombre,
        COALESCE(p.nombre_completo, p.nombre)                 AS profesional_display,
        s.nombre                                              AS servicio_nombre,
        COALESCE(s.tipo_conteo, 'unidad')                     AS servicio_tipo_conteo,
        e.tipo                                                AS entidad_tipo,
        e.nombre                                              AS entidad_nombre,
        COUNT(*)                                              AS cnt,
        COUNT(DISTINCT CONCAT(
            COALESCE(a.paciente_documento, a.paciente_nombre, a.id),
            '|',
            DATE(a.fecha_dia)
        ))                                                    AS cnt_sesiones,
        CAST(SUM(a.valor_bruto) AS DECIMAL(15,2))             AS total_valor
     FROM atenciones a
     INNER JOIN profesionales p ON p.id = a.profesional_id
     LEFT  JOIN servicios     s ON s.id = a.servicio_id
     LEFT  JOIN entidades     e ON e.id = a.entidad_id
     WHERE a.mes_idx = ? AND a.anio = ? AND a.profesional_id IS NOT NULL
     GROUP BY
        p.id, p.nombre, p.nombre_completo,
        s.nombre, s.tipo_conteo,
        e.tipo, e.nombre
     ORDER BY p.nombre, s.nombre`,
    [mesIdx, anio],
  );

  return rows.map((r) => ({
    profesional_id:       r.profesional_id,
    profesional_nombre:   r.profesional_nombre,
    profesional_display:  r.profesional_display,
    servicio_nombre:      r.servicio_nombre ?? null,
    servicio_tipo_conteo: r.servicio_tipo_conteo ?? 'unidad',
    entidad_tipo:         r.entidad_tipo ?? null,
    entidad_nombre:       r.entidad_nombre ?? null,
    cnt:          Number(r.cnt),
    cnt_sesiones: Number(r.cnt_sesiones),
    total_valor:  Number(r.total_valor),
  }));
}
