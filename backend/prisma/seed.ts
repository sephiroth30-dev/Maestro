import { PrismaClient, Rol, TipoEntidad } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { normalizeDescripcion, hashFila } from '../src/services/normalizacion.service.js';

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  nombre: string;
  rol: Rol;
}

const SEED_USERS: SeedUser[] = [
  { email: 'admin@neurofic.com', nombre: 'Administrador', rol: Rol.ADMIN },
  { email: 'gerencia@neurofic.com', nombre: 'Gerencia', rol: Rol.GERENCIA },
  { email: 'direccion@neurofic.com', nombre: 'Dirección', rol: Rol.DIRECCION },
  { email: 'facturacion@neurofic.com', nombre: 'Facturación', rol: Rol.FACTURACION },
  { email: 'coordinadora@neurofic.com', nombre: 'Coordinadora', rol: Rol.COORDINADORA },
  { email: 'admisiones@neurofic.com', nombre: 'Admisiones', rol: Rol.ADMISIONES },
];

const SEED_PASSWORD = 'Neurofic2026!';
const BCRYPT_ROUNDS = 12;

// ─── Entidades seed data ──────────────────────────────────────────────────────

interface SeedEntidad {
  nombre: string;
  nombresRaw: string[];
  tipo: TipoEntidad;
  esGrupoCaja?: boolean;
}

const SEED_ENTIDADES: SeedEntidad[] = [
  { nombre: 'COMFAMILIAR',   nombresRaw: ['COMFAMILIAR', 'COMFAMILIAR RISARALDA'], tipo: TipoEntidad.EPS },
  { nombre: 'SANITAS',       nombresRaw: ['SANITAS', 'EPS SANITAS'],               tipo: TipoEntidad.EPS },
  { nombre: 'SURAMERICANA',  nombresRaw: ['SURAMERICANA', 'EPS SURA', 'SURAMERCIANA'], tipo: TipoEntidad.EPS },
  { nombre: 'NUEVA EPS',     nombresRaw: ['NUEVA EPS', 'NUEVAEPS'],                tipo: TipoEntidad.EPS },
  { nombre: 'VIVA 1A',       nombresRaw: ['VIVA 1A', 'VIVA1A', 'VIVA'],           tipo: TipoEntidad.EPS },
  { nombre: 'COMPENSAR',     nombresRaw: ['COMPENSAR'],                            tipo: TipoEntidad.EPS },
  { nombre: 'FAMISANAR',     nombresRaw: ['FAMISANAR'],                            tipo: TipoEntidad.EPS },
  { nombre: 'MEDIMAS',       nombresRaw: ['MEDIMAS', 'MÉDIMAS'],                   tipo: TipoEntidad.EPS },
  { nombre: 'SURA',          nombresRaw: ['SURA', 'EPS SURA'],                     tipo: TipoEntidad.EPS },
  { nombre: 'ALIANSALUD',    nombresRaw: ['ALIANSALUD', 'ALIAN SALUD'],            tipo: TipoEntidad.EPS },
  { nombre: 'DALELA',        nombresRaw: ['DALELA'],                               tipo: TipoEntidad.CONVENIO },
  { nombre: 'CONVENIO EMPRESARIAL', nombresRaw: ['CONVENIO EMPRESARIAL', 'CONVENIO'], tipo: TipoEntidad.CONVENIO },
  { nombre: 'PARTICULARES',  nombresRaw: ['PARTICULARES', 'PARTICULAR'],           tipo: TipoEntidad.PARTICULAR, esGrupoCaja: true },
  { nombre: 'PARTICULAR',    nombresRaw: ['PARTICULAR', 'PART'],                   tipo: TipoEntidad.PARTICULAR, esGrupoCaja: true },
];

// ─── Profesionales seed data ──────────────────────────────────────────────────

interface SeedProfesional {
  nombre: string;
  nombresRaw: string[];
  esNomina: boolean;
}

