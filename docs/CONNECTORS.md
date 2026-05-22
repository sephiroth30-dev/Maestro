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
