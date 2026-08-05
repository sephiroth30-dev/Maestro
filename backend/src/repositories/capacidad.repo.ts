import { randomUUID } from 'node:crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '../config/prisma.js';
import { logger } from '../config/logger.js';
import { getKeyExpr, sqlLlaveVisita } from './paciente-key.js';
import {
  BASE_POR_GRUPO,
  sqlCatalogoGrupos,
  sqlClasificacionGrupo,
  sqlOrdenGrupos,
  type BaseConteo,
} from '../config/capacidad-grupos.js';

// ─── Row shapes from DB ───────────────────────────────────────────────────────

interface CapacidadRow extends RowDataPacket {
  id: string;
  grupo: string;
  nombre: string;
  anio: number;
  mes_idx: number;
  capacidad: number;
  recursos: string | null;
  base_conteo: BaseConteo | null;
  created_at: string;
  updated_at: string;
}

interface UtilizacionRow extends RowDataPacket {
  grupo: string;
  nombre: string;
  capacidad: number | null;
  base: BaseConteo | null;
  pacientes: number | string;
  estudios: number | string;
  sin_paciente: number | string;
}

// ─── Mapped return types ──────────────────────────────────────────────────────

export interface CapacidadMapped {
  id: string;
  grupo: string;
  nombre: string;
  anio: number;
  mesIdx: number;
  capacidad: number;
  recursos: string | null;
  baseConteo: BaseConteo | null;
  createdAt: string;
  updatedAt: string;
}

export interface UtilizacionMapped {
  grupo: string;
  nombre: string;
  capacidad: number | null;
  /** Qué cifra gobierna la ocupación de este grupo. */
  base: BaseConteo;
  /** Visitas únicas: paciente + día. */
  pacientes: number;
  /** Registros facturados. */
  estudios: number;
  /** Registros sin identificación de paciente, que no se pudieron deduplicar. */
  sinPaciente: number;
  /**
   * La cifra de la base — `estudios` o `pacientes` según el grupo.
   *
   * Se conserva el nombre `sesiones` porque es el que ya consumen la pantalla y
   * las exportaciones; ahora es explícitamente «la demanda que se compara contra
   * la capacidad», no «visitas únicas» como antes.
   */
  sesiones: number;
  pctOcupacion: number | null;
  disponible: number | null;
}

/** Una fila por grupo Y por mes: es lo que permite exportar el histórico. */
export interface UtilizacionMesMapped extends UtilizacionMapped {
  anio: number;
  mesIdx: number;
}