const SEED_PROFESIONALES: SeedProfesional[] = [
  { nombre: 'PERLAZA',  nombresRaw: ['PERLAZA', 'DR PERLAZA'],  esNomina: true },
  { nombre: 'LAVERDE',  nombresRaw: ['LAVERDE', 'DRA LAVERDE'], esNomina: true },
  { nombre: 'ESCOBAR',  nombresRaw: ['ESCOBAR', 'DR ESCOBAR'],  esNomina: true },
  { nombre: 'TERAN',    nombresRaw: ['TERAN', 'DRA TERAN'],     esNomina: true },
  { nombre: 'MONTAÑO',  nombresRaw: ['MONTAÑO', 'DR MONTAÑO'],  esNomina: true },
  { nombre: 'PARADA',   nombresRaw: ['PARADA', 'DR PARADA'],    esNomina: true },
  { nombre: 'YOLIMA',   nombresRaw: ['YOLIMA', 'DRA YOLIMA'],   esNomina: true },
  { nombre: 'CRUZ',     nombresRaw: ['CRUZ', 'DR CRUZ'],         esNomina: true },
  { nombre: 'CONCHA',   nombresRaw: ['CONCHA', 'DRA CONCHA'],   esNomina: true },
];

// ─── Presupuestos 2026 ────────────────────────────────────────────────────────

const PRESUPUESTOS_2026: Array<{ mes: number; monto: number }> = [
  { mes: 1,  monto: 263733553 },
  { mes: 2,  monto: 290106909 },
  { mes: 3,  monto: 319117600 },
  { mes: 4,  monto: 319117600 },
  { mes: 5,  monto: 357411711 },
  { mes: 6,  monto: 357411711 },
  { mes: 7,  monto: 375282297 },
  { mes: 8,  monto: 375282297 },
  { mes: 9,  monto: 375282297 },
  { mes: 10, monto: 375282297 },
  { mes: 11, monto: 375282297 },
  { mes: 12, monto: 375282297 },
];

// ─── Sample atenciones mayo 2026 ─────────────────────────────────────────────

interface SampleAtencion {
  descripcionRaw: string;
  fecha: string;
  autorizacion: string;
  entidadNombre: string;
  profesionalNombre: string;
  valor: number;
}

