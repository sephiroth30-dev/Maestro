# Changelog

All notable changes to the Neurofic Admin Dashboard are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.1] - 2026-05-22

### Changed
- Database: migrated from PostgreSQL to MySQL for Hostinger compatibility
- Redis: replaced ioredis with in-memory cache (Redis can be added later)
- Frontend: served as static files from backend in production (single Hostinger site)
- Added @fastify/static for serving React SPA
- Added mysql2 driver for Prisma
- Frontend API client uses relative /api path in production

### Added
- docs/DEPLOY.md with Hostinger deployment guide
- Root package.json with monorepo convenience scripts
- tsconfig.build.json for production builds

---

## [0.3.0] - 2026-05-22

### Added
- Core data models: Atencion, Entidad, Profesional, Servicio, PresupuestoMensual
- NormalizacionService: exact replica of Apps Script V10.2 algorithm
- ReportesService: all Tier 1 & Tier 2 KPIs with Redis caching
- API endpoints: /api/reportes/kpis, /entidades, /cumplimiento/semanal, /dias-semana, /tendencia, /presupuestos
- Seed: entidades, profesionales, presupuestos 2026, 30 sample atenciones for mayo 2026
- Frontend: KpiCard, ChartCumplimiento, ChartMixPagador, ChartDiasSemana, TablaEntidades widgets
- Reportes page with month selector, live KPIs and all charts
- Dashboard updated with live KPI preview
- Auto-refresh every 10 minutes
- recharts@2 and @tanstack/react-table@8 added to frontend dependencies
- API documentation: docs/API-REPORTES.md

---

## [0.2.0] - 2026-05-22

### Added
- DataConnector abstraction layer (BaseConnector interface)
- Google Sheets connector (googleapis)
- REST API connector (native fetch, Node 20)
- ConnectorService with Zod config validation per type
- SyncService with Redis caching (configurable TTL)
- CronService with schedules: 30min, 1h, 4h, daily 8pm, manual
- Full CRUD API for connectors (/api/connectors)
- Manual sync trigger endpoint
- Sync history log
- Admin UI: Fuentes de Datos page with connector cards
- Add/Edit connector modal with step-by-step form
- Real-time connection test with latency display
- Sync history drawer
- Sidebar navigation with role-based menu items
- Responsive layout with collapsible sidebar
- `frecuenciaSync` field added to Conector model
- Redis client (ioredis) with graceful fallback
- `initCron()` / `stopCron()` called in server lifecycle

---

## [0.1.0] - 2026-05-22

### Added

- Monorepo structure (backend + frontend)
- PostgreSQL schema with Prisma 5
- Authentication system (JWT + Refresh tokens)
- RBAC with 6 roles: ADMIN, GERENCIA, DIRECCION, FACTURACION, COORDINADORA, ADMISIONES
- Seed with test users
- Docker Compose for local development (PostgreSQL 16 + Redis 7)
- Health check endpoint
- Frontend base with React 18 + Vite + TypeScript
- Login page with protected routes
- Zustand auth store with auto token refresh

### Backend

- Fastify 4 API with CORS, Helmet, rate limiting
- JWT access tokens (15 min) + SHA256-hashed refresh tokens (7 days)
- Automatic token rotation on refresh
- Token reuse detection with full revocation
- Bcrypt password hashing (rounds=12)
- Rate limiting on login: 5 req/min per IP
- Winston structured logging with request IDs
- Zod environment validation on startup
- Graceful shutdown (SIGTERM, SIGINT)
- Prisma schema: Usuario, RefreshToken, Conector, Sincronizacion, Dashboard, Widget, AuditLog
- Global error handler (no stack traces in production)
- Unit tests for password hashing, token generation, input validation

### Frontend

- Vite 5 + React 18 + TypeScript strict
- React Router v6 with protected and public routes
- Zustand auth store with sessionStorage persistence
- Axios client with automatic token refresh interceptor (retry once on 401)
- Login page: email/password form, show/hide password, error messages in Spanish
- Dashboard page: user info cards, logout button, role display
- CSS custom properties design system (no external UI library dependency)
- Responsive layout

### Infrastructure

- Docker Compose: PostgreSQL 16-alpine + Redis 7-alpine
- Health checks for both services
- Named volumes for data persistence

---

## [Unreleased]

### Planned for Stage 2

- Connector system (Google Sheets integration)
- KPI widgets (admissions, billing, compliance)
- Role-based dashboard configuration
- Redis caching layer
- Audit log viewer
