# Changelog

All notable changes to the Neurofic Admin Dashboard are documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.8.9] - 2026-08-05

### Fixed
- **Las tarjetas de Reportes no se actualizaban tras sincronizar** aunque los valores ya estuvieran en la base. Tres causas se sumaban: `useTriggerSync` no invalidaba ninguna consulta de reportes; con `refetchOnWindowFocus: false` y un temporizador de 10 minutos independiente por consulta, los paneles se refrescaban de forma dispar; y el botón ↺ solo refrescaba 4 de las 6 consultas de la página, omitiendo «Mix por Servicio» y la tendencia. Ahora existe `invalidarReportes()` con la lista completa de claves, y la sincronización la llama al completarse.
- **El caché de reportes en el servidor no se vaciaba nunca.** `reportes.controller.ts` no tenía una sola llamada a `flushReportesCache()` y el TTL era de 30 a 60 minutos, así que un cambio de presupuesto o de clasificación podía tardar media hora en verse. TTL reducido a 60 s y vaciado explícito en los 8 puntos que modifican datos.
- **Capacidad y «Mix por Servicio» daban cifras distintas del mismo servicio sin explicar por qué.** En Potenciales Evocados, junio: la pantalla mostraba 56 y el área reportaba 151 — visitas contra estudios, unas 2,7 modalidades por cita. Ninguna de las dos era un error, pero Capacidad mostraba una sola cifra rotulada «sesiones» sin decir cuál. Ahora cada grupo declara su **base de conteo**, la tarjeta rotula el sustantivo («151 estudios») y muestra la otra cifra debajo.
- **Un registro sin identificación de paciente colapsaba el día entero en una visita.** La llave de sesión era `CONCAT(fecha,'|',COALESCE(nombre,''),'|',COALESCE(documento,''))`, que para todas las filas anónimas de un día se reducía a `'2026-06-03||'`. Con una fuente sin columna de paciente —hay una con 0 % de cobertura— la ocupación de sus grupos quedaba reducida al número de días distintos del mes, en silencio. Sin identificación ya no se deduplica, y `sinPaciente` reporta cuántas filas están así.
- El grupo «Ecografía como Guía» no podía recibir nada: el catálogo de servicios tiene una entrada llamada `ECOGRAFIA` a secas, que no encajaba en `ECOGRAFIA%GUIA%` ni en `ECOGRAFIA%PROCEDIMIENTO%`.
- **Las rayas y las elipsis desaparecían de todos los PDF.** `toPdfSafe` borra lo que queda fuera de Latin-1 y no tenía regla para `—`, `–` ni `…`, así que la etiqueta de un rango salía como «Enero 2026 Agosto 2026», dos fechas pegadas sin separador. El pie decía «Pagina» sin tilde.
- El diálogo de exportación decía «secciónes»; el plural de «sección» no lleva tilde.

### Added
- **Filtro por rango de meses en Capacidad**, con la tabla «Utilización mes a mes» en pantalla y en el archivo exportado. Resuelto en una sola consulta agrupando por (año, mes, grupo) en vez de repetir la consulta mensual N veces; tope de 36 meses.
- **Base de conteo configurable por grupo** en Configuración → Cap. Instalada, columna «Se compara contra». Por omisión Potenciales Evocados se mide en estudios y el resto en visitas.
- `GET /api/capacidad/grupos` — catálogo de grupos y su base por omisión, para que la pantalla de configuración deje de llevar su propia copia de la lista.
- `GET /api/capacidad/utilizacion/rango` — una fila por grupo y mes.
- Las respuestas de utilización devuelven ahora `pacientes`, `estudios`, `base` y `sinPaciente` además de `sesiones`.

### Changed
- Las reglas de capacidad —los doce grupos, los patrones que clasifican cada servicio y la base de cada grupo— viven en `backend/src/config/capacidad-grupos.ts`. Estaban duplicadas como SQL crudo en las dos consultas del repositorio y una tercera vez, sin las bases, en la pantalla de configuración.
- La llave canónica de paciente se movió a `repositories/paciente-key.ts` y la comparten Pacientes y Capacidad. Si las dos pantallas discrepan sobre qué cuenta como una persona, sus cifras no se pueden conciliar.
- El exportable de Capacidad pasó a orientación horizontal: son nueve columnas.
- El runner de migraciones acepta `columna: { tabla, columna }` y consulta `information_schema` en vez de confiar en `ADD COLUMN IF NOT EXISTS`, que es sintaxis de MariaDB y MySQL 8 rechaza en silencio.

