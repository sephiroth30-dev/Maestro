import { prisma } from '../config/prisma.js';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Types returned by raw repo queries ──────────────────────────────────────

export interface AggregadoMes {
  total: Decimal;
  atenciones: bigint;
}

export interface FacHoyResult {
  total: Decimal;
}

export interface DiasTranscurridosResult {
  dias: bigint;
}

export interface EntidadAggRow {
  entidad_id: string | null;
  nombre: string | null;
  tipo: string | null;
  es_grupo_caja: boolean | null;
  cantidad: bigint;
  valor_bruto: Decimal;
}

export interface FechasDelMes {
  fecha_dia: Date;
}

export interface TendenciaRow {
  anio: number;
  mes_idx: number;
  total: Decimal;
}

export interface PresupuestoRow {
  anio: number;
  mes: number;
  monto: Decimal;
  notas: string | null;
}

// ─── Repository ───────────────────────────────────────────────────────────────

/**
 * Gets the sum of valor_bruto and count of atenciones for a given month.
 */
export async function getAgregadoMes(
  mesIdx: number,
  anio: number,
  entidadId?: string
): Promise<{ total: number; atenciones: number }> {
  const where: Record<string, unknown> = { mesIdx, anio };
  if (entidadId) where['entidadId'] = entidadId;

  const result = await prisma.atencion.aggregate({
    where,
    _sum: { valorBruto: true },
    _count: { id: true },
  });

  return {
    total: Number(result._sum.valorBruto ?? 0),
    atenciones: result._count.id,
  };
}

/**
 * Gets the sum of valor_bruto for a specific day.
 */
export async function getFacturacionDia(fecha: Date): Promise<number> {
  const startOfDay = new Date(fecha);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(fecha);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const result = await prisma.atencion.aggregate({
    where: {
      fechaDia: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    _sum: { valorBruto: true },
  });

  return Number(result._sum.valorBruto ?? 0);
}

/**
 * Gets the count of distinct business days with at least one atencion in the given month.
 */
export async function getDiasTranscurridos(
  mesIdx: number,
  anio: number
): Promise<number> {
  type CountResult = { count: bigint };
  const rows = await prisma.$queryRaw<CountResult[]>`
    SELECT COUNT(DISTINCT "fecha_dia") AS count
    FROM "atenciones"
    WHERE "mes_idx" = ${mesIdx}
      AND "anio" = ${anio}
  `;
  return Number(rows[0]?.count ?? 0);
}

/**
 * Gets all distinct dates in a month (for week building).
 */
export async function getFechasDelMes(
  mesIdx: number,
  anio: number
): Promise<Date[]> {
  const rows = await prisma.atencion.findMany({
    where: { mesIdx, anio },
    select: { fechaDia: true },
    distinct: ['fechaDia'],
    orderBy: { fechaDia: 'asc' },
  });
  return rows.map((r) => r.fechaDia);
}

/**
 * Gets aggregated billing by entidad for a given month.
 */
export async function getEntidadesAgg(
  mesIdx: number,
  anio: number
): Promise<EntidadAggRow[]> {
  return prisma.$queryRaw<EntidadAggRow[]>`
    SELECT
      a."entidad_id",
      e."nombre",
      e."tipo",
      e."es_grupo_caja",
      COUNT(a."id") AS cantidad,
      SUM(a."valor_bruto") AS valor_bruto
    FROM "atenciones" a
    LEFT JOIN "entidades" e ON e."id" = a."entidad_id"
    WHERE a."mes_idx" = ${mesIdx}
      AND a."anio" = ${anio}
    GROUP BY a."entidad_id", e."nombre", e."tipo", e."es_grupo_caja"
    ORDER BY valor_bruto DESC
  `;
}

/**
 * Gets daily billing totals for a given month.
 */
export async function getDiariosDelMes(
  mesIdx: number,
  anio: number
): Promise<Array<{ fecha_dia: Date; total: Decimal; atenciones: bigint }>> {
  return prisma.$queryRaw`
    SELECT
      "fecha_dia",
      SUM("valor_bruto") AS total,
      COUNT("id") AS atenciones
    FROM "atenciones"
    WHERE "mes_idx" = ${mesIdx}
      AND "anio" = ${anio}
    GROUP BY "fecha_dia"
    ORDER BY "fecha_dia" ASC
  `;
}

/**
 * Gets day-of-week averages for all historic data in the given month span.
 */
export async function getDiasSemanaAgg(
  mesIdx: number,
  anio: number
): Promise<Array<{ dia_num: number; promedio: Decimal; total: Decimal; atenciones: bigint }>> {
  return prisma.$queryRaw`
    SELECT
      EXTRACT(DOW FROM "fecha_dia")::int AS dia_num,
      AVG("valor_bruto") AS promedio,
      SUM("valor_bruto") AS total,
      COUNT("id") AS atenciones
    FROM "atenciones"
    WHERE "mes_idx" = ${mesIdx}
      AND "anio" = ${anio}
    GROUP BY dia_num
    ORDER BY dia_num ASC
  `;
}

/**
 * Gets monthly totals for the last N months (for trend chart).
 */
export async function getTendenciaMeses(
  meses: number
): Promise<Array<{ anio: number; mes_idx: number; total: Decimal }>> {
  return prisma.$queryRaw`
    SELECT
      "anio",
      "mes_idx",
      SUM("valor_bruto") AS total
    FROM "atenciones"
    GROUP BY "anio", "mes_idx"
    ORDER BY "anio" ASC, "mes_idx" ASC
    LIMIT ${meses}
  `;
}

/**
 * Gets a presupuesto by anio and mes.
 */
export async function getPresupuesto(anio: number, mes: number): Promise<number> {
  const row = await prisma.presupuestoMensual.findUnique({
    where: { anio_mes: { anio, mes } },
    select: { monto: true },
  });
  return Number(row?.monto ?? 0);
}

/**
 * Lists all presupuestos.
 */
export async function listPresupuestos(): Promise<
  Array<{ id: string; anio: number; mes: number; monto: number; notas: string | null; createdAt: Date }>
> {
  const rows = await prisma.presupuestoMensual.findMany({
    select: { id: true, anio: true, mes: true, monto: true, notas: true, createdAt: true },
    orderBy: [{ anio: 'asc' }, { mes: 'asc' }],
  });
  return rows.map((r) => ({ ...r, monto: Number(r.monto) }));
}

/**
 * Upserts a presupuesto (create or update by anio+mes).
 */
export async function upsertPresupuesto(
  anio: number,
  mes: number,
  monto: number,
  notas?: string
): Promise<{ id: string; anio: number; mes: number; monto: number; notas: string | null }> {
  const existing = await prisma.presupuestoMensual.findUnique({
    where: { anio_mes: { anio, mes } },
    select: { id: true },
  });

  if (existing) {
    const updated = await prisma.presupuestoMensual.update({
      where: { id: existing.id },
      data: { monto, notas: notas ?? null },
      select: { id: true, anio: true, mes: true, monto: true, notas: true },
    });
    return { ...updated, monto: Number(updated.monto) };
  }

  const created = await prisma.presupuestoMensual.create({
    data: { anio, mes, monto, notas: notas ?? null },
    select: { id: true, anio: true, mes: true, monto: true, notas: true },
  });
  return { ...created, monto: Number(created.monto) };
}
