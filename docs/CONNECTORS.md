# Capa de Conectores

## Arquitectura

La capa de conectores abstrae las fuentes de datos del resto del sistema. El dashboard no sabe ni le importa si los datos vienen de Google Sheets, una REST API, o una base de datos PostgreSQL — solo trabaja con `DataSet`.

```
[Source]  →  [Connector]  →  [SyncService]  →  [Redis Cache]  →  [KPI Endpoints]
```

### Clases y tipos clave

| Tipo | Archivo | Descripción |
|------|---------|-------------|
| `BaseConnector` | `connectors/base.connector.ts` | Clase abstracta base |
| `DataSet` | `connectors/base.connector.ts` | Resultado normalizado de fetch |
| `ConnectorQuery` | `connectors/base.connector.ts` | Parámetros de consulta |
| `ConnectionTestResult` | `connectors/base.connector.ts` | Resultado de test de conexión |
| `SheetsConnector` | `connectors/sheets.connector.ts` | Implementación Google Sheets |
| `RestConnector` | `connectors/rest.connector.ts` | Implementación REST API genérica |

### Implementar un nuevo conector

1. Crear `backend/src/connectors/mi-nuevo.connector.ts`
2. Extender `BaseConnector`:

```typescript
import { BaseConnector, ConnectorQuery, DataSet, ConnectionTestResult } from './base.connector.js';

export class MiNuevoConnector extends BaseConnector {
  readonly tipo = 'CSV' as const; // o el tipo que corresponda

  constructor(private config: MiConfig) {
    super();
  }

  async test(): Promise<ConnectionTestResult> {
    // Verificar que la fuente es accesible
    // Retornar { success, message, latencyMs }
  }

  async fetch(query: ConnectorQuery): Promise<DataSet> {
    // Obtener datos y normalizarlos al formato DataSet
    // columns: string[], rows: DataRow[], totalRows, fetchedAt, source
  }
}
```

3. Agregar el schema de validación Zod en `services/connector.service.ts`
4. Agregar la instanciación en `ConnectorService.instantiate()`
5. Agregar al tipo `ConnectorType` si es un tipo nuevo

## Google Sheets Connector

### Setup: crear service account

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear o seleccionar un proyecto
3. Habilitar la API: **Google Sheets API** y **Google Drive API**
4. Ir a **IAM & Admin > Service Accounts**
5. Crear una cuenta de servicio nueva
6. Descargar la clave JSON (Key type: JSON)
7. En Google Sheets, compartir la hoja con el email de la service account (solo lectura)

### Permisos requeridos en la hoja

El email de la service account debe tener acceso **Viewer** (lector) en la hoja de cálculo.

### Config reference

```typescript
interface SheetsConnectorConfig {
  spreadsheetId: string;   // ID de la hoja de cálculo (de la URL)
  credentials: object | string; // Objeto JSON de service account, o ruta al archivo
}
```

**Ejemplo de `spreadsheetId`:** En la URL `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit`, el ID es `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms`.

### Comportamiento del fetch

- La primera fila de cada hoja se usa como nombres de columna
- Las filas completamente vacías son omitidas
- Los nombres de columna se normalizan (se eliminan espacios al inicio/fin)
- Se puede especificar rango: `query.range = "A1:Z500"`
- Se puede especificar hoja: `query.sheetName = "Hoja2"`

## REST API Connector

### Config reference

```typescript
interface RestConnectorConfig {
  baseUrl: string;                          // URL base, ej: "https://api.ejemplo.com/v1"
  headers?: Record<string, string>;         // Headers adicionales
  authType?: 'none' | 'bearer' | 'basic';  // Tipo de autenticación
  authValue?: string;                       // Token o credenciales
}
```

### Opciones de autenticación

| `authType` | `authValue` | Header enviado |
|-----------|-------------|----------------|
| `none` | — | ninguno |
| `bearer` | `eyJhb...` | `Authorization: Bearer eyJhb...` |
| `basic` | `dXNlcjpwYXNz` | `Authorization: Basic dXNlcjpwYXNz` |