---

## [1.8.7] - 2026-08-03

### Fixed
- **Un conector REST sincronizaba en verde e insertaba cero filas.** La escritura a `atenciones` estaba condicionada a `tipo === 'GOOGLE_SHEETS'`, así que cualquier fuente REST se creaba, probaba conexión, reportaba filas leídas y no guardaba nada — sin un solo error a la vista. El mapeador siempre fue agnóstico del origen; simplemente no se le llamaba.
- La sincronización informaba como «filas nuevas» las filas **leídas**, no las escritas.
- Cuando el mapeador no reconoce ninguna columna se rendía en silencio y la sincronización quedaba «Completada» con cero filas, indistinguible de un período sin actividad. Ahora falla con las columnas recibidas en el mensaje.
- «Probar conexión» comprobaba solo la URL base: daba verde aunque el endpoint no existiera o no autorizara. Ahora prueba la ruta real que usará la sincronización.

### Added
- **Ruta del endpoint** y parámetros de consulta en los conectores REST. Antes solo se podía pedir la URL base tal cual, lo que hacía imposible apuntar a un recurso concreto.
- **Autenticación por cabecera propia** (`Token en cabecera propia`), para las APIs que no usan `Authorization` — como Medifolios, que autentica con `X-Auth-Token`.
- **Correspondencia de campos** configurable. El mapeador detecta columnas con expresiones pensadas para hojas en español y falla con nombres como `valor_total` (`\b` no coincide antes de `_`) o `nombreConvenio`; sin traducirlos, el valor bruto entraría en cero.
- Ruta al listado dentro del JSON (`dataPath`) y tiempo máximo de espera configurable.

### Security
- **`GET /api/connectors` devolvía el `config` íntegro** —con la clave privada de Google y los tokens— a cualquier sesión de administrador. Ahora se enmascaran credenciales y cabeceras sensibles. Al editar, el valor enmascarado se repone en el servidor para que guardar un cambio de nombre no borre el token.
- Las credenciales **siguen guardándose sin cifrar** en la base de datos; el enmascaramiento cubre la API, no un volcado.

---

## [1.8.6] - 2026-08-03

### Added
- **Centro de ayuda contextual dentro de la aplicación.** Botón **?** en el encabezado de Dashboard, Reportes, Pacientes, Honorarios, Capacidad, Auditoría y Configuración: abre un panel lateral con la ayuda de esa pantalla. En Configuración el artículo se elige según la pestaña activa.
  - **Buscador global** dentro del panel: abre en el artículo de la pantalla, pero busca en todos. Ignora las tildes, porque «liquidacion» y «facturacion» se teclean sin ellas a diario.
  - **Filtrado por módulo**: quien no tiene el módulo `honorarios` no ve ese artículo, ni en la lista ni en los resultados. El recorte se aplica antes de construir el índice.
  - 15 artículos cortos que fusionan los dos manuales anteriores. El detalle a fondo va en bloques desplegables, cerrados por defecto.
  - Todo en diferido: el panel, el contenido y `marked` van en chunks aparte. El paquete principal crece 1,7 kB pese a tener el botón en ocho páginas.

### Changed
- **Los artículos de ayuda son ahora la única fuente de la documentación de usuario.** Los manuales en PDF se generan a partir de ellos (`scripts/md-a-pdf.py --manual breve|completo`), así que por construcción no pueden contradecir a la aplicación. Los mismos bloques desplegables producen los dos niveles: el manual breve los omite y el completo los expande.
- `docs/MANUAL_USUARIO.md` y `docs/Manual_Neurofic_Dashboard_v2_2.md` dejan de editarse a mano y quedan como punteros a `frontend/src/help/content/`. Mantener el mismo texto en dos sitios era la causa de que el manual declarara «Versión 1.6 · Mayo 2026» tres versiones más tarde.
- La regla de acceso por módulos estaba implementada dos veces con formas distintas (`App.tsx` y `Sidebar.tsx`); se unifica en `lib/permisos.ts`, que ahora comparten esos dos y la ayuda.

### Fixed
- **`.modal-close` no existía en el CSS** pese a usarse en todos los modales: el botón de cerrar se pintaba con el estilo por defecto del navegador, como un recuadro con borde. Afectaba al diálogo de exportación, al de cambio de contraseña y a los de Honorarios.

