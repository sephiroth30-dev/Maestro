# Deploy en Hostinger

## Stack
- Backend: Node.js 22 + Fastify + Prisma (MySQL)
- Base de datos: MySQL en Hostinger
- Frontend: React (servido como estático desde el backend)

## Variables de entorno requeridas en Hostinger

Configurar en: Panel Hostinger → Variables de entorno

```
DATABASE_URL=mysql://u532609482_admin:PASSWORD@localhost:3306/u532609482_neuro_maestro
JWT_SECRET=genera-con: node -e "require('crypto').randomBytes(64).toString('hex')"
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
```

## Pasos de deploy

1. Configurar variables de entorno en Hostinger
2. Conectar repositorio GitHub (rama: main)
3. Build command: `npm install --prefix backend && npm install --prefix frontend && npm run build:frontend && cd backend && npx prisma generate && npm run build`
4. Start command: `cd backend && node dist/index.js`
5. Primera vez: ejecutar seed: `cd backend && npx tsx prisma/seed.ts`

## Migraciones

Las migraciones se aplican automáticamente al iniciar con:
```
npx prisma migrate deploy
```