export interface UpsertCapacidadData {
  grupo: string;
  nombre: string;
  anio: number;
  mesIdx: number;
  capacidad: number;
  recursos?: string | null;
  baseConteo?: BaseConteo | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapCapacidad(row: CapacidadRow): CapacidadMapped {
  return {
    id: row.id,
    grupo: row.grupo,
    nombre: row.nombre,
    anio: row.anio,
    mesIdx: row.mes_idx,
    capacidad: row.capacidad,
    recursos: row.recursos,
    baseConteo: row.base_conteo ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUtilizacion(row: UtilizacionRow): UtilizacionMapped {
  const pacientes = Number(row.pacientes);
  const estudios = Number(row.estudios);
  const capacidad = row.capacidad != null ? Number(row.capacidad) : null;

  // La base viene resuelta del SQL cuando la columna existe; si no, se aplica
  // aquí el valor por omisión del catálogo.
  const base: BaseConteo = row.base ?? BASE_POR_GRUPO[row.grupo] ?? 'pacientes';
  const demanda = base === 'estudios' ? estudios : pacientes;

  // El porcentaje y el disponible se calculan en TypeScript y no en SQL: la
  // fórmula estaba repetida en las dos consultas y con dos bases habría hecho
  // falta un CASE anidado en cada una.
  const hayCapacidad = capacidad != null && capacidad > 0;

  return {
    grupo: row.grupo,
    nombre: row.nombre,
    capacidad,
    base,
    pacientes,
    estudios,
    sinPaciente: Number(row.sin_paciente),
    sesiones: demanda,
    pctOcupacion: hayCapacidad ? Math.round((demanda / capacidad) * 1000) / 10 : null,
    disponible: hayCapacidad ? capacidad - demanda : null,
  };
}

/**
 * ¿Existe `capacidad_instalada.base_conteo`?
 *
 * La migración que la añade puede no haber corrido: el runner registra el fallo
 * con un `logger.warn` y sigue. Sin esta sonda, un despliegue a medias dejaría
 * *toda* la pantalla de capacidad con error 500 en vez de degradarse a las bases
 * por omisión del catálogo.
 */
let sondaBase: Promise<boolean> | null = null;
async function tieneBaseConteo(): Promise<boolean> {
  if (sondaBase) return sondaBase;
  sondaBase = (async () => {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'capacidad_instalada'
           AND COLUMN_NAME = 'base_conteo' LIMIT 1`,
      );
      return rows.length > 0;
    } catch (err) {
      sondaBase = null; // fallo transitorio: se reintenta
      throw err;
    }
  })();
  return sondaBase;
}

/**
 * Subconsulta de demanda: por grupo, cuántos estudios y cuántas visitas.
 *
 * `extraCols` y `extraGroup` permiten reutilizarla para el rango, que además
 * agrupa por año y mes.
 */
function sqlDemanda(keyExpr: string, whereClause: string, extraCols = '', extraGroup = ''): string {
  return `SELECT
          ${extraCols}${sqlClasificacionGrupo('sv.nombre')} AS grupo,
          COUNT(a.id) AS estudios,
          COUNT(DISTINCT ${sqlLlaveVisita(keyExpr)}) AS pacientes,
          SUM(CASE WHEN ${keyExpr} IS NULL THEN 1 ELSE 0 END) AS sin_paciente
        FROM atenciones a
        JOIN servicios sv ON sv.id = a.servicio_id
        WHERE ${whereClause}
        GROUP BY ${extraGroup}grupo
        HAVING grupo IS NOT NULL`;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class CapacidadRepository {
  async upsert(data: UpsertCapacidadData): Promise<CapacidadMapped> {
    const id = randomUUID();
    const conBase = await tieneBaseConteo();

    const cols = ['id', 'grupo', 'nombre', 'anio', 'mes_idx', 'capacidad', 'recursos'];
    const vals: (string | number | null)[] = [
      id, data.grupo, data.nombre, data.anio, data.mesIdx, data.capacidad, data.recursos ?? null,
    ];
    const sets = ['nombre = VALUES(nombre)', 'capacidad = VALUES(capacidad)', 'recursos = VALUES(recursos)'];

    if (conBase) {
      cols.push('base_conteo');
      vals.push(data.baseConteo ?? null);
      sets.push('base_conteo = VALUES(base_conteo)');
    }

    await pool.execute<ResultSetHeader>(
      `INSERT INTO capacidad_instalada (${cols.join(', ')}, created_at, updated_at)
       VALUES (${cols.map(() => '?').join(', ')}, NOW(3), NOW(3))
       ON DUPLICATE KEY UPDATE ${sets.join(', ')}, updated_at = NOW(3)`,
      vals,
    );

    const [rows] = await pool.query<CapacidadRow[]>(
      'SELECT * FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ? LIMIT 1',
      [data.grupo, data.anio, data.mesIdx],
    );
    return mapCapacidad(rows[0]!);
  }

  async findByAnio(anio: number): Promise<CapacidadMapped[]> {
    const [rows] = await pool.query<CapacidadRow[]>(
      'SELECT * FROM capacidad_instalada WHERE anio = ? ORDER BY mes_idx ASC',
      [anio],
    );
    return rows.map(mapCapacidad);
  }

  async deleteOne(grupo: string, anio: number, mesIdx: number): Promise<void> {
    await pool.execute<ResultSetHeader>(
      'DELETE FROM capacidad_instalada WHERE grupo = ? AND anio = ? AND mes_idx = ?',
      [grupo, anio, mesIdx],
    );
  }

  /**
   * Utilización de un mes.
   *
   * Devuelve las DOS cifras de demanda —visitas y estudios— y cuál de ellas
   * gobierna la ocupación. Antes solo devolvía una, sin decir cuál era, y por eso
   * no se podía conciliar con «Mix por Servicio»: en Potenciales Evocados la
   * pantalla mostraba 56 (visitas) mientras el área reportaba 151 (estudios), y
   * ninguna de las dos era un error.
   */
  async getUtilizacion(anio: number, mesIdx: number): Promise<UtilizacionMapped[]> {
    const keyExpr = await getKeyExpr();
    const conBase = await tieneBaseConteo();
    const base = conBase ? 'COALESCE(ci.base_conteo, g.base_def)' : 'g.base_def';

    const [rows] = await pool.query<UtilizacionRow[]>(
      `SELECT
        g.grupo,
        g.nombre,
        ci.capacidad,
        ${base} AS base,
        COALESCE(s.pacientes, 0)    AS pacientes,
        COALESCE(s.estudios, 0)     AS estudios,
        COALESCE(s.sin_paciente, 0) AS sin_paciente
      FROM (
          ${sqlCatalogoGrupos()}
      ) g
      LEFT JOIN capacidad_instalada ci ON ci.grupo = g.grupo AND ci.anio = ? AND ci.mes_idx = ?
      LEFT JOIN (
        ${sqlDemanda(keyExpr, 'a.mes_idx = ? AND a.anio = ?')}
      ) s ON s.grupo = g.grupo
      ORDER BY ${sqlOrdenGrupos('g.grupo')}`,
      [anio, mesIdx, mesIdx, anio],
    );
    return rows.map(mapUtilizacion);
  }

  /**
   * Utilización mes a mes en un rango, para ver y exportar el histórico.
   *
   * Se resuelve en UNA consulta agrupando por (año, mes, grupo) en vez de
   * repetir la consulta mensual N veces: el conteo de visitas deduplica por
   * paciente y fecha, así que doce llamadas serían doce recorridos completos.
   *
   * Solo aparecen los meses con actividad o con capacidad configurada; un mes
   * enteramente vacío no genera filas.
   */
  async getUtilizacionRango(
    desdeAnio: number,
    desdeMes: number,
    hastaAnio: number,
    hastaMes: number,
  ): Promise<UtilizacionMesMapped[]> {
    // Se compara por (anio*12 + mes) para que el rango cruce el fin de año.
    const desde = desdeAnio * 12 + desdeMes;
    const hasta = hastaAnio * 12 + hastaMes;

    const keyExpr = await getKeyExpr();
    const conBase = await tieneBaseConteo();
    const base = conBase ? 'COALESCE(ci.base_conteo, p.base_def)' : 'p.base_def';

    const [rows] = await pool.query<(UtilizacionRow & { anio: number; mes_idx: number })[]>(
      `SELECT
        p.anio,
        p.mes_idx,
        p.grupo,
        p.nombre,
        ci.capacidad,
        ${base} AS base,
        COALESCE(s.pacientes, 0)    AS pacientes,
        COALESCE(s.estudios, 0)     AS estudios,
        COALESCE(s.sin_paciente, 0) AS sin_paciente
      FROM (
        -- Producto de los grupos por los meses que tienen algo: atenciones o
        -- capacidad configurada.
        SELECT g.grupo, g.nombre, g.base_def, m.anio, m.mes_idx
        FROM (
            ${sqlCatalogoGrupos()}
        ) g
        CROSS JOIN (
          SELECT DISTINCT anio, mes_idx FROM atenciones
          WHERE (anio * 12 + mes_idx) BETWEEN ? AND ?
          UNION
          SELECT DISTINCT anio, mes_idx FROM capacidad_instalada
          WHERE (anio * 12 + mes_idx) BETWEEN ? AND ?
        ) m
      ) p
      LEFT JOIN capacidad_instalada ci
        ON ci.grupo = p.grupo AND ci.anio = p.anio AND ci.mes_idx = p.mes_idx
      LEFT JOIN (
        ${sqlDemanda(
          keyExpr,
          '(a.anio * 12 + a.mes_idx) BETWEEN ? AND ?',
          'a.anio,\n          a.mes_idx,\n          ',
          'a.anio, a.mes_idx, ',
        )}
      ) s ON s.grupo = p.grupo AND s.anio = p.anio AND s.mes_idx = p.mes_idx
      ORDER BY p.anio, p.mes_idx, ${sqlOrdenGrupos('p.grupo')}`,
      [desde, hasta, desde, hasta, desde, hasta],
    );

    return rows.map((r) => ({
      ...mapUtilizacion(r),
      anio: Number(r.anio),
      mesIdx: Number(r.mes_idx),
    }));
  }
}

export const capacidadRepo = new CapacidadRepository();

/** Se expone para las pruebas: permite reiniciar las sondas entre casos. */
export function _resetSondasCapacidad(): void {
  sondaBase = null;
  logger.debug('Sondas de capacidad reiniciadas');
}
