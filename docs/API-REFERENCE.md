# Referencia de la API

Inventario completo de los endpoints del backend, con el rol que exige cada uno.
Generado a partir de los controladores en `backend/src/controllers/`; si se agrega un
endpoint, agregarlo también aquí.

Documentos relacionados: [API-AUTH.md](API-AUTH.md) (autenticación en detalle),
[API-REPORTES.md](API-REPORTES.md) (contratos de los reportes),
[CONNECTORS.md](CONNECTORS.md) (capa de conectores).

---

## Convenciones

**Autenticación.** Todo endpoint salvo `POST /api/auth/login` y `POST /api/auth/refresh`
exige la cabecera `Authorization: Bearer <accessToken>`. El token de acceso dura 15
minutos; el cliente lo renueva solo con el refresh token.

**Roles.** Siete: `ADMIN`, `GERENCIA`, `DIRECCION`, `FACTURACION`, `COORDINADORA`,
`ADMISIONES`, `RECURSOS_HUMANOS`. Los grupos que se repiten:

| Grupo | Roles |
|---|---|
| `REPORTES_ROLES` | ADMIN, GERENCIA, DIRECCION, FACTURACION, COORDINADORA, ADMISIONES |
| `HON_ROLES` | ADMIN, FACTURACION, GERENCIA, DIRECCION, RECURSOS_HUMANOS |
| `APROBACION` | ADMIN, GERENCIA, DIRECCION |
| `CAPACIDAD_LECTURA` | ADMIN, GERENCIA, DIRECCION, FACTURACION |

> **Rol frente a módulo.** El backend autoriza por **rol**; el frontend decide qué
> aparece en el menú por **módulo** (`user.modulos`). Son dos capas distintas: quitarle
> un módulo a alguien le oculta la página, pero no le cierra el endpoint. La
> autorización real es la del backend.

**Filtro de período.** Los endpoints de reportes aceptan dos formas, excluyentes:

- `?mes_idx=8&anio=2026` — un mes concreto.
- `?start_date=2026-08-01&end_date=2026-08-31` — un rango.

Si vienen ambas, **manda el rango**. Opcionalmente `entidad_id` y `dia_semana`
(`DAYOFWEEK` de MySQL: 2 = lunes … 6 = viernes).

> **Restricción de ADMISIONES.** A ese rol el servidor le fuerza el mes en curso y
> **anula el rango** antes de consultar. Sin anularlo, como el rango tiene prioridad,
> bastaba enviar fechas explícitas para saltarse el candado.

**Errores.** Formato uniforme:

```json
{ "error": "Bad Request", "message": "descripción", "statusCode": 400 }
```

`401` sin token o vencido · `403` rol insuficiente · `400` validación (Zod) ·
`404` no existe · `429` límite de peticiones.

---

## Autenticación — `/api/auth`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Devuelve `accessToken`, `refreshToken` y el usuario. |
| POST | `/api/auth/refresh` | Público (con refresh token) | Renueva el token de acceso. |
| POST | `/api/auth/logout` | Autenticado | Invalida el refresh token. |
| GET | `/api/auth/me` | Autenticado | Usuario de la sesión actual. |
| POST | `/api/auth/change-password` | Autenticado | Cambia la contraseña propia. |

Detalle de cuerpos y respuestas en [API-AUTH.md](API-AUTH.md).

---

## Reportes — `/api/reportes`

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/reportes/kpis` | REPORTES_ROLES | Indicadores del período: facturación, presupuesto, cumplimiento, atenciones, ticket promedio, proyección de cierre. |
| GET | `/api/reportes/entidades` | REPORTES_ROLES | Facturación agrupada por entidad, con tipo y participación. |
| GET | `/api/reportes/cumplimiento/semanal` | REPORTES_ROLES | Semanas del mes con estimado, venta y estado. |
| GET | `/api/reportes/dias-semana` | REPORTES_ROLES | Facturación por día de la semana (lunes a viernes). |
| GET | `/api/reportes/tendencia?meses=12` | REPORTES_ROLES | Serie mensual de facturado frente a presupuesto. |
| GET | `/api/reportes/servicios` | REPORTES_ROLES | Mix por servicio, con cantidad, valor y sin clasificar. |
| GET | `/api/reportes/presupuestos?anio=2026` | REPORTES_ROLES | Presupuestos mensuales del año. |
| POST | `/api/reportes/presupuestos` | ADMIN | Crea o actualiza el presupuesto de un mes. |

Contratos completos en [API-REPORTES.md](API-REPORTES.md).

### Analítica de pacientes

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/reportes/pacientes` | REPORTES_ROLES | Ocho agregados en una sola respuesta: cobertura, resumen, frecuencia, pagador, servicio y retención. |
| GET | `/api/reportes/detalle-atenciones` | REPORTES_ROLES | Una fila por atención del período. Máximo 5.000 (`?limit=`). |

`/api/reportes/pacientes` devuelve:

