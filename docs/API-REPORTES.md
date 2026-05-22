# API — Reportes de Facturación

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

## Roles con acceso

| Endpoint                        | Roles permitidos                                  |
|---------------------------------|---------------------------------------------------|
| `GET /api/reportes/kpis`        | ADMIN, GERENCIA, DIRECCION, FACTURACION           |
| `GET /api/reportes/entidades`   | ADMIN, GERENCIA, DIRECCION, FACTURACION           |
| `GET /api/reportes/cumplimiento/semanal` | ADMIN, GERENCIA, DIRECCION, FACTURACION  |
| `GET /api/reportes/dias-semana` | ADMIN, GERENCIA, DIRECCION, FACTURACION           |
| `GET /api/reportes/tendencia`   | ADMIN, GERENCIA, DIRECCION, FACTURACION           |
| `GET /api/reportes/presupuestos`| ADMIN, GERENCIA, DIRECCION, FACTURACION           |
| `POST /api/reportes/presupuestos`| ADMIN only                                       |

---

## GET /api/reportes/kpis

Retorna KPIs del mes seleccionado.

**Query params:**

| Param        | Tipo    | Default         | Descripción                      |
|-------------|---------|-----------------|----------------------------------|
| `mes_idx`   | number  | mes actual      | Mes (1–12)                       |
| `anio`      | number  | año actual      | Año (e.g. 2026)                  |
| `entidad_id`| string  | —               | Filtrar por ID de entidad        |

**Respuesta 200:**

```json
{
  "facturacion_bruta": 56234500,
  "presupuesto": 357411711,
  "cumplimiento_pct": 15.7,
  "atenciones": 127,
  "ticket_promedio": 442791,
  "proyeccion_cierre": 263800000,
  "proyeccion_cumplimiento_pct": 73.8,
  "dias_transcurridos": 3,
  "dias_restantes": 18,
  "facturacion_hoy": 4250000,
  "promedio_diario": 18744833,
  "semanas_en_meta": 0,
  "semanas_total": 5
}
```

### Fórmulas de KPIs

| KPI                          | Fórmula                                                    |
|------------------------------|------------------------------------------------------------|
| `facturacion_bruta`          | `SUM(valor_bruto)` WHERE mes_idx=X AND anio=Y              |
| `presupuesto`                | Valor en tabla `presupuestos_mensuales`                    |
| `cumplimiento_pct`           | `(facturacion_bruta / presupuesto) * 100`                  |
| `atenciones`                 | `COUNT(id)` del mes                                        |
| `ticket_promedio`            | `facturacion_bruta / atenciones`                           |
| `dias_transcurridos`         | `COUNT DISTINCT fecha_dia` del mes                         |
| `dias_restantes`             | Días hábiles (Lun–Vie) restantes en el mes desde hoy       |
| `promedio_diario`            | `facturacion_bruta / dias_transcurridos`                   |
| `proyeccion_cierre`          | `facturacion_bruta + (promedio_diario * dias_restantes)`   |
| `proyeccion_cumplimiento_pct`| `(proyeccion_cierre / presupuesto) * 100`                  |
| `facturacion_hoy`            | `SUM(valor_bruto)` WHERE fecha_dia = today                 |
| `semanas_en_meta`            | Semanas cerradas con venta ≥ presupuesto_semana            |

---

## GET /api/reportes/entidades

Retorna facturación agrupada por entidad pagadora.

**Query params:** `mes_idx`, `anio` (igual que /kpis)

**Respuesta 200:**

```json
{
  "rows": [
    {
      "entidad": "SANITAS",
      "tipo": "EPS",
      "es_grupo": false,
      "cantidad": 23,
      "valor_bruto": 12450000,
      "participacion_pct": 22.1
    }
  ],
  "total": 56234500
}
```

---

## GET /api/reportes/cumplimiento/semanal

Divide el mes en semanas Dom–Sáb y calcula cumplimiento por semana.

**Query params:** `mes_idx`, `anio`

**Respuesta 200:**

