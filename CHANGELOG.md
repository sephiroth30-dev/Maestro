# Changelog

All notable changes to the Neurofic Admin Dashboard are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.4.1] - 2026-05-27

### Added
- **7 entidades nuevas** en el catálogo (identificadas desde la pestaña "Sin Entidad"):
  REGIONAL DE ASEGURAMIENTO EN SALUD NO4, GRUPO MEDICO LABORAL GML IPS SAS,
  NEUROLOGOS DEL VALLE SAS, ALLIANZ SEGUROS DE VIDA, ALLIANZ CARE,
  PROYECTOSINVERSIONES EN SOLUCIONES MEDICAS SAS, TARIFA EMPLEADOS NEUROFIC.
- **Editor de nombres alternativos** en la pestaña Entidades de Configuración: botón "Nombres" por fila abre un modal para agregar/eliminar los textos que el sistema busca en el Google Sheet al sincronizar. Los cambios persisten en base de datos y sobreviven reinicios.
- Campo `nombres_raw` expuesto en `GET /api/entidades` y aceptado en `PATCH /api/entidades/:id`.

---

## [1.4.0] - 2026-05-26

### Added
- **Gestión de usuarios** (ADMIN): crear, editar, activar/desactivar usuarios desde `/admin/usuarios`.
- Controles de contraseña: cambio de contraseña por admin y auto-cambio en primer login.

---

## [1.3.0] - 2026-05-23

### Added
- **Vista anual**: selector "Año" en Reportes muestra gráficas mensuales Ene–Dic con comparativa de presupuesto.
- **Mix por Servicio**: sección de análisis de volumen (atenciones) y rentabilidad (valor bruto) por tipo de servicio.
- **Diagnóstico "Sin Entidad"**: nueva pestaña en Configuración que lista los nombres del Sheet que no pudieron ser identificados, con conteo de atenciones y valor bruto afectado.
- **Checkboxes de selección masiva** en tabla de Entidades + persistencia del campo `tipo` en edición.
- **Filtro de grupo desde Mix Pagador**: hacer clic en EPS/Convenio/ARL/Particular filtra la tabla de entidades del mismo reporte.

### Fixed
- Zona horaria Colombia (UTC-5) aplicada en frontend y backend para fechas y cron.
- Fix deadlock en sync simultáneos y timezone del pool MySQL.
- Orden de meses en vista anual corregido (Ene → Dic).
- `getServiciosAgg` resiliente ante columnas faltantes en la base de datos.

---

## [1.2.4] - 2026-05-25

### Added
- **Filtro por día de semana**: hacer clic en una barra del widget "Facturado por día" filtra todos los indicadores (KPIs, Mix Pagador, Cumplimiento, tabla de entidades) al día más reciente de esa jornada dentro del período seleccionado. Clic nuevamente quita el filtro (toggle). Badge azul visible con fecha exacta y botón ✕ para limpiar.
- **Filtros rápidos**: "Ayer" y "Semana pasada" (lunes a domingo) en el selector de rango. La semana pasada calcula automáticamente el lunes y domingo de la semana anterior.
- **Widget "Facturado por día"**: mini gráfica de barras verticales (recharts) dentro de la segunda fila de KPIs, con barra destacada en azul oscuro para el día de mayor facturación. Reemplaza la tarjeta "Cierre Proyectado" que generaba confusión.
- Endpoint `/api/reportes/dias-semana` ahora acepta `start_date`/`end_date` para reflejar el rango seleccionado.

### Changed
- **Tabla "Facturación por Entidad"** ocupa ahora el **100% del ancho** de la página (antes compartía espacio con el gráfico de días de semana).
- **Gráfica "Promedio por Día de Semana"** eliminada — reemplazada por el mini-widget compacto en la fila de KPIs.
- **Mix Pagador** rediseñado: donut con slices individuales (EPS, Convenio, ARL, Particular, Caja) + dos resúmenes debajo: "Cobro a entidades" (EPS + ARL + Convenios) y "Flujo de caja" (Particulares + Caja) con total y porcentaje de cada grupo.
- KPI Row 2 usa estilo compacto (`kpi-grid--sm`) con fuente reducida para dar menos protagonismo a las métricas secundarias.
- Cambiar mes, preset o fechas limpia automáticamente el filtro de día activo.

---

## [1.2.3] - 2026-05-24