const SAMPLE_ATENCIONES: SampleAtencion[] = [
  { descripcionRaw: 'CONSULTA MEDICINA ESPECIALIZADA NEUROLOGIA NUA 2025001', fecha: '2026-05-02', autorizacion: 'AUT001', entidadNombre: 'SANITAS',      profesionalNombre: 'PERLAZA',  valor: 145000 },
  { descripcionRaw: 'ELECTROENCEFALOGRAMA DE RUTINA ESTADO REPOSO',           fecha: '2026-05-02', autorizacion: 'AUT002', entidadNombre: 'NUEVA EPS',    profesionalNombre: 'LAVERDE',  valor: 320000 },
  { descripcionRaw: 'CONSULTA CONTROL NEUROLOGIA PEDIATRICA',                 fecha: '2026-05-02', autorizacion: 'AUT003', entidadNombre: 'COMPENSAR',    profesionalNombre: 'ESCOBAR',  valor: 135000 },
  { descripcionRaw: 'POTENCIAL EVOCADO AUDITIVO DE TALLO CEREBRAL',           fecha: '2026-05-02', autorizacion: 'AUT004', entidadNombre: 'SURAMERICANA', profesionalNombre: 'TERAN',    valor: 480000 },
  { descripcionRaw: 'CONSULTA PRIMERA VEZ NEUROLOGIA ADULTOS',                fecha: '2026-05-02', autorizacion: 'AUT005', entidadNombre: 'FAMISANAR',    profesionalNombre: 'MONTAÑO',  valor: 160000 },
  { descripcionRaw: 'ELECTROENCEFALOGRAMA DE 30 MINUTOS MM',                  fecha: '2026-05-02', autorizacion: 'AUT006', entidadNombre: 'COMFAMILIAR',  profesionalNombre: 'PARADA',   valor: 295000 },
  { descripcionRaw: 'VIDEOTELEENCEFALOGRAMA AMBULATORIO 24 HORAS',            fecha: '2026-05-02', autorizacion: 'AUT007', entidadNombre: 'MEDIMAS',      profesionalNombre: 'YOLIMA',   valor: 850000 },
  { descripcionRaw: 'CONSULTA SEGUIMIENTO EPILEPSIA',                         fecha: '2026-05-02', autorizacion: 'AUT008', entidadNombre: 'VIVA 1A',      profesionalNombre: 'CRUZ',     valor: 130000 },
  { descripcionRaw: 'POTENCIAL EVOCADO VISUAL DE PATRON INVERSO',             fecha: '2026-05-02', autorizacion: 'AUT009', entidadNombre: 'ALIANSALUD',   profesionalNombre: 'CONCHA',   valor: 380000 },
  { descripcionRaw: 'CONSULTA NEUROPSICOLOGIA EVALUACION',                    fecha: '2026-05-02', autorizacion: 'AUT010', entidadNombre: 'PARTICULARES', profesionalNombre: 'PERLAZA',  valor: 220000 },
  // May 5 - business day 2
  { descripcionRaw: 'CONSULTA MEDICINA ESPECIALIZADA NEUROLOGIA CONTROL',     fecha: '2026-05-05', autorizacion: 'AUT011', entidadNombre: 'SURA',         profesionalNombre: 'LAVERDE',  valor: 145000 },
  { descripcionRaw: 'ELECTROENCEFALOGRAMA POLISOMNOGRAFIA NOCTURNA',          fecha: '2026-05-05', autorizacion: 'AUT012', entidadNombre: 'SANITAS',      profesionalNombre: 'ESCOBAR',  valor: 720000 },
  { descripcionRaw: 'CONSULTA CONTROL TRASTORNO MOVIMIENTO',                  fecha: '2026-05-05', autorizacion: 'AUT013', entidadNombre: 'NUEVA EPS',    profesionalNombre: 'TERAN',    valor: 140000 },
  { descripcionRaw: 'NEUROGRAFIA DE NERVIO MEDIANO BILATERAL',                fecha: '2026-05-05', autorizacion: 'AUT014', entidadNombre: 'COMPENSAR',    profesionalNombre: 'MONTAÑO',  valor: 410000 },
  { descripcionRaw: 'CONSULTA PRIMERA VEZ NEUROLOGIA PEDIATRICA',             fecha: '2026-05-05', autorizacion: 'AUT015', entidadNombre: 'DALELA',       profesionalNombre: 'PARADA',   valor: 175000 },
  { descripcionRaw: 'ELECTROENCEFALOGRAMA VIGILIA Y SUENO 2 HORAS',           fecha: '2026-05-05', autorizacion: 'AUT016', entidadNombre: 'FAMISANAR',    profesionalNombre: 'YOLIMA',   valor: 340000 },
  { descripcionRaw: 'CONSULTA CONTROL CEFALEA MIGRAÑA ESTADO',                fecha: '2026-05-05', autorizacion: 'AUT017', entidadNombre: 'COMFAMILIAR',  profesionalNombre: 'CRUZ',     valor: 125000 },
  { descripcionRaw: 'POTENCIAL EVOCADO SOMATOSENSORIAL NERVIO TIBIAL',        fecha: '2026-05-05', autorizacion: 'AUT018', entidadNombre: 'SURAMERICANA', profesionalNombre: 'CONCHA',   valor: 430000 },
  { descripcionRaw: 'CONSULTA PRIMERA VEZ PSICOLOGIA CLINICA',                fecha: '2026-05-05', autorizacion: 'AUT019', entidadNombre: 'PARTICULARES', profesionalNombre: 'PERLAZA',  valor: 95000  },
  { descripcionRaw: 'ATENCION TELEMETRIA MONITOREO CEREBRAL',                 fecha: '2026-05-05', autorizacion: 'AUT020', entidadNombre: 'ALIANSALUD',   profesionalNombre: 'LAVERDE',  valor: 580000 },
  // May 6 - business day 3
  { descripcionRaw: 'CONSULTA NEUROLOGIA CONTROL SEGUIMIENTO',                fecha: '2026-05-06', autorizacion: 'AUT021', entidadNombre: 'MEDIMAS',      profesionalNombre: 'ESCOBAR',  valor: 135000 },
  { descripcionRaw: 'ELECTROMIOGRAFIA MIEMBRO SUPERIOR DERECHO MM',           fecha: '2026-05-06', autorizacion: 'AUT022', entidadNombre: 'VIVA 1A',      profesionalNombre: 'TERAN',    valor: 390000 },
  { descripcionRaw: 'CONSULTA PRIMERA VEZ NEUROLOGIA ADULTOS DE CONTROL',     fecha: '2026-05-06', autorizacion: 'AUT023', entidadNombre: 'SURA',         profesionalNombre: 'MONTAÑO',  valor: 155000 },
  { descripcionRaw: 'POLISOMNOGRAFIA DIAGNOSTICA COMPLETA NOCTURNA',          fecha: '2026-05-06', autorizacion: 'AUT024', entidadNombre: 'SANITAS',      profesionalNombre: 'PARADA',   valor: 780000 },
  { descripcionRaw: 'CONSULTA CONTROL NEUROLOGIA ELECTROENCEFALOGRAMA',       fecha: '2026-05-06', autorizacion: 'AUT025', entidadNombre: 'NUEVA EPS',    profesionalNombre: 'YOLIMA',   valor: 145000 },
  { descripcionRaw: 'NEUROGRAFIA VELOCIDAD DE CONDUCCION SENSITIVA',          fecha: '2026-05-06', autorizacion: 'AUT026', entidadNombre: 'COMPENSAR',    profesionalNombre: 'CRUZ',     valor: 360000 },
  { descripcionRaw: 'CONSULTA PSIQUIATRIA PRIMERA VEZ',                       fecha: '2026-05-06', autorizacion: 'AUT027', entidadNombre: 'CONVENIO EMPRESARIAL', profesionalNombre: 'CONCHA', valor: 190000 },
  { descripcionRaw: 'ELECTROENCEFALOGRAMA CUANTITATIVO MAPEO CEREBRAL',       fecha: '2026-05-06', autorizacion: 'AUT028', entidadNombre: 'FAMISANAR',    profesionalNombre: 'PERLAZA',  valor: 520000 },
  { descripcionRaw: 'CONSULTA CONTROL PARKINSON TEMBLOR ESENCIAL',            fecha: '2026-05-06', autorizacion: 'AUT029', entidadNombre: 'COMFAMILIAR',  profesionalNombre: 'LAVERDE',  valor: 145000 },
  { descripcionRaw: 'TEST NEUROPSICOLOGICO EVALUACION COGNITIVA COMPLETA',    fecha: '2026-05-06', autorizacion: 'AUT030', entidadNombre: 'PARTICULARES', profesionalNombre: 'ESCOBAR',  valor: 280000 },
];