```json
{
  "semanas": [
    {
      "numero": 1,
      "fecha_ini": "2026-05-01",
      "fecha_fin": "2026-05-02",
      "estimado": 71482342,
      "venta": 14220000,
      "cumplimiento_pct": 19.9,
      "estado": "CERRADA"
    },
    {
      "numero": 2,
      "fecha_ini": "2026-05-03",
      "fecha_fin": "2026-05-09",
      "estimado": 71482342,
      "venta": 42014500,
      "cumplimiento_pct": 58.8,
      "estado": "EN_CURSO"
    }
  ]
}
```

**Estados de semana:**

| Estado    | Descripción                        |
|-----------|------------------------------------|
| `CERRADA` | La semana ya terminó               |
| `EN_CURSO`| La semana está en progreso hoy     |
| `FUTURA`  | La semana no ha comenzado          |

---

## GET /api/reportes/dias-semana

Promedio de facturación por día de la semana (Lun–Sáb) para el mes dado.

**Query params:** `mes_idx`, `anio`

**Respuesta 200:**

```json
[
  { "dia": "Lunes",     "dia_num": 1, "promedio": 18200000, "total": 54600000, "atenciones": 42 },
  { "dia": "Martes",    "dia_num": 2, "promedio": 16800000, "total": 50400000, "atenciones": 38 },
  { "dia": "Miércoles", "dia_num": 3, "promedio": 17500000, "total": 52500000, "atenciones": 40 }
]
```

---

## GET /api/reportes/tendencia

Totales mensuales históricos para gráfico de tendencia.

**Query params:**

| Param   | Tipo   | Default | Descripción              |
|---------|--------|---------|--------------------------|
| `meses` | number | 6       | Número de meses (1–36)   |

**Respuesta 200:**

```json
[
  { "mes": "Ene 2026", "anio": 2026, "mesIdx": 1, "total": 248320000, "presupuesto": 263733553 },
  { "mes": "Feb 2026", "anio": 2026, "mesIdx": 2, "total": 285600000, "presupuesto": 290106909 }
]
```

---

## GET /api/reportes/presupuestos

Lista todos los presupuestos mensuales.

**Respuesta 200:**

```json
[
  { "id": "uuid", "anio": 2026, "mes": 1, "monto": 263733553, "notas": null, "createdAt": "2026-05-22T..." },
  { "id": "uuid", "anio": 2026, "mes": 2, "monto": 290106909, "notas": null, "createdAt": "2026-05-22T..." }
]
```

---

## POST /api/reportes/presupuestos

Crea o actualiza un presupuesto mensual. **Solo ADMIN.**

**Body:**

```json
{
  "anio": 2026,
  "mes": 6,
  "monto": 357411711,
  "notas": "Ajustado por junta directiva"
}
```

**Respuesta 200:**

```json
{
  "id": "uuid",
  "anio": 2026,
  "mes": 6,
  "monto": 357411711,
  "notas": "Ajustado por junta directiva"
}
```

---

## Cache TTL

| Cache key                          | TTL        | Contenido                          |
|------------------------------------|------------|------------------------------------|
| `kpis:{mesIdx}:{anio}`             | 30 minutos | KPIs del mes                       |
| `kpis:{mesIdx}:{anio}:{entidadId}` | 30 minutos | KPIs filtrados por entidad         |
| `entidades:{mesIdx}:{anio}`        | 30 minutos | Mix pagador por entidad            |
| `cumplimiento:{mesIdx}:{anio}`     | 30 minutos | Cumplimiento semanal               |
| `diasemana:{mesIdx}:{anio}`        | 1 hora     | Promedios por día de semana        |
| `tendencia:{meses}`                | 1 hora     | Tendencia mensual                  |

Si Redis no está disponible, los datos se calculan en vivo desde la base de datos (graceful fallback).

---

## Opciones de filtro

| Parámetro    | Tipo   | Endpoints                     | Descripción             |
|-------------|--------|-------------------------------|-------------------------|
| `mes_idx`   | int    | kpis, entidades, cumplimiento, dias-semana | Mes 1–12 |
| `anio`      | int    | kpis, entidades, cumplimiento, dias-semana | Año       |
| `entidad_id`| string | kpis                          | UUID de la entidad      |
| `meses`     | int    | tendencia                     | Número de meses 1–36    |