### Formato de respuesta esperado

El conector acepta dos formatos:

```json
// Formato 1: array directo
[{"id": 1, "nombre": "Ejemplo"}, ...]

// Formato 2: envelope con clave "data"
{
  "data": [{"id": 1, "nombre": "Ejemplo"}, ...],
  "total": 100
}
```

El timeout es de 10 segundos por request.

## Sync Engine

### Flujo de sincronización

```
runSync(conectorId)
  → getById(conectorId)          — obtiene config del conector
  → createSincronizacion(EN_PROCESO)  — registra inicio
  → connector.fetch({})          — obtiene datos
  → storeInCache(dataset, ttl)   — guarda en Redis
  → updateSincronizacion(COMPLETADA) — registra resultado
  → update(ultimaSync)           — actualiza timestamp
```

### Redis cache keys y TTL

| Key pattern | TTL |
|-------------|-----|
| `sync:{conectorId}:data` | Según `frecuenciaSync` del conector |

| `frecuenciaSync` | TTL |
|-----------------|-----|
| `30min` | 1800s |
| `1h` | 3600s |
| `4h` | 14400s |
| `daily` | 86400s |
| `manual` | 86400s |

Si Redis no está disponible, la sincronización continúa pero sin caché (error no fatal, logueado como warning).

### Cron schedules

| Valor | Expresión cron | Descripción |
|-------|---------------|-------------|
| `30min` | `*/30 * * * *` | Cada 30 minutos |
| `1h` | `0 * * * *` | Al inicio de cada hora |
| `4h` | `0 */4 * * *` | Cada 4 horas |
| `daily` | `0 20 * * *` | Diario a las 8pm |
| `manual` | — | Sin cron, solo manual |

Los cron jobs se inicializan al arrancar el servidor con `initCron()` y se detienen con `stopCron()`.

## API Reference

### GET /api/connectors
Lista todos los conectores (activos e inactivos).
- Auth: ADMIN

### POST /api/connectors
Crea un nuevo conector.
- Auth: ADMIN
- Body: `{ nombre, tipo, config, frecuenciaSync? }`

### GET /api/connectors/:id
Obtiene un conector por ID.
- Auth: ADMIN

### PUT /api/connectors/:id
Actualiza un conector.
- Auth: ADMIN
- Body: `{ nombre?, config?, activo?, frecuenciaSync? }`

### DELETE /api/connectors/:id
Soft-delete (desactiva) un conector.
- Auth: ADMIN

### POST /api/connectors/test
Prueba una configuración nueva antes de guardar.
- Auth: ADMIN
- Body: `{ nombre, tipo, config }`
- Response: `{ success, message, latencyMs?, details? }`

### POST /api/connectors/:id/test
Prueba un conector existente.
- Auth: ADMIN
- Response: `{ success, message, latencyMs?, details? }`

### GET /api/connectors/:id/sheets
Lista las hojas disponibles (solo para tipo GOOGLE_SHEETS).
- Auth: ADMIN
- Response: `{ sheets: string[] }`

### POST /api/connectors/:id/sync
Dispara sincronización manual.
- Auth: ADMIN, FACTURACION
- Response: `{ conectorId, success, rowsRead, rowsNew, durationMs, error? }`

### GET /api/connectors/:id/sync/history
Historial de sincronizaciones.
- Auth: ADMIN, FACTURACION
- Query: `?limit=20`
- Response: `Sincronizacion[]`

---

## Conectores REST

### Estado

Un conector REST **sí escribe en `atenciones`**. Hasta la versión 1.8.7 no lo hacía: la
persistencia estaba condicionada a `tipo === 'GOOGLE_SHEETS'`, de modo que un conector
REST sincronizaba en verde, reportaba filas leídas e insertaba cero registros sin avisar.

### Configurar uno

