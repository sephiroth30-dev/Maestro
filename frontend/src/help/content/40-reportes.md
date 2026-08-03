---
id: reportes
titulo: Reportes
modulo: reportes
orden: 40
claves: facturacion, filtros, entidad, eps, servicio, dia de la semana, rango de fechas, detalle
---

## Para qué sirve

Analizar la facturación en detalle. Es la pantalla donde se responde «¿cuánto facturamos
en X, a Y entidad, en Z período?».

## Elegir el período

Arriba a la derecha hay dos modos:

- **Mes** — uno de los últimos seis meses.
- **Rango** — fechas exactas, o los atajos *Hoy*, *Ayer*, *Esta semana*, *Sem. pasada*, *Año*.

## Filtrar haciendo clic

No hay un panel de filtros: **se filtra pulsando sobre las propias gráficas y tablas.**

| Para filtrar por… | Pulsa en… |
|---|---|
| Un día de la semana | Una barra de «Facturado por día» |
| Un tipo de pagador | Un segmento del donut de Mix Pagador |
| Una entidad concreta | Una fila de la tabla Facturación por Entidad |
| Flujo de caja o cobro | Las tarjetas de resumen bajo el donut |

Los filtros activos salen como etiquetas de colores bajo el encabezado. Se acumulan, y
cada uno se quita con su **X**.

## Las tablas

- **Facturación por entidad** — entidad, tipo, atenciones, valor y participación.
- **Mix por servicio** — qué procedimientos generan el volumen y cuáles el dinero.

Ambas se ordenan pulsando el encabezado de la columna.

## Descargar el detalle

El botón **Detalle** del encabezado descarga una fila por atención: fecha, paciente,
documento, entidad, profesional, servicio y valor. Es la base para armar análisis propios
en Excel.

<details>
<summary>La tabla muestra 10 filas, pero se exportan todas</summary>

La tabla de entidades muestra las diez primeras hasta que pulsas «Ver todas». La
exportación **siempre incluye todas las filas del filtro activo**, no solo las visibles.
El archivo lo indica en una nota.

</details>

<details>
<summary>Límite del detalle y qué hacer si se queda corto</summary>

El botón Detalle descarga como máximo **5.000 atenciones**. Si el período tiene más, el
archivo lo advierte y hay que acotar el rango de fechas y descargar por partes.

El límite existe porque el archivo se arma completo en la memoria del navegador; por
encima de esa cifra la pestaña se congelaría.

</details>