### Fixed
- **Discrepancia de facturación resuelta**: la app usaba `VALOR BRUTO` (tarifa por unidad) en lugar de `VALOR BRUTO POR CANTIDAD` (tarifa × cantidad de sesiones = total real facturado). Diferencia era ~2.7% (~$6.83M en enero). Ahora coincide con el Excel maestro.
- Detección de columna valor con sistema de prioridades P0–P4: P0=`VALOR BRUTO POR CANTIDAD`, P1=`VALOR BRUTO` exacto, P2=`VALOR BRUTO *` sin exclusiones (neto/copago/cuota), P3=cualquier `VALOR BRUTO *`, P4=columna genérica.
- Detección de columnas **por fila** (no solo desde `rows[0]`): en modo carpeta donde distintos archivos tienen distintos nombres de columna, cada fila ahora detecta su propio mapeo en caché. Evitaba `valor_bruto = 0` en filas de archivos 2-5.

### Added
- **Tab "Diagnóstico"** en Configuración con tabla por conector y mes: atenciones, valor bruto total, sin entidad (%), sin valor (%).
- **Botón "Columnas"** en cada tarjeta de conector (Google Sheets): muestra qué columna fue detectada para cada campo semántico (fecha, descripción, valor, entidad, profesional, autorización) y los totales por mes directamente desde la base de datos.
- Endpoint `GET /api/connectors/:id/column-diagnostico` lee la tabla `atenciones` directamente (sin Redis) — fiable en Hostinger donde Redis no está disponible de forma consistente.
- Endpoint `GET /api/reportes/diagnostico` y `GET /api/entidades` + `PATCH /api/entidades/:id`.
- Hook `useDiagnostico()` y `useColumnDiagnostico()` en el frontend.

---

## [1.2.2] - 2026-05-23

### Added
- Configuración con 4 pestañas: Fuentes de datos, Entidades, Presupuestos, Diagnóstico.
- Gestión de entidades desde la UI (activar/desactivar, editar nombres raw).
- Mix Pagador diferencia CAJA (es_grupo_caja) del resto de particulares.

### Fixed
- KPIs revertidos a sumar TODOS los registros (sin filtrar por es_grupo_caja), lo que excluía incorrectamente ~$7.9M de particulares.
- Unificación de entidades PARTICULAR y ALIANZA.

---

## [1.2.1] - 2026-05-23

### Added
- Auto-seed de entidades al arrancar el servidor: 40+ entidades (EPS, ARL, Convenios) con sus variantes de nombre para matching automático.
- Número de versión visible en el sidebar inferior (`v1.2.1`), leído desde `package.json` raíz.

### Fixed
- Sábados excluidos correctamente del cálculo de días hábiles en KPIs.
- Detección inicial de `VALOR BRUTO` mejorada para archivos con encabezados variantes.
- Matching de entidades corregido: 25+ entidades adicionales y ajuste de over-matching en nombres cortos.

---

## [1.2.0] - 2026-05-22

### Added
- Conector Google Sheets en modo carpeta: lee todos los `.xlsx` de una carpeta de Drive y combina las filas en un solo dataset.
- `sheet-atencion-mapper.ts`: detección automática de columnas (fecha, descripción, valor bruto, entidad, profesional, autorización), parseo de fechas (DD/MM/YYYY, serial Excel) y valores (formato colombiano 1.234.567,89).
- Hash SHA-256 por fila para deduplicación en inserts.
- Botón "Wipe data" por conector (borra atenciones y permite resincronizar).
- Endpoint `DELETE /api/connectors/data/orphan` para limpiar registros sin conector.
- Sync asíncrono (202 + polling del historial) para no superar timeout proxy de Hostinger (~30s).

### Changed
- SyncService: modo full-refresh (borra y reinserta) en lugar de insert incremental.
- Proxy Hostinger timeout workaround: el sync devuelve 202 inmediatamente.

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
- `initCron()` / `stopCron()` called in server lifecycle

---

## [0.1.0] - 2026-05-22

### Added
- Monorepo structure (backend + frontend)
- MySQL schema con Prisma 5 (migrado desde PostgreSQL)
- Authentication system (JWT + Refresh tokens)
- RBAC con 6 roles: ADMIN, GERENCIA, DIRECCION, FACTURACION, COORDINADORA, ADMISIONES
- Seed with test users
- Health check endpoint
- Frontend base con React 18 + Vite + TypeScript
- Login page with protected routes
- Zustand auth store con auto token refresh
- Fastify 4 API con CORS, Helmet, rate limiting
- JWT access tokens (15 min) + SHA256-hashed refresh tokens (7 days)
- Bcrypt password hashing (rounds=12)
- Rate limiting on login: 5 req/min per IP
- Winston structured logging con request IDs
- Zod environment validation on startup
- Graceful shutdown (SIGTERM, SIGINT)
- Global error handler (no stack traces in production)


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
