# Modelo de datos

Qué guarda el sistema, qué **no** guarda, y las particularidades que hay que conocer
antes de escribir una consulta o prometer un reporte.

---

## Tablas

| Tabla | Para qué |
|---|---|
| `atenciones` | **La tabla central.** Una fila por registro importado del origen. |
| `entidades` | Catálogo de pagadores (EPS, ARL, convenios, particular). |
| `profesionales` | Catálogo de médicos y terapeutas. |
| `servicios` | Catálogo de procedimientos, con palabras clave de clasificación. |
| `presupuestos_mensuales` | Meta de facturación por mes. |
| `liquidaciones` | Honorarios calculados por profesional y período. |
| `liquidacion_ajustes` | Ajustes manuales sobre una liquidación. |
| `reglas_honorarios` | Matriz de tarifas: profesional × categoría. |
| `reglas_especiales_honorarios` | Excepciones a la matriz. |
| `capacidad_instalada` | Capacidad mensual por grupo de servicio. |
| `usuarios`, `refresh_tokens` | Cuentas y sesiones. |
| `conectores`, `sincronizaciones` | Orígenes de datos y su historial. |
| `audit_log` | Registro de acciones. |
| `dashboards`, `widgets` | Reservadas; sin uso activo. |

---

## `atenciones`

```
id                      VARCHAR(36)     identificador de la fila
descripcion_raw         TEXT            descripción literal del origen
descripcion_norm        TEXT            normalizada, para clasificar
fecha_dia               DATETIME(3)     fecha de la atención
mes_idx, anio           INT             derivados de fecha_dia
valor_bruto             DECIMAL(12,2)   valor facturado
numero_autorizacion     VARCHAR(255)
es_telemetria           BOOLEAN
hash_fila               VARCHAR(64)     clave de deduplicación
entidad_id              FK entidades
entidad_nombre_raw      VARCHAR(255)    texto original, antes de resolver la entidad
profesional_id          FK profesionales
profesional_nombre_raw  VARCHAR(200)
servicio_id             FK servicios
conector_id             FK conectores
paciente_nombre         VARCHAR(255)    NULL — solo si el origen trae la columna
paciente_documento      VARCHAR(50)     NULL — ídem
created_at              DATETIME(3)
```

### Lo que NO existe

**No hay datos demográficos de paciente.** Ni edad, ni fecha de nacimiento, ni sexo, ni
ciudad, ni dirección, ni teléfono, ni régimen, ni diagnóstico. Los únicos campos de
paciente son `paciente_nombre` y `paciente_documento`, ambos opcionales y de texto libre.

La única segmentación poblacional disponible es el **tipo de pagador**
(`entidades.tipo`: EPS, CONVENIO, PARTICULAR, ARL, PREPAGADA, OTRO).

Para poder segmentar por edad o sexo habría que, en este orden:

1. Agregar esas columnas al archivo de origen (el conector solo lee **A:Z**).
2. Añadir los patrones de detección en `sheet-atencion-mapper.ts`.
3. Crear las columnas con una migración `mXX`.

---

## Particularidades que cambian cómo se consulta

### 1. La sincronización borra y reinserta

`sync.service.ts` hace `DELETE FROM atenciones WHERE conector_id = ?` y vuelve a insertar
todo, con `id` nuevos. Consecuencias:

- **`created_at` e `id` no sirven como línea de tiempo**: se reinician en cada corrida.
  Para historia, siempre `fecha_dia`.
- Cualquier dato añadido a una fila desde la aplicación se perdería en la siguiente
  sincronización. Por eso las correcciones se hacen sobre los **catálogos** (alias de
  entidad, palabras clave de servicio) y no sobre las atenciones.

### 2. Atención no es lo mismo que visita, ni que sesión

- **Atención** — una fila. Un EMG y un VCN el mismo día son dos.
- **Visita** — un paciente en una fecha. Ese mismo caso es una.
- **Sesión** — para servicios marcados `tipo_conteo = 'sesion'`, las atenciones del mismo
  paciente en la misma fecha cuentan como una. Es lo que usa Capacidad.