```jsonc
{
  "cobertura": {
    "filas": 1840, "filas_con_paciente": 1211, "filas_con_documento": 980,
    "cobertura_pct": 65.8, "cobertura_documento_pct": 53.3,
    "valor_total": 412300000, "valor_sin_paciente": 138900000,
    "por_conector": [{ "conector_nombre": "…", "filas": 1500, "cobertura_pct": 80.7 }]
  },
  "resumen": {
    "pacientes_unicos": 704, "atenciones_con_paciente": 1211, "visitas_unicas": 902,
    "promedio_atenciones": 1.7, "promedio_visitas": 1.3,
    "nuevos": 431, "recurrentes": 273, "nuevos_pct": 61.2,
    "historia_desde": "2024-01-02"
  },
  "frecuencia": [{ "bucket": "1", "pacientes": 520, "pct": 73.9 }],
  "por_pagador": [{ "nombre": "EPS", "pacientes": 402, "atenciones": 690, "valor": 210000000 }],
  "pacientes_multi_pagador": 25,
  "por_servicio": [{ "nombre": "EMG / VCN", "pacientes": 210, "atenciones_por_paciente": 1.9 }],
  "retencion": [{ "label": "Jun 26", "pacientes": 388, "retenidos": 121, "retencion_pct": 31.2 }]
}
```

Tres advertencias que conviene respetar en cualquier cliente:

1. **Todo se calcula sobre las filas con paciente identificado.** `cobertura_pct` no es
   un adorno: si vale 65, las cifras describen el 65 % de la operación. Mostrarlo es
   obligatorio.
2. **`por_pagador` y `por_servicio` no suman `pacientes_unicos`.** Un paciente atendido
   por dos pagadores cuenta en ambos. No representarlos como torta.
3. **`retencion_pct` puede venir `null`.** Un mes solo se puntúa cuando el siguiente ya
   terminó; dibujar el `null` como cero produce un desplome inexistente.

### Diagnóstico y catálogos (solo ADMIN)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/reportes/diagnostico` | Calidad de datos por conector y mes. |
| GET | `/api/reportes/servicios/diagnostico` | Servicios sin clasificar. |
| GET | `/api/diagnostico/sin-servicio` | Descripciones del origen sin servicio asignado. |
| GET | `/api/diagnostico/sin-profesional` | Registros sin profesional. |
| GET | `/api/diagnostico/sin-entidad` | Registros sin entidad. |
| POST | `/api/diagnostico/sin-entidad/crear-entidad` | Crea la entidad y reasigna sus atenciones. |
| GET | `/api/diagnostico/servicio-agrupaciones` | Qué descripciones del origen caen en cada servicio. |
| POST | `/api/admin/reclasificar-servicios` | Reaplica las palabras clave al histórico. |
| POST | `/api/admin/reclasificar-profesionales` | Reasigna profesionales al histórico. |
| GET · POST | `/api/profesionales` | Lista y alta de profesionales. |
| PATCH | `/api/profesionales/:id` | Nombre, alias, especialidad, nómina. |
| GET | `/api/entidades` | Catálogo de entidades. |
| PATCH · DELETE | `/api/entidades/:id` | Edita o elimina una entidad. |
| POST | `/api/entidades/reclasificar` | Reaplica los alias al histórico. |
| GET | `/api/servicios` | Catálogo de servicios. |
| PATCH | `/api/servicios/:id` | Nombre visible, modo de conteo, palabras clave. |

---

## Honorarios y liquidaciones

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/honorarios?mes_idx&anio` | ADMIN, FACTURACION, GERENCIA, DIRECCION | Matriz profesional × categoría con totales. |
| GET | `/api/honorarios/contribucion` | + RECURSOS_HUMANOS | Facturación generada por médico. |
| GET | `/api/liquidaciones?desde&hasta` | HON_ROLES | Liquidaciones del período. |
| POST | `/api/liquidaciones/generar` | HON_ROLES | Calcula las liquidaciones. No toca las ya aprobadas o pagadas. |
| POST | `/api/liquidaciones/:id/aprobar` | APROBACION | Pasa a APROBADO. |
| POST | `/api/liquidaciones/:id/pagar` | APROBACION | Pasa a PAGADO. |
| POST | `/api/liquidaciones/:id/revertir` | APROBACION | Devuelve al estado anterior. |
| POST | `/api/liquidaciones/aprobar-lote` | APROBACION | Aprobación masiva. |
| POST | `/api/liquidaciones/pagar-lote` | APROBACION | Pago masivo. |
| GET | `/api/liquidaciones/:id/pdf` | HON_ROLES | Comprobante en PDF (generado en el servidor con pdfkit). |

**Estados:** `CALCULADO` → `APROBADO` → `PAGADO`. Una liquidación aprobada o pagada
queda congelada: al recalcular no se modifica.

**Nómina simulada.** Los profesionales marcados `es_nomina` reciben una liquidación con
`es_simulado = true`: se calcula con las mismas reglas para poder analizar rentabilidad,
pero no se aprueba ni se paga, y queda fuera de los totales.

### Ajustes manuales

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET · POST | `/api/liquidaciones/:id/ajustes` | HON_ROLES | Lista y crea ajustes. |
| POST | `/api/ajustes/:id/autorizar` | APROBACION | Autoriza el ajuste. |
| POST | `/api/ajustes/:id/rechazar` | APROBACION | Rechaza, con motivo. |
| DELETE | `/api/ajustes/:id` | HON_ROLES | Elimina un ajuste pendiente. |

Estados: `PENDIENTE` → `AUTORIZADO` | `RECHAZADO`. Solo los autorizados suman.

### Reglas de honorarios (solo ADMIN)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/reglas-honorarios` | Matriz de tarifas y reglas especiales. |
| PUT | `/api/reglas-honorarios` | Crea o actualiza una regla. |
| DELETE | `/api/reglas-honorarios/:id` | Elimina una regla. |
| POST | `/api/reglas-honorarios/duplicar` | Copia las reglas de un profesional a otro. |
| PATCH | `/api/reglas-honorarios/especiales/:id` | Edita una regla especial. |

