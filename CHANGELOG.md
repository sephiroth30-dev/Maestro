# Changelog

All notable changes to the Neurofic Admin Dashboard are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.7.0] - 2026-07-08

### Added
- **Profesional_nombre_raw**: nueva columna en la tabla `atenciones` (migración m12) que almacena el nombre literal del profesional leído desde el Google Sheet. Permite diagnosticar y corregir registros donde el profesional no pudo ser identificado sin esperar a la próxima sincronización.
- **Panel "Sin profesional"** en Configuración > Profesionales: sección ámbar que muestra los nombres de profesionales del Sheet que no están dados de alta en el catálogo — con recuento de atenciones y valor total afectado. Cada fila tiene un botón de creación en 1 clic.
- **Creación de nuevo profesional en 1 clic** desde el panel "Sin profesional": crea el profesional en el catálogo y reclasifica sus atenciones históricas en un solo paso. Muestra estado de carga, éxito y error inline por fila — sin modal adicional.
- **Modal "Nuevo profesional"** disponible también desde el botón "Agregar manualmente" para flujos donde se necesita ingresar campos opcionales (nombre completo, especialidad, nombres raw adicionales).
- **Endpoint `POST /api/profesionales`**: crea un profesional con `nombre`, `nombre_completo`, `especialidad` y `nombres_raw`. Retorna el nuevo `id`.
- **Endpoint `GET /api/diagnostico/sin-profesional`**: devuelve los `profesional_nombre_raw` sin asignar, agrupados por nombre con conteo y valor total.
- **Endpoint `POST /api/admin/reclasificar-profesionales`**: re-aplica los `nombres_raw` del catálogo sobre las atenciones con `profesional_id = NULL`, asignando el profesional correcto a todos los registros existentes.
- **Lista dinámica de profesionales** en Reglas de Honorarios: la matriz ya no es una lista fija — se genera a partir de los profesionales con reglas en la base de datos más los que se agreguen manualmente en la sesión.
- **"Agregar profesional" en el encabezado** de la tarjeta de Reglas de Honorarios: dropdown con búsqueda para añadir cualquier profesional del catálogo a la matriz de reglas. Botón siempre visible, posición prominente.
- **Duplicar reglas entre profesionales**: botón por columna que abre un modal para seleccionar el profesional destino y copiar todas sus reglas activas de una vez. Endpoint `POST /api/reglas-honorarios/duplicar` con INSERT...ON DUPLICATE KEY UPDATE.
- **`useDuplicarReglas()`** en el API frontend para la operación de duplicación.

### Changed
- Honorarios: el botón "Duplicar reglas" siempre visible (opacity 0.45 en reposo, completo al pasar el cursor) — antes estaba oculto hasta el hover, lo que lo hacía imposible de descubrir.
- Honorarios: jerarquía visual mejorada — "Agregar profesional" es el botón primario en el encabezado; los controles secundarios están bien diferenciados.
- `sheet-atencion-mapper.ts`: ahora inserta `profesional_nombre_raw` junto a `profesional_id` en cada sincronización.

---

## [1.6.0] - 2026-06-15

### Added
- **Gráfica "Cumplimiento Diario"** (ChartCumplimientoDiario): en modo rango de fechas, muestra barras diarias con semáforo de color (verde ≥ 100%, amarillo ≥ 80%, rojo < 80% del presupuesto diario esperado). Permite identificar de un vistazo qué días del período estuvieron por debajo de la meta.
- **Alerta Flujo de Caja**: banner en el panel de reportes cuando el porcentaje de Particulares cae por debajo del 20% del total facturado — señal de alerta para la liquidez de la clínica.

### Fixed
- **Cache flush post-sincronización**: después de cada sync exitoso, se invalidan las claves de caché relevantes. Solucionaba que los filtros mostraran $0 en el primer render tras una sincronización reciente.
- **Cron catch-up al reiniciar el servidor**: si el servidor estuvo caído durante más de 1 hora (ej. ventana de 18 horas en Hostinger), el cron lanza una sincronización compensatoria al arrancar, en lugar de esperar al próximo intervalo programado.

---

## [1.5.6] - 2026-05-28

### Added
- **Nombre en reportes** editable por servicio (campo `nombre_display`, migración 0005). Permite cambiar cómo aparece el procedimiento en Mix por Servicio sin tocar las palabras clave de matching. El nombre interno (`nombre`) se muestra en gris como subtítulo.
- **Panel de agrupaciones** por servicio: botón ojo en cada fila que despliega todas las descripciones literales del Sheet que están siendo agrupadas bajo ese procedimiento, con conteo y valor. Incluye las sesiones de telemetría hora por hora.
- Endpoint `GET /api/diagnostico/servicio-agrupaciones` (ADMIN).
- El mix report usa `COALESCE(nombre_display, nombre)` para mostrar el nombre personalizado.

---

## [1.5.5] - 2026-05-28