Confundirlos es la forma más fácil de dar una cifra equivocada. Los reportes dicen
explícitamente cuál están contando.

### 3. La llave de paciente es una expresión, no una columna

`pacientes.repo.ts` la construye así:

```sql
NULLIF(COALESCE(
  NULLIF(REGEXP_REPLACE(UPPER(TRIM(paciente_documento)), '[^0-9A-Z]', ''), ''),
  NULLIF(REGEXP_REPLACE(UPPER(TRIM(paciente_nombre)), '[[:space:]]+', ' '), '')
), '')
```

Prefiere el documento y cae al nombre. Normaliza para absorber las variantes reales de
digitación: `1.234.567` frente a `1234567`, `"  MARIA  PEREZ "` frente a `"Maria Perez"`.

Dos cosas a tener presentes:

- **No usar el patrón `COALESCE(documento, nombre, id)`** que aparece en
  `honorarios.repo.ts`. Ese tercer respaldo es correcto para contar *sesiones* (cada fila
  anónima es su propia sesión) pero infla el conteo de *pacientes* en uno por cada
  registro sin identificar.
- **Al ser una expresión sobre dos columnas, ningún índice B-tree la sirve.** Se probó
  indexar `paciente_documento` y `paciente_nombre` y se descartó: MySQL no puede usarlos
  y solo encarecen la sincronización. Si el volumen llega a molestar, la salida es
  materializar la llave en una columna `paciente_key` durante la importación.

### 4. Nada garantiza que el paciente venga identificado

Ambas columnas son opcionales y se llenan solo si el archivo de origen trae una cabecera
que el mapeador reconozca. Por eso la analítica de pacientes calcula y muestra siempre la
**cobertura** antes que cualquier cifra, y toda consulta excluye las filas sin llave en
lugar de tratarlas como un paciente anónimo.

### 5. Los conteos por dimensión no son aditivos

Un paciente atendido por dos pagadores cuenta en ambos tramos. `SUM()` sobre esa columna
no da el total de pacientes únicos. Se presentan como tabla o barras, nunca como torta.

---

## Migraciones

Dos sistemas conviven:

**Versionadas** — `backend/prisma/migrations/0001_init … 0009_capacidad_instalada`. Crean
las tablas base y siembran catálogos.

**En arranque** — `backend/src/services/schema-migrations.service.ts`, entradas `m01` en
adelante. Se ejecutan en cada inicio y son las que realmente están en producción.

> **No hay registro de migraciones aplicadas: la lista se reejecuta completa en cada
> arranque.** La idempotencia depende de `IF NOT EXISTS` o de un guardia explícito. Una
> migración de datos sin condición que la desactive volvería a aplicarse indefinidamente
> — por eso `m16` lleva `AND modulos NOT LIKE '%"pacientes"%'`: sin eso, cada reinicio
> añadiría otra copia hasta desbordar la columna.

**Los índices necesitan guardia por columna.** `CREATE INDEX IF NOT EXISTS` es sintaxis de
MariaDB y MySQL 8 la rechaza como error de sintaxis, así que esas migraciones fallaban en
cada arranque sin crear nada. El runner consulta ahora `information_schema.STATISTICS`
comparando la **columna** y no el nombre: una clave foránea ya crea su propio índice con
otro nombre, y comparar nombres construiría un duplicado.

> **`schema.prisma` está desactualizado.** No refleja varias columnas y tablas que sí
> existen en producción. La fuente de verdad es
> `schema-migrations.service.ts` más las migraciones SQL.

---

## Importación desde el origen

`sheets.connector.ts` lee **columnas A:Z** de una hoja de cálculo. Lo que esté más allá
de la Z es invisible para el sistema.

`sheet-atencion-mapper.ts` detecta las columnas por expresiones regulares sobre la
cabecera y extrae **ocho campos**: fecha, descripción, autorización, entidad, profesional,
valor, paciente y documento. **Cualquier otra columna se descarta al guardar.**

Para saber qué trae realmente un archivo, la sincronización registra la lista completa de
cabeceras detectadas (`Column mapping detected for row set`), y está el endpoint
`GET /api/connectors/:id/column-diagnostico`.