async function main(): Promise<void> {
  console.log('Starting database seed...');

  // ─── Users ─────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  for (const user of SEED_USERS) {
    const upserted = await prisma.usuario.upsert({
      where: { email: user.email },
      update: {
        nombre: user.nombre,
        rol: user.rol,
        activo: true,
        deletedAt: null,
        passwordHash,
      },
      create: {
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        passwordHash,
        activo: true,
      },
    });
    console.log(`Upserted user: ${upserted.email} (${upserted.rol})`);
  }

  // ─── Entidades ─────────────────────────────────────────────────────────────
  for (const entidad of SEED_ENTIDADES) {
    const existing = await prisma.entidad.findFirst({ where: { nombre: entidad.nombre }, select: { id: true } });
    if (existing) {
      await prisma.entidad.update({
        where: { id: existing.id },
        data: {
          nombresRaw: entidad.nombresRaw,
          tipo: entidad.tipo,
          esGrupoCaja: entidad.esGrupoCaja ?? false,
          activa: true,
        },
      });
    } else {
      await prisma.entidad.create({
        data: {
          nombre: entidad.nombre,
          nombresRaw: entidad.nombresRaw,
          tipo: entidad.tipo,
          esGrupoCaja: entidad.esGrupoCaja ?? false,
          activa: true,
        },
      });
    }
    console.log(`Upserted entidad: ${entidad.nombre} (${entidad.tipo})`);
  }

  // ─── Profesionales ─────────────────────────────────────────────────────────
  for (const prof of SEED_PROFESIONALES) {
    const existing = await prisma.profesional.findFirst({ where: { nombre: prof.nombre }, select: { id: true } });
    if (existing) {
      await prisma.profesional.update({
        where: { id: existing.id },
        data: {
          nombresRaw: prof.nombresRaw,
          esNomina: prof.esNomina,
          activo: true,
        },
      });
    } else {
      await prisma.profesional.create({
        data: {
          nombre: prof.nombre,
          nombresRaw: prof.nombresRaw,
          esNomina: prof.esNomina,
          activo: true,
        },
      });
    }
    console.log(`Upserted profesional: ${prof.nombre}`);
  }

  // ─── Presupuestos 2026 ─────────────────────────────────────────────────────
  for (const pres of PRESUPUESTOS_2026) {
    const existing = await prisma.presupuestoMensual.findUnique({
      where: { anio_mes: { anio: 2026, mes: pres.mes } },
      select: { id: true },
    });
    if (existing) {
      await prisma.presupuestoMensual.update({
        where: { id: existing.id },
        data: { monto: pres.monto },
      });
    } else {
      await prisma.presupuestoMensual.create({
        data: { anio: 2026, mes: pres.mes, monto: pres.monto },
      });
    }
    console.log(`Upserted presupuesto 2026-${String(pres.mes).padStart(2, '0')}: $${pres.monto.toLocaleString('es-CO')}`);
  }

  // ─── Sample Atenciones mayo 2026 ──────────────────────────────────────────
  let atencionesCreated = 0;
  let atencionesSkipped = 0;

  for (const sample of SAMPLE_ATENCIONES) {
    const entidad = await prisma.entidad.findFirst({
      where: { nombre: sample.entidadNombre },
      select: { id: true },
    });
    const profesional = await prisma.profesional.findFirst({
      where: { nombre: sample.profesionalNombre },
      select: { id: true },
    });

    if (!entidad || !profesional) {
      console.warn(`Skipping atencion: entidad or profesional not found for ${sample.descripcionRaw}`);
      continue;
    }

    const hash = hashFila({
      descripcionRaw: sample.descripcionRaw,
      autorizacion: sample.autorizacion,
      entidad: sample.entidadNombre,
      profesional: sample.profesionalNombre,
      valor: String(sample.valor),
      fecha: sample.fecha,
    });

    const existing = await prisma.atencion.findUnique({ where: { hashFila: hash }, select: { id: true } });
    if (existing) {
      atencionesSkipped++;
      continue;
    }

    const fechaDia = new Date(sample.fecha + 'T00:00:00.000Z');

    await prisma.atencion.create({
      data: {
        descripcionRaw: sample.descripcionRaw,
        descripcionNorm: normalizeDescripcion(sample.descripcionRaw),
        fechaDia,
        mesIdx: 5,
        anio: 2026,
        valorBruto: sample.valor,
        numeroAutorizacion: sample.autorizacion,
        esTelemetria: sample.descripcionRaw.toUpperCase().includes('TELEMETRIA'),
        hashFila: hash,
        entidadId: entidad.id,
        profesionalId: profesional.id,
      },
    });
    atencionesCreated++;
  }

  console.log(`Atenciones: ${atencionesCreated} created, ${atencionesSkipped} skipped (duplicates)`);
  console.log('Seed completed successfully.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