| Campo | Para qué |
|---|---|
| **URL base** | El servidor, sin la ruta. `https://api.ejemplo.com/v2` |
| **Ruta del endpoint** | Lo que se cuelga de la base. `facturacion/atenciones` |
| **Autenticación** | `Sin autenticación`, `Bearer token`, `Basic auth`, **`Token en cabecera propia`** o **`Login` (usuario y contraseña contra un endpoint)** |
| **Nombre de la cabecera** | Solo con `Token en cabecera propia`. P. ej. `X-Auth-Token` |
| **Correspondencia de campos** | Cómo se llama cada dato en la respuesta |
| **Ruta al listado** | Si la respuesta envuelve los registros: `resultado.items` |
| **Tiempo máximo** | Por defecto 15 s; el histórico completo suele necesitar más |

`Basic auth` es usuario y contraseña en base64 — **dos** datos. Una API que pide un token
en una cabecera propia necesita `Token en cabecera propia`, no Basic.

### `authType: 'login'` — sesión con usuario y contraseña

Para APIs que no entregan un token fijo, sino que exigen autenticarse y usar el token que
devuelven. El conector hace el login, guarda el token en memoria, y lo renueva solo cuando
el servidor lo rechaza — no en cada petición.

| Campo | Para qué |
|---|---|
| `loginEndpoint` | Ruta del login, relativa a la URL base. P. ej. `auth` |
| `loginBodyFormat` | `form` (x-www-form-urlencoded) o `json` |
| `loginUsuario` / `password` | Credenciales del usuario de API |
| `loginBodyExtra` | Campos adicionales que el login exija |
| `loginTokenPath` | Dónde viene el token en la respuesta. P. ej. `data.token` |
| `tokenPlacement` | `header` (por omisión) o **`queryParam`** |
| `tokenParamName` | Nombre del parámetro cuando va en la URL. P. ej. `token` |
| `loginRetryStatuses` | Códigos que significan "token caducado". Por omisión `[401, 403]` |

> **La renovación importa más de lo que parece.** Antes el token configurado se usaba tal
> cual y, al caducar, la sincronización fallaba hasta que alguien lo cambiara a mano. Con
> `loginRetryStatuses`, un 401 a mitad del histórico reautentica y reintenta esa página en
> vez de abandonar el cargue entero.

### Sincronización incremental

| Campo | Para qué |
|---|---|
| `incremental.activo` | Activa la sincronización incremental |
| `incremental.ventanaMeses` | Meses a refrescar. 2 = el actual y el anterior |
| `incremental.desdeParam` | Nombre del parámetro de la API que recibe la fecha de inicio. P. ej. `fechaDesde` |

Con ella activa, la sincronización normal pide solo desde el inicio de la ventana y
reemplaza solo esas fechas; cada noche a las 3 a. m. (hora de Colombia) corre además una
completa. `POST /api/connectors/:id/sync?modo=completa` fuerza una completa. Ver
`docs/MEDIFOLIOS.md` para el detalle y las garantías.

### Agenda de citas (proyección)

| Campo | Para qué |
|---|---|
| `agenda.activo` | Activa la lectura de citas pendientes con la misma credencial y el mismo candado |
| `agenda.endpointCitas` | Por omisión `citas/listar` (permiso **01010202**) |
| `agenda.endpointConvenios` | Por omisión `catalogos/convenios` (permiso **01041504**, opcional: sin él la EPS se vincula por nombre) |

Lo consume `citas-sync.service.ts`, no el conector: pide solo estado `P`, origen agenda, de hoy a
fin del mes siguiente. Corre cada 15 min en horario de trabajo y al final de cada sincronización
de consumos, siempre dentro del candado del conector. Un 403 se guarda con el mensaje de la API
y **no** provoca un re-login. Ver `docs/PROYECCION-AGENDA.md`.

### Paginación