---

## Capacidad instalada

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/capacidad?anio` | CAPACIDAD_LECTURA | Capacidad configurada por grupo. |
| GET | `/api/capacidad/grupos` | CAPACIDAD_LECTURA | Catálogo de los 12 grupos y su base de conteo por omisión. |
| GET | `/api/capacidad/utilizacion?anio&mes_idx` | CAPACIDAD_LECTURA | Demanda frente a capacidad, con % de ocupación. Devuelve `pacientes`, `estudios`, `base`, `sesiones` y `sinPaciente`. |
| GET | `/api/capacidad/utilizacion/rango?desde_anio&desde_mes&hasta_anio&hasta_mes` | CAPACIDAD_LECTURA | Lo mismo, una fila por grupo **y mes**. Máximo 36 meses. |
| POST | `/api/capacidad` | ADMIN | Define la capacidad de un grupo y mes. |
| POST | `/api/capacidad/bulk` | ADMIN | Carga masiva. |
| DELETE | `/api/capacidad/:grupo/:anio/:mesIdx` | ADMIN | Borra la configuración. |

La ocupación se calcula sobre **sesiones únicas**, no sobre registros: los servicios en
modo `sesion` agrupan las atenciones del mismo paciente en la misma fecha.

---

## Usuarios (solo ADMIN)

| Método | Ruta | Descripción |
|---|---|---|
| GET · POST | `/api/usuarios` | Lista y alta. |
| PATCH | `/api/usuarios/:id` | Nombre, rol, módulos, estado. |
| DELETE | `/api/usuarios/:id` | Desactiva (no borra: conserva el historial). |
| POST | `/api/usuarios/:id/reset-password` | Genera contraseña temporal. |

Módulos válidos: `dashboard`, `reportes`, `pacientes`, `honorarios`, `capacidad`,
`auditoria`, `configuracion`, `aprobar`.

---

## Auditoría (ADMIN, FACTURACION)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/auditoria?page&limit&accion&desde&hasta` | Eventos paginados. **`limit` topa en 200.** |
| GET | `/api/auditoria/acciones` | Acciones distintas registradas, para el filtro. |

El tope de 200 es la razón de que la exportación pagine de a 200 en peticiones
secuenciales, con un máximo de 2.000 registros por archivo.

---

## Conectores (solo ADMIN, salvo donde se indica)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET · POST | `/api/connectors` | ADMIN | Lista y alta. |
| GET · PUT · DELETE | `/api/connectors/:id` | ADMIN | Detalle, edición y borrado. |
| POST | `/api/connectors/test` | ADMIN | Prueba una configuración sin guardarla. |
| POST | `/api/connectors/:id/test` | ADMIN | Prueba un conector existente. |
| GET | `/api/connectors/:id/sheets` | ADMIN | Pestañas disponibles en el documento. |
| POST | `/api/connectors/:id/sync` | ADMIN, FACTURACION | Fuerza una sincronización. |
| GET | `/api/connectors/:id/sync/history` | ADMIN, FACTURACION | Historial de sincronizaciones. |
| GET | `/api/connectors/:id/column-diagnostico` | ADMIN | Qué columnas detectó del origen. |
| DELETE | `/api/connectors/:id/data` | ADMIN | Borra las atenciones de ese conector. |
| DELETE | `/api/connectors/data/orphan` | ADMIN | Borra atenciones sin conector. |

> **La sincronización es destructiva por conector**: hace `DELETE` de todas las
> atenciones del conector y las reinserta. Por eso `created_at` e `id` de `atenciones`
> se reinician en cada corrida y **no sirven como línea de tiempo** — para eso está
> `fecha_dia`.

Arquitectura de la capa en [CONNECTORS.md](CONNECTORS.md).

---

## Sistema

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/version` | Público | `{ version, commit, env }`. Útil para confirmar qué está desplegado. |

`/api/version` es la forma más rápida de saber si un despliegue llegó: el `commit`
corresponde al `git rev-parse --short HEAD` del servidor.
