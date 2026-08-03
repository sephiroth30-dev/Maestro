# Neurofic Admin Dashboard

Panel de administración para clínica de salud privada en Colombia. Monorepo con backend API (Fastify + Prisma) y frontend (React + Vite).

## Descripción

Dashboard interno para el equipo administrativo de Neurofic. Centraliza KPIs operacionales, control de entidades, facturación y métricas de cumplimiento. Los datos se ingieren desde fuentes externas (Google Sheets, REST APIs) a través del sistema de conectores.

---

## Inicio rápido

### 1. Requisitos previos

- Node.js 20+
- Docker & Docker Compose
- npm 10+

### 2. Base de datos local

```bash
cd backend
docker-compose up -d
```

Levanta PostgreSQL 16 en `localhost:5432` y Redis 7 en `localhost:6379`.

### 3. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:generate     # Genera el cliente Prisma
npm run db:push         # Aplica el schema a la base de datos
npm run db:seed         # Crea los usuarios de prueba
npm run dev             # Servidor en http://localhost:3001
```

### 4. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev             # App en http://localhost:5173
```

### 5. Verificar

```bash
curl http://localhost:3001/api/health
# {"status":"ok","timestamp":"...","version":"0.1.0"}
```

---

## Credenciales de prueba

Todos los usuarios tienen la contraseña: `Neurofic2026!`

| Email | Rol | Descripción |
|-------|-----|-------------|
| admin@neurofic.com | ADMIN | Acceso completo al sistema |
| gerencia@neurofic.com | GERENCIA | Gerencia general |
| direccion@neurofic.com | DIRECCION | Dirección médica/operativa |
| facturacion@neurofic.com | FACTURACION | Módulo de facturación |
| coordinadora@neurofic.com | COORDINADORA | Coordinación de servicios |
| admisiones@neurofic.com | ADMISIONES | Área de admisiones |

---

## Roles y permisos

| Rol | Nivel | Descripción |
|-----|-------|-------------|
| `ADMIN` | 1 | Administrador del sistema, acceso total |
| `GERENCIA` | 2 | Gerencia, visibilidad ejecutiva |
| `DIRECCION` | 3 | Dirección, reportes y métricas |
| `FACTURACION` | 4 | Gestión de facturación y cartera |
| `COORDINADORA` | 5 | Coordinación de servicios clínicos |
| `ADMISIONES` | 6 | Proceso de admisión de pacientes. **Limitado al mes en curso** y sin acceso a valores monetarios en las exportaciones. |
| `RECURSOS_HUMANOS` | 7 | Liquidaciones de honorarios, sin aprobación ni pago |

> El acceso real se controla por **módulos** asignados a cada usuario
> (`dashboard`, `reportes`, `pacientes`, `honorarios`, `capacidad`, `auditoria`,
> `configuracion`, `aprobar`), no solo por el rol. Se configuran en
> Configuración → Usuarios.

---

## Estructura del proyecto

```
Maestro/
├── backend/          # API Fastify + Prisma
├── frontend/         # React + Vite + TypeScript
├── docs/             # Documentación técnica
├── CHANGELOG.md      # Historial de versiones
└── README.md
```

---

## Documentación

**Índice completo en [docs/README.md](docs/README.md).**

| | |
|---|---|
| **Usar** | [Manual de usuario](docs/MANUAL_USUARIO.md) · [Manual extenso v2.2](docs/Manual_Neurofic_Dashboard_v2_2.md) |
| **Desarrollar** | [Arquitectura](docs/ARCHITECTURE.md) · [Modelo de datos](docs/MODELO-DATOS.md) · [Referencia de la API](docs/API-REFERENCE.md) · [Autenticación](docs/API-AUTH.md) · [Reportes](docs/API-REPORTES.md) · [Conectores](docs/CONNECTORS.md) · [Exportación](docs/EXPORTACION.md) |
| **Operar** | [Despliegue](docs/DEPLOY.md) · [Variables de entorno](docs/ENV.md) |

> Dos trampas conocidas: `backend/dist` está versionado y hay que recompilarlo tras
> cualquier cambio en el backend, y un import sin usar rompe el build del frontend por
> completo. Ambas en [DEPLOY.md](docs/DEPLOY.md).

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 (LTS) |
| API | Fastify 4 |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL 16 |
| Caché | Redis 7 |
| Auth | JWT + Refresh Tokens |
| Frontend | React 18 + Vite 5 |
| Estado | Zustand 4 |
| HTTP client | Axios + React Query 5 |
| Validación | Zod |
| Logs | Winston |

---

## Comandos útiles

```bash
# Backend
npm run test              # Ejecutar tests unitarios
npm run test:coverage     # Coverage report
npm run lint              # TypeScript check
npm run db:studio         # Prisma Studio (UI para la DB)

# Frontend
npm run build             # Build de producción
npm run lint              # TypeScript check
```

---

## Versión

`0.1.0` — Stage 1: Foundation
