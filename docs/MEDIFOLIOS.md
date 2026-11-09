# Medifolios — integración como fuente del dashboard

Medifolios es el sistema clínico donde hoy se registra la operación. Hasta ahora el
dashboard se alimentaba de una hoja de Google que alguien llenaba desde el cuadre de caja;
esta integración sustituye ese trabajo manual por lectura directa de la API.

> **Medifolios es producción clínica real.** El dashboard usa **solo endpoints de lectura
> (GET)**. Nada de `/citas/agendar`, `/citas/actualizar`, `/citas/eliminar` ni
> `/pacientes/crear`: esos modifican datos y disparan mensajes a pacientes.

> **Las credenciales no van en este repositorio.** Se cargan en el formulario de
> Configuración → Fuentes de datos y quedan en la columna `config` del conector. La API
> las devuelve enmascaradas (`[REDACTED]`). Conviene un **usuario de API dedicado** para
> el dashboard, distinto del que usa el agente de agendamiento, para poder revocar uno sin
> afectar al otro.

---

## Por qué `/consumos/buscar` y no `/facturacion/buscar`

Esta es la decisión que más condiciona todo lo demás, y la primera indicación que
recibimos apuntaba al endpoint equivocado.

`/facturacion/buscar` devuelve **facturas**: una fila por documento, con su total. No trae
la descripción del procedimiento. El dashboard no cuenta facturas — cuenta
**procedimientos**, porque de ahí salen el Mix por Servicio, la Capacidad Instalada y los
honorarios por profesional. Con facturas, el 100 % de las filas quedaría *sin clasificar*.

`/consumos/buscar` devuelve una fila **por procedimiento consumido**, que es exactamente
la unidad del dashboard. Y, de regalo, devuelve **nombres** en vez de códigos
(`eps.nomEps`, `medico.nomMedico`): eso evita tener que cargar los códigos de Medifolios
como alias en los catálogos de Entidades y Profesionales, que era el plan hasta descubrirlo.

Permiso requerido en el usuario de API: **`010103`**.

## Forma de la respuesta

```json
{
  "status": true,
  "message": "Consumos encontrados",
  "data": {
    "totalResultados": 450,
    "totalPaginas": 3,
    "pagina": 1,
    "limite": 200,
    "consumos": [
      {
        "fecha": "2026-08-01",
        "descripcion": "POTENCIALES EVOCADOS",
        "precioVentaBruto": 135000,
        "numAutorizacion": "AUT-1000",
        "paciente": { "numIdPaciente": "1000000", "nombreCompleto": "..." },
        "medico":   { "codMedico": 12, "nomMedico": "CRUZ" },
        "eps":      { "codEps": 5, "nomEps": "NUEVA EPS" }
      }
    ]
  }
}
```

Los datos van **envueltos** (`data.consumos`) y los campos que nos interesan están
**anidados**. Por eso el conector REST admite rutas con punto en la correspondencia de
campos; ver `docs/CONNECTORS.md`.

## Configuración del conector

| Campo | Valor |
|---|---|
| Tipo | `REST_API` |
| URL base | `https://<host>/ci4/public/v2` |
| Ruta del endpoint | `consumos/buscar` |
| Autenticación | `login` |
| `loginEndpoint` | `auth` |
| `loginBodyFormat` | `form` (x-www-form-urlencoded — con JSON devuelve 400) |
| `loginTokenPath` | `data.token` |
| `tokenPlacement` | `queryParam` |
| `tokenParamName` | `token` |
| `loginRetryStatuses` | `[401]` |
| `dataPath` | `data.consumos` |
| `paginar` | sí |
| `paginaParam` / `limiteParam` | `pagina` / `limite` |
| `limite` | `200` |
| `totalPaginasPath` | `data.totalPaginas` |

> El token va **en la URL como parámetro**, no en una cabecera. Es poco común y es la causa
> de que una configuración por lo demás correcta devuelva `401 Token de sesion invalido`.

### Correspondencia de campos

| Canónico | Ruta en Medifolios |
|---|---|
| `fecha` | `fecha` |
| `descripcion` | `descripcion` |
| `valor` | `precioVentaBruto` |
| `autorizacion` | `numAutorizacion` |
| `entidad` | `eps.nomEps` |
| `profesional` | `medico.nomMedico` |
| `paciente` | `paciente.nombreCompleto` |
| `documento` | `paciente.numIdPaciente` |

`precioVentaBruto` y no `precioVentaNeto` porque el dashboard reporta **facturación
bruta**; el neto descuenta ajustes y no es la cifra que se compara contra el presupuesto.

## Qué filas trae por omisión, y cómo acotarlas

Cada consumo trae `estatus`, `facturable` y `paquete`. Lo que dice la especificación:

