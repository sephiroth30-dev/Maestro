import { PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

async function main(): Promise<void> {
  console.log('Starting database seed...');

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