---

## [1.8.0] - 2026-08-02

### Added
- **Analítica de pacientes** (nueva página `/pacientes`, módulo `pacientes`): pacientes únicos, nuevos vs. recurrentes, distribución de frecuencia de visitas, retención mes a mes, y pacientes por tipo de pagador y por servicio. Endpoint `GET /api/reportes/pacientes`.
  - **Barra de cobertura siempre visible**: la base solo guarda `paciente_nombre` y `paciente_documento`, ambos opcionales, así que la página informa qué porcentaje de los registros trae identificación —y el desglose por fuente— antes de mostrar ninguna cifra. Todo se calcula únicamente sobre esos registros.
  - Los conteos por pagador y por servicio **no suman** el total de pacientes únicos (una persona atendida por dos pagadores cuenta en ambos); se advierte en pantalla y en el archivo exportado, y se representan como tabla y no como torta.
  - No hay demografía poblacional: el sistema no almacena edad, sexo, ciudad ni régimen. La página lo dice explícitamente para que nadie la busque.
- **Exportación del detalle de atenciones** (`GET /api/reportes/detalle-atenciones`): una fila por atención del período —fecha, paciente, documento, entidad, profesional, servicio y valor—, disponible con el botón **Detalle** en Reportes. Es lo que los manuales ya prometían y no existía.
- **Exportación de reportes a PDF, Excel y CSV** en Dashboard, Reportes, Honorarios, Capacidad Instalada y Auditoría. Botón "Exportar" en el encabezado de cada página.
- **Diálogo de exportación** con casilla por sección y por columna (todo marcado por defecto), resumen de filas a exportar y elección de orientación para el PDF.
- **Presets de exportación**: `Todo`, `Vista médicos (sin valores)` — oculta de un clic toda columna monetaria para quienes solo necesitan cantidades —, `Solo tablas` y `Resumen ejecutivo`.
- **PDF con marca**: banda azul con el logosímbolo Neurofic, título, período, filtros aplicados, tarjetas de indicadores, tablas con cebreado y fila de totales, gráficas incrustadas y pie con fecha de generación y numeración de páginas.
- **Excel analizable**: una hoja por sección más una portada con el período y los filtros; encabezado fijo y con autofiltro, anchos de columna, y valores guardados como número o fecha reales con formato COP — se pueden sumar y usar en tablas dinámicas.
- **Honorarios** exporta dos pivotes paralelos por categoría: uno de montos y otro de cantidades. El preset "Vista médicos" descarta el primero y deja exactamente el que le sirve al profesional.
- **Auditoría** descarga todos los eventos del filtro activo (no solo la página visible) paginando de a 200 en peticiones secuenciales, con tope de 2.000 registros indicado en el archivo.

### Security
- La exportación **respeta los permisos de rol**: los roles sin acceso a información financiera (ADMISIONES) reciben siempre la versión sin valores. La restricción se aplica en el generador, no solo en la interfaz, y también **sustituye las gráficas por su tabla equivalente** — recharts dibuja las cifras en pesos dentro del SVG, así que incrustar la imagen habría filtrado los montos.
- Las celdas de CSV que empiezan por `=`, `+`, `-` o `@` se neutralizan para evitar la ejecución de fórmulas al abrir el archivo en Excel.

### Changed
- Las librerías de generación (jsPDF, ExcelJS) se cargan bajo demanda al pulsar Exportar; el bundle inicial crece solo ~35 kB en lugar de ~400 kB.
- `ChartMixPagador` exporta `aggregateMix` para que el detalle del PDF reutilice la misma agregación que dibuja el donut, en vez de reimplementarla.
- La contribución por médico se consulta desde la página de Honorarios y no al desplegar la sección, para que la exportación no dependa de que el usuario la haya abierto antes.

