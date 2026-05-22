import type { Conector, Sincronizacion, EstadoSync, TipoConector } from '@prisma/client';
import { prisma } from '../config/prisma.js';

// ─── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateConectorData {
  nombre: string;
  tipo: TipoConector;
  config: Record<string, unknown>;
  frecuenciaSync?: string;
}

export interface UpdateConectorData {
  nombre?: string;
  config?: Record<string, unknown>;
  activo?: boolean;
  frecuenciaSync?: string;
  ultimaSync?: Date;
}

export interface CreateSincronizacionData {
  conectorId: string;
  estado: EstadoSync;
  filasLeidas?: number;
  filasNuevas?: number;
  errores?: Record<string, unknown>;
  finalizadaAt?: Date;
}

// ─── Explicit select shapes ───────────────────────────────────────────────────

const conectorSelect = {
  id: true,
  nombre: true,
  tipo: true,
  config: true,
  activo: true,
  frecuenciaSync: true,
  ultimaSync: true,
  createdAt: true,
  updatedAt: true,
} as const;

const sincronizacionSelect = {
  id: true,
  conectorId: true,
  estado: true,
  filasLeidas: true,
  filasNuevas: true,
  errores: true,
  iniciadaAt: true,
  finalizadaAt: true,
} as const;

// ─── Prisma-compatible types ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonInput = any;

// ─── Repository ───────────────────────────────────────────────────────────────

export class ConectoresRepository {
  // ─── Conector CRUD ────────────────────────────────────────────────────────

  async create(data: CreateConectorData): Promise<Conector> {
    return prisma.conector.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        config: data.config as JsonInput,
        frecuenciaSync: data.frecuenciaSync ?? 'daily',
      },
      select: conectorSelect,
    }) as unknown as Conector;
  }

  async findAll(): Promise<Conector[]> {
    return prisma.conector.findMany({
      select: conectorSelect,
      orderBy: { createdAt: 'desc' },
    }) as unknown as Conector[];
  }

  async findAllActive(): Promise<Conector[]> {
    return prisma.conector.findMany({
      where: { activo: true },
      select: conectorSelect,
      orderBy: { nombre: 'asc' },
    }) as unknown as Conector[];
  }

  async findById(id: string): Promise<Conector | null> {
    return prisma.conector.findUnique({
      where: { id },
      select: conectorSelect,
    }) as unknown as Conector | null;
  }

  async update(id: string, data: UpdateConectorData): Promise<Conector> {
    const updateData: Record<string, unknown> = {};
    if (data.nombre !== undefined) updateData['nombre'] = data.nombre;
    if (data.config !== undefined) updateData['config'] = data.config;
    if (data.activo !== undefined) updateData['activo'] = data.activo;
    if (data.frecuenciaSync !== undefined) updateData['frecuenciaSync'] = data.frecuenciaSync;
    if (data.ultimaSync !== undefined) updateData['ultimaSync'] = data.ultimaSync;

    return prisma.conector.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: updateData as any,
      select: conectorSelect,
    }) as unknown as Conector;
  }

  async softDelete(id: string): Promise<void> {
    await prisma.conector.update({
      where: { id },
      data: { activo: false },
    });
  }

  // ─── Sincronizaciones ─────────────────────────────────────────────────────

  async createSincronizacion(
    data: CreateSincronizacionData
  ): Promise<Sincronizacion> {
    return prisma.sincronizacion.create({
      data: {
        conectorId: data.conectorId,
        estado: data.estado,
        filasLeidas: data.filasLeidas ?? 0,
        filasNuevas: data.filasNuevas ?? 0,
        errores: data.errores !== undefined ? (data.errores as JsonInput) : undefined,
        finalizadaAt: data.finalizadaAt,
      },
      select: sincronizacionSelect,
    }) as unknown as Sincronizacion;
  }

  async updateSincronizacion(
    id: string,
    data: Partial<{
      estado: EstadoSync;
      filasLeidas: number;
      filasNuevas: number;
      errores: Record<string, unknown>;
      finalizadaAt: Date;
    }>
  ): Promise<Sincronizacion> {
    const updateData: Record<string, unknown> = {};
    if (data.estado !== undefined) updateData['estado'] = data.estado;
    if (data.filasLeidas !== undefined) updateData['filasLeidas'] = data.filasLeidas;
    if (data.filasNuevas !== undefined) updateData['filasNuevas'] = data.filasNuevas;
    if (data.errores !== undefined) updateData['errores'] = data.errores;
    if (data.finalizadaAt !== undefined) updateData['finalizadaAt'] = data.finalizadaAt;

    return prisma.sincronizacion.update({
      where: { id },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: updateData as any,
      select: sincronizacionSelect,
    }) as unknown as Sincronizacion;
  }

  async findSincronizacionesByConector(
    conectorId: string,
    limit = 20
  ): Promise<Sincronizacion[]> {
    return prisma.sincronizacion.findMany({
      where: { conectorId },
      select: sincronizacionSelect,
      orderBy: { iniciadaAt: 'desc' },
      take: limit,
    }) as unknown as Sincronizacion[];
  }
}

export const conectoresRepo = new ConectoresRepository();
