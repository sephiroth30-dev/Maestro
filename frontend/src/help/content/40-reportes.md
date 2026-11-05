---
id: reportes
titulo: Reportes
modulo: reportes
orden: 40
claves: facturacion, filtros, entidad, eps, servicio, dia de la semana, rango de fechas, detalle, comparar, comparacion, año anterior, interanual, variacion, meses
---

## Para qué sirve

Analizar la facturación en detalle. Es la pantalla donde se responde «¿cuánto facturamos
en X, a Y entidad, en Z período?».

## Elegir el período

Arriba a la derecha hay dos modos:

- **Mes** — los meses **del año en curso** que tienen datos cargados, del más reciente al
  más antiguo.
- **Rango** — fechas exactas, o los atajos *Hoy*, *Ayer*, *Esta semana*, *Sem. pasada*, *Año*.

> La lista sale de los datos, no del calendario: un mes sin nada cargado no aparece. Si
> falta un mes que debería estar, el problema está en la fuente, no en este selector.
>
> Los meses de años anteriores no se eligen como mes principal, pero **sí están disponibles
> para comparar**. Para mirar un periodo antiguo por sí solo, usa **Rango**.

## Comparar contra otro mes

La casilla **Comparar** enfrenta el periodo elegido con otro. Funciona en modo **Mes** y con
el atajo **Año** (ver más abajo).

En modo **Mes**, enfrenta el mes elegido con otro. Por omisión
propone **el mismo mes del año anterior** —Enero 2026 contra Enero 2025—, que es la
comparación que tiene sentido en una clínica: diciembre y enero no se parecen, pero dos
eneros sí.

Con la comparación activa:

- La primera ficha, **Facturación Bruta**, muestra la cifra del periodo, la del periodo
  comparado y el **% de crecimiento**. Las otras tres tarjetas muestran su variación
  («+18,4 % vs Enero 2025»).
- Aparece el bloque **Comparativo de totales**: la facturación, las atenciones y el ticket
  de cada mes en cifras absolutas, la variación, y el desglose por tipo de pagador.
- **Facturado por día** y **Cumplimiento semanal** dibujan dos barras: la del mes
  comparado (más clara, a la izquierda) y la del mes mostrado. Los días se casan por día de
  la semana y las semanas por número (la 1 con la 1), porque dos meses no comparten fechas.
- La tabla de **entidades** y la de **servicios** ganan una columna con la cifra del mes
  comparado y su variación: verde si subió, roja si bajó, gris si quedó igual.

Un **—** en esa columna significa que esa entidad o ese procedimiento **no tuvo movimiento
en el mes comparado**. Y al revés: las tablas listan lo que hubo en el mes *mostrado*, así
que algo que facturó el año pasado y este año no, no aparece.

> La comparación es siempre **mes completo contra mes completo**: no arrastra el filtro de
> día de la semana ni el de entidad. Comparar «enero contra enero, pero solo los martes»
> da una cifra fácil de leer mal.

> Si no hay otros meses cargados, la casilla no aparece: no hay contra qué comparar.

### Comparar el año completo

Con **Rango → Año** y **Comparar** activo, la ficha muestra lo facturado **en lo que va del
año** contra **el mismo tramo del año anterior**: si hoy es 5 de noviembre, *Ene–Nov 2026*
contra *Ene–Nov 2025* hasta ese mismo día. No se compara contra el año anterior completo,
porque diez meses contra doce darían un crecimiento negativo que no existe.

En este modo comparan las tarjetas, el bloque de totales, las tablas y *Facturado por día*.
El gráfico de **Cumplimiento mensual** no se compara todavía.

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