| Campo | Valores | Comportamiento |
|---|---|---|
| `paquete` | `S` / `N` | **Sin filtro, la API devuelve solo `paquete = N`.** Los paquetes ya vienen excluidos; no hay que hacer nada. |
| `estatus` | `P` pendiente / `F` facturado | Sin filtro trae **ambos**. |
| `facturable` | `S` / `N` | Sin filtro trae **ambos**. |

Lo que **no** se puede saber leyendo la especificación es si el dashboard debe contar los
pendientes (`P`) o los no facturables (`N`): depende de qué venía contando el Sheet.

**Se prueba sin desplegar nada.** Estos filtros son parámetros de la URL, y el conector
admite parámetros fijos en su configuración (`params`, donde ya van `fechaDesde` y
`fechaHasta`). Para excluir los no facturables basta añadir `facturable = S` y
sincronizar; para contar solo lo facturado, `estatus = F`.

**Se decide comparando, no adivinando.** El camino es:

1. Mantener las dos fuentes cargadas (el Sheet como fuente del dashboard, Medifolios
   sincronizando en segundo plano).
2. Ir a **Configuración → Diagnóstico**, que enfrenta mes a mes los totales de cada
   conector.
3. Donde Medifolios dé de más, el exceso dirá qué filtro falta.

Hasta tener eso claro, **no se debe cambiar la fuente del dashboard a Medifolios**: las
cifras históricas cambiarían sin que nadie pueda explicar por qué.

## Cómo convive con el Sheet

Las dos fuentes pueden estar cargadas a la vez. Lo que decide qué ve el usuario es la
**fuente activa** (`conectores.es_fuente_activa`), que se marca con el botón *Usar como
fuente* en Configuración → Fuentes de datos.

Es distinto de `activo`, que decide si el conector **se sincroniza**. Durante la
transición hacen falta las dos cosas por separado: Medifolios sincronizando para poder
compararlo, y el Sheet alimentando el dashboard hasta que la comparación cuadre.

Si no hay ninguna fuente marcada, **los reportes suman todas** y cualquier mes presente en
dos fuentes aparece con la facturación duplicada. La pantalla muestra un aviso naranja
cuando eso pasa.

## Leer el historial de sincronizaciones

Configuración → Fuentes → **Historial**. Lo que significa cada error, y qué hacer:

| Lo que ves | Qué pasó | Qué hacer |
|---|---|---|
| `HTTP 401 Unauthorized` en 2–70 s | El token dejó de valer a mitad de la descarga. Con **dos sincronizaciones a la vez** se invalidaban el token entre sí (se sospecha que Medifolios emite un solo token vigente por usuario). | Desde la 1.9.7 no deberían solaparse. Si persiste **con una sola corriendo**, el usuario de la API se está usando en otro sitio a la vez: usar uno dedicado al dashboard. |
| `Duplicate entry '…' for key 'atenciones_hash_fila_key'` tras ~25 min | Dos sincronizaciones terminaron casi a la vez e insertaron las mismas filas; la segunda chocó con la primera. No se pierde nada: el guardado es una transacción y se revierte. | Mismo arreglo: el candado de sincronización. |
| Varias filas `EN PROCESO` con 0 filas | Sincronizaciones que quedaron colgadas porque el servidor se reinició o se desplegó a mitad de la descarga. | Se cierran solas como *Interrumpida* en la siguiente sincronización. |
| Varias entradas a la misma hora (`1:00 p. m.` ×4) | Cada proceso del servidor dispara el mismo cron. | Normal desde la 1.9.7: una corre y las demás se omiten sin dejar registro. |

### Una sola sincronización por fuente

`SyncService.runSync` toma un candado de MySQL (`GET_LOCK`, nombre
`maestro:sync:<id del conector>`) antes de empezar. Lo ven **todos los procesos** y se
suelta solo si el proceso muere, así que no hace falta adivinar un plazo de caducidad. Una
conexión dedicada lo sostiene mientras dura la descarga, con un latido cada 60 s para que
el servidor no la cierre por inactividad. Quien no lo obtiene **no falla**: se omite, porque
ya hay otra haciendo el trabajo. Código en `sync-lock.core.ts`.

### Cuánto tarda y por qué importa

Cada sincronización descarga **todo el histórico** (200 filas por página) y reemplaza todas
las atenciones del conector: con varios años cargados son unos 25 minutos. Mientras tanto el
dashboard sigue mostrando los datos anteriores —el reemplazo es una transacción—, pero
sincronizar cada hora significa estar descargando casi la mitad del tiempo. La salida es una
sincronización **incremental** (solo los últimos meses), que exige antes cambiar el `hash_fila`:
hoy incluye la posición de la fila en la descarga, que solo es estable con reemplazo total.

## Referencias

- Swagger: `https://balanceo-reportes.medifolios.net/API_DOCS/`
- Especificación: Medifolios API v6 (6.64, OAS 3.1)