| Campo | Para qué |
|---|---|
| `paginar` | Activa el recorrido por páginas |
| `paginaParam` / `limiteParam` | Nombres de los parámetros. P. ej. `pagina` y `limite` |
| `limite` | Registros por página. Por omisión 200 |
| `totalPaginasPath` | Dónde viene el total. P. ej. `data.totalPaginas` |
| `maxPaginas` | Tope de seguridad. Por omisión 500 |

> **Al llegar al tope, la sincronización FALLA en vez de guardar lo que lleva.** Es
> deliberado: un cargue parcial que se marca "Completada" es indistinguible de un mes
> tranquilo, y las cifras saldrían bajas sin que nada lo delate.

### La correspondencia de campos es lo que hace que funcione

El mapeador detecta columnas con expresiones regulares pensadas para hojas en español.
Casi ninguna API devuelve esos nombres, y varias formas habituales fallan de manera poco
evidente:

| Nombre en el origen | ¿Lo reconoce? | Por qué |
|---|---|---|
| `fechaAtencion` | Sí | Empieza por «fecha» |
| `valor_total` | **No** | `\b` no coincide antes de `_` |
| `numero_documento` | **No** | El patrón espera espacios, no guiones bajos |
| `nombreConvenio` | **No** | El patrón exige que empiece por «convenio» |

Con `valor_total` sin mapear, **todo el valor bruto entraría en cero** y el dashboard
mostraría atenciones sin facturación. Por eso el formulario pide la correspondencia de los
ocho campos canónicos: `fecha`, `valor`, `descripcion`, `entidad`, `profesional`,
`paciente`, `documento`, `autorizacion`.

#### Rutas con punto, para respuestas anidadas

El origen de cada campo admite una **ruta**, no solo un nombre de columna:
`eps.nomEps`, `medico.nomMedico`, `paciente.numIdPaciente`.

Hace falta porque muchas APIs devuelven objetos, no columnas planas. Sin esto, mapear
`entidad` al objeto `eps` metía en la columna el JSON entero
(`{"codEps":5,"nomEps":"NUEVA EPS"}`), que no casa con ningún alias de entidad: las filas
se insertaban y los reportes por entidad salían vacíos.

Cuando un campo se toma de una ruta anidada, **la raíz de esa ruta se descarta** de la
fila. Si no, el detector de columnas seguía prefiriendo el objeto original (`eps`) sobre
el canónico ya resuelto (`entidad`), y el problema volvía por la puerta de atrás.

> `entidad` y `profesional` se resuelven **por el texto del nombre** contra los alias de
> los catálogos. Si la API devuelve códigos en vez de nombres, esas columnas quedan nulas
> y los reportes por entidad y los honorarios salen vacíos aunque las filas se inserten.
> En ese caso hay que cargar los códigos como alias en Configuración → Entidades.

### Ahora la sincronización falla cuando no puede mapear

Si se leen registros pero no se mapea ninguno, la sincronización se marca **Fallida** y el
mensaje incluye las columnas recibidas. Antes quedaba «Completada» con cero filas, que era
indistinguible de un período sin actividad.

### Credenciales

`GET /api/connectors` y `GET /api/connectors/:id` devuelven las credenciales
**enmascaradas** como `[REDACTED]`: tokens, contraseñas, la clave privada de Google y
cualquier cabecera cuyo nombre contenga token, key, auth o secret. Al editar, ese valor se
reenvía tal cual y el servidor repone el real, así que cambiar el nombre de un conector no
borra su token.

> **Siguen guardándose sin cifrar** en la columna `config`. El enmascaramiento evita que
> salgan por la API, no protege un volcado de la base de datos.

### Limitaciones vigentes

- **Reemplazo total.** Cada sync borra las atenciones del conector y reinserta. Si la API
  devuelve solo los últimos días, se pierde el resto del histórico de esa fuente.
- **`hash_fila` es único a nivel global**, no por conector. Dos fuentes con la misma fila
  exacta chocan entre sí.

(La paginación y la renovación de token ya no son limitaciones — ver arriba.)