### Fixed
- **Migración a `dashboard.neurofic.com`**: el pie de los PDFs (tanto los nuevos como el comprobante de honorarios) seguía imprimiendo el dominio anterior, y el manual daba la URL vieja. El despliegue ya no fija el directorio a un dominio concreto: busca el checkout real y se puede forzar con el secreto `APP_DIR`; antes, mover el sitio habría dejado el despliegue actualizando en silencio la ubicación abandonada.
- `descargarPDF` no insertaba el enlace en el DOM antes de pulsarlo; algunas versiones de Firefox no disparaban la descarga. La utilidad compartida `saveBlob` lo corrige.
- **Las migraciones de índice nunca se aplicaban en MySQL**: `CREATE INDEX IF NOT EXISTS` es sintaxis de MariaDB y MySQL 8 la rechaza con error de sintaxis, así que `m07` fallaba en cada arranque —incluso la primera vez— y el índice sobre `atenciones(servicio_id)` no llegaba a crearse. El runner ahora consulta `information_schema` y emite el `CREATE` sin la cláusula, que ambos motores aceptan.
- Los manuales afirmaban que los reportes ya se podían exportar y que la tabla de detalle era descargable. Ahora es cierto; la documentación se reescribió para describir el diálogo real.

### Security
- **Admisiones podía saltarse el candado de período.** `enforceAdmisionesPeriod` solo reescribía `mes_idx`/`anio`, pero `buildDateWhere` prefiere `start_date`/`end_date` y descarta el mes cuando ambas fechas vienen: bastaba `?start_date=2020-01-01&end_date=2030-12-31` para obtener el histórico completo. Ahora el guardia anula también el rango, en los seis endpoints afectados. En `/detalle-atenciones` esto habría expuesto nombres y documentos de paciente de todos los tiempos.

### Deployment
- El despliegue automático por GitHub Actions queda **desactivado**: el servidor se actualiza por la integración con Git de Hostinger, y el flujo solo fallaba en el paso de SSH generando una notificación de error por commit. Se conserva como ejecución manual (`workflow_dispatch`) con instrucciones para reactivarlo.
- Nuevo flujo `version.yml` que asume lo que sí hacía falta del anterior y no necesita secretos: sube la versión de parche y valida que ambos proyectos compilen. Además **verifica que `backend/dist` corresponda al código fuente** — está versionado porque Hostinger no compila, y olvidar regenerarlo deja al servidor ejecutando la versión anterior sin ningún síntoma visible.

### Migrations
- `m16`: concede el módulo `pacientes` a los usuarios que ya tenían `reportes`. Sin esto, `hasModuleAccess` falla cerrado y todo usuario con lista de módulos explícita perdería la página nueva hasta que un administrador se la marcara una por una. La condición `NOT LIKE '%"pacientes"%'` es obligatoria: el runner reejecuta la lista completa en cada arranque y sin ella cada reinicio añadiría otra copia hasta desbordar la columna.

---

## [1.7.1] - 2026-07-17

### Added
- **Profesional en nómina (`es_nomina`)**: nuevo toggle en Configuración > Profesionales para marcar a un profesional como empleado de nómina fija (ej. Álvaro Tellez). Al activarse, el sistema calcula sus honorarios de forma **simulada** usando las mismas reglas que cualquier fisiatra, pero la liquidación queda marcada como `es_simulado = true`.
- **Análisis de rentabilidad para nómina**: las liquidaciones simuladas aparecen en la pantalla de Honorarios con badge morado "Nómina", estilo diferenciado y etiqueta "Ref. rentabilidad". Los botones Aprobar/Pagar están deshabilitados para estas filas.
- **Contribución con desglose simulado**: en la sección "Contribución por profesional", los montos simulados se muestran en morado con sufijo "(sim.)" para distinguirlos de honorarios reales. Las KPIs de resumen (total honorarios, margen) excluyen los montos simulados.
- **"Copiar desde…" en Reglas de Honorarios**: los profesionales sin reglas configuradas ahora muestran un botón morado "Copiar desde…" que abre un modal para seleccionar un profesional origen y copiar todas sus reglas en un clic. Los candidatos se ordenan por cantidad de reglas (mayor a menor).
- **`DuplicarModal` bidireccional**: refactorizado para soportar `mode='copy-to'` (origen fijo, elige destino) y `mode='copy-from'` (destino fijo, elige origen). Mismo endpoint backend `POST /api/reglas-honorarios/duplicar`.
- **Migración m13** (`liquidaciones.es_simulado`): nueva columna `TINYINT(1) DEFAULT 0` en la tabla `liquidaciones`. Se establece en `1` automáticamente cuando el profesional tiene `es_nomina = true`.

### Changed
- `PATCH /api/profesionales/:id` ahora acepta el campo `es_nomina` (boolean) para actualizar el tipo de pago del profesional.
- La propagación de `es_nomina` recorre toda la cadena: repo → service → controller → liquidaciones → frontend.

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