### Changed
- **Presupuestos** rediseñado como tabla compacta: los 12 meses en lista, campos siempre visibles, guardado automático al salir del campo (blur) o con Enter/Tab. Muestra total anual en la cabecera.
- **Búsqueda + orden** (A → Z / Z → A) agregado a Entidades, Profesionales y Procedimientos.

---

## [1.5.4] - 2026-05-28

### Added
- Campo **Nombre completo** editable en la pestaña Profesionales: icono de lápiz por fila, input inline con Enter para guardar y Escape para cancelar. Se muestra como nombre principal; el código de matching del Sheet queda como subtítulo.
- Campo `nombre_completo VARCHAR(200) NULL` en la tabla `profesionales` (migración 0004).
- Endpoint `PATCH /api/profesionales/:id` ahora acepta tanto `especialidad` como `nombre_completo` en el mismo request.

---

## [1.5.3] - 2026-05-27

### Added
- **Pestaña "Profesionales"** en Configuración: lista todos los profesionales importados del Sheet con un selector de especialidad (Neurología / Fisiatría / Otra). Se ordena por volumen de registros.
- Campo `especialidad` en la tabla `profesionales` (migración 0003).
- Endpoints `GET /api/profesionales` y `PATCH /api/profesionales/:id` (ADMIN).
- **Clasificación inteligente por especialidad**: cuando la descripción del Sheet es genérica ("CONSULTA PRIMERA VEZ" o "CONSULTA DE CONTROL"), el sistema revisa la especialidad del profesional y asigna automáticamente `CONSULTA PRIMERA VEZ NEUROLOGIA`, `CONSULTA PRIMERA VEZ FISIATRA`, etc. Aplica tanto en nuevas sincronizaciones del Sheet como en el botón "Reclasificar registros".

### Changed
- `reclasificarServicios` usa la especialidad del profesional para hacer upgrade de consultas genéricas.
- `mapRowsToAtenciones` aplica la misma lógica en cada sincronización futura.

---

## [1.5.2] - 2026-05-27

### Added
- **PRUEBA DE LATENCIA MULTIPLE** (orden 22): captura `LATENCIA MULTIPLE`, `PRUEBA LATENCIA MULTIPLE`, `MSLT`.
- **DERECHOS DE SALA** (orden 23): captura `DERECHOS SALA`, `DERECHO SALA`.

---

## [1.5.1] - 2026-05-27

### Added
- **PRUEBA ESTIMULO REPETITIVO** (orden 20): captura `ESTIMULO REPETITIVO`, `ESTIMULACION REPETITIVA` y variantes.
- **ECOGRAFIA** (orden 21): captura `ECOGRAFIA`, `ULTRASONIDO`, `ULTRASONOGRAFIA`, `ECOGRAFICO`.

### Changed
- **REFLEJO H** agrega `ONDA F` — queda junto con Reflejo H y Reflejo F en el mismo grupo.

---

## [1.5.0] - 2026-05-27

### Changed
- **REFLEJO H** agrega palabra clave `REFLEJO F` — Reflejo H (H-reflex) y Reflejo F (F-wave) quedan en el mismo servicio.
- **INFILTRACION** agrega `SUSTANCIA TERAPEUTICA` — captura "INYECCION DE SUSTANCIA TERAPEUTICA" y variantes.
- **POTENCIALES EVOCADOS** agrega `POTENCIAL` como catch-all — captura todos los tipos: auditivos, somatosensoriales, visuales, motores, etc.

---

## [1.4.9] - 2026-05-27

### Added
- **INFILTRACION** (orden 16): nuevo servicio que agrupa todas las infiltraciones articulares, perirarticulares y de esteroide: `INFILTRACION`, `INYECCION O INFILTRACION`, `INFILTRACION ESTEROIDE`, `INFILTRACION ARTICULAR`, `INFILTRACION INTRAARTICULAR`, `INFILTRACION PERIARTICULAR`, `INYECCION ESTEROIDE`.

### Changed
- Junta Médica, Polisomnografía y Potenciales Evocados renumerados (+1) para dar paso al nuevo servicio.

---

## [1.4.8] - 2026-05-27

### Added
- **ELECTROENCEFALOGRAMA PORTATIL** (orden 8): nuevo servicio para estudios realizados en UCI o domicilio. Al tener orden menor que el genérico, se evalúa primero.

### Changed
- **ELECTROENCEFALOGRAMA COMPUTARIZADO** amplía sus palabras clave a `ELECTROENCEFALOGRAMA COMPUTARIZADO`, `ELECTROENCEFALOGRAMA CONVENCIONAL` y `ELECTROENCEFALOGRAMA` (catch-all para cualquier EEG ambulatorio no portátil). Captura descripciones como "ELECTROENCEFALOGRAMA CONVENCIONAL . NUA."
- **POLISOMNOGRAFIA** agrega palabra clave `POLISOMNOGRAMA` para capturar variantes como "POLISOMNOGRAMA EN TITULACION DE DISPOSITIVO MEDICO".
- Ordenes renumerados: ELECTROMIOGRAFIA pasa a 10, resto de servicios +1 hasta POTENCIALES EVOCADOS en 18.
- **Acción recomendada**: tras desplegar, hacer clic en "Reclasificar registros" en Configuración > Procedimientos para re-mapear los 159 registros actualmente sin clasificar.

---

## [1.4.7] - 2026-05-27

### Added
- **Botón "Reclasificar registros"** en Configuración > Procedimientos: re-aplica las palabras clave del catálogo a todos los registros históricos en la base de datos. Necesario cuando se agregan nuevos servicios (como CONSULTA DE CONTROL NEUROLOGIA/FISIATRIA) para que los registros anteriores queden asignados correctamente sin esperar a la próxima sincronización del Sheet.
- Endpoint `POST /api/admin/reclasificar-servicios` (ADMIN) que retorna `{ total, updated, sin_clasificar }`.

---

## [1.4.6] - 2026-05-27

### Added
- **CONSULTA DE CONTROL NEUROLOGIA** (orden 3) y **CONSULTA DE CONTROL FISIATRIA** (orden 4) en el catálogo. El registro genérico `CONSULTA DE CONTROL` queda en orden 5 como comodín para otros controles médicos.
- **Panel "Sin clasificar"** en la pestaña Procedimientos de Configuración: sección colapsable que muestra las descripciones del Sheet que no encontraron coincidencia en el catálogo — con recuento de registros y valor total. Facilita identificar qué palabras clave hay que agregar sin necesidad de consultar la base de datos directamente.
- Endpoint `GET /api/diagnostico/sin-servicio` (ADMIN) que devuelve las descripciones sin clasificar ordenadas por frecuencia.

---

## [1.4.5] - 2026-05-27

### Added
- **3 nuevos servicios** en el catálogo de procedimientos:
  - `CONSULTA PRIMERA VEZ FISIATRA` (orden 1) — captura variantes con "FISIATRA".
  - `CONSULTA PRIMERA VEZ NEUROLOGIA` (orden 2) — captura variantes con "NEUROLOG".
  - `CONSULTA DE CONTROL` (orden 3) — captura "CONTROL NEUROLOG", "CONTROL FISIATRA", "CONTROL MEDICO".
  - El servicio genérico `CONSULTA PRIMERA VEZ` se desplazó al orden 4 como comodín.

### Changed
- **Mix por Servicio simplificado**: eliminadas las agrupaciones por categoría, los chips de filtro y la columna "Categoría". La tabla ahora muestra un listado plano ordenado por valor facturado, sin "Sin categoría".

---

## [1.4.4] - 2026-05-27

### Fixed
- **Mix por Servicio responde a todos los filtros activos**: filtro de día de semana, rango de fechas y entidad ahora se aplican también al bloque de procedimientos. Antes sólo actualizaban KPIs y tabla de entidades.

---

## [1.4.3] - 2026-05-27

### Added
- **Pestaña "Procedimientos"** en Configuración: tabla con todos los servicios del catálogo y toggle **Unidad / Sesión** por procedimiento. El modo Sesión agrupa los registros del mismo paciente en la misma fecha como 1 cita — correcto para monitoreo continuo (telemetría, video-EEG, polisomnografía) donde el Sheet genera una fila por hora.
- Endpoints `GET /api/servicios` y `PATCH /api/servicios/:id` (ADMIN) para gestionar el catálogo de procedimientos.

### Fixed
- El seed de servicios ya **no sobreescribe** `tipo_conteo` en reinicios — los cambios hechos desde la UI de Procedimientos persisten.
- Nuevas palabras clave para capturar variantes de Video-EEG / Videotabiometría: `VIDEO EEG`, `VIDEOTELEMETRIA`, `VIDEOTABIOMETRIA`, `VIDEO TABIOMETRIA`, `VIDEOENCEFALOGRAFIA`, `MONITOREO CONTINUO EEG`, `MONITORIZACION CONTINUA`.

---

## [1.4.2] - 2026-05-27

### Added
- **"¿Olvidaste tu contraseña?"** en la pantalla de login: muestra un aviso inline indicando que el administrador puede restablecer la contraseña desde el panel de Usuarios.
- **Filtro por entidad en Mix por Servicio**: al hacer clic en una entidad de la tabla de facturación, el Mix por Servicio se filtra automáticamente para mostrar solo los procedimientos prestados a esa entidad.
- **Agrupación por categoría en Mix por Servicio**: los servicios se agrupan bajo encabezados de categoría colapsables. Chips de filtro en la barra superior permiten aislar una categoría específica. Cada grupo muestra subtotales de cantidad, valor y porcentaje.
- **Columna "Categoría"** visible en la vista plana (cuando se filtra por una categoría específica).
- `categoria` expuesto en `GET /api/reportes/servicios` y aceptado como filtro `entidad_id`.

### Changed
- Versión visible en sidebar y en todos los `package.json` bumpeada a `1.4.2`.

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
