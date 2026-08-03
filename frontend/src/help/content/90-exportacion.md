---
id: exportacion
titulo: Exportar reportes
orden: 90
claves: exportar, descargar, pdf, excel, csv, imprimir, presentacion, sin valores, vista medicos
---

## Dónde está

Botón **Exportar** en el encabezado de Dashboard, Reportes, Pacientes, Honorarios,
Capacidad y Auditoría. Genera **PDF**, **Excel** o **CSV**.

## Cómo funciona

Al pulsarlo se abre una ventana donde eliges el formato y marcas qué secciones y qué
columnas incluir. Por defecto viene todo marcado.

## Los presets

| Preset | Qué hace |
|---|---|
| **Todo** | El reporte completo |
| **Vista médicos (sin valores)** | Quita de un clic todas las columnas de dinero y deja solo cantidades |
| **Solo tablas** | Omite las gráficas |
| **Resumen ejecutivo** | Indicadores y gráficas, sin tablas de detalle |

**«Vista médicos» es el atajo más útil en el día a día**: sirve para entregarle a un
profesional el detalle de su actividad —cuántos procedimientos hizo y de qué tipo— sin
exponer tarifas ni honorarios.

## Qué esperar de cada formato

- **PDF** — Con logotipo, período, los filtros que estaban aplicados, las gráficas y
  numeración de páginas. Para imprimir o adjuntar a una presentación.
- **Excel** — Una hoja por sección más una portada. Encabezado fijo con filtros, y **los
  importes guardados como números de verdad**: se pueden sumar y usar en tablas dinámicas
  sin reescribir nada.
- **CSV** — Volcado plano, para archivos muy grandes o para cargar en otra herramienta.

<details>
<summary>El archivo respeta los filtros que tenías puestos</summary>

Si filtraste por una entidad y un día de la semana, el archivo sale con ese filtro
aplicado, y la portada del PDF los enumera para que quien lo reciba sepa exactamente qué
está mirando.

Es deliberado: un reporte sin constancia de sus filtros es la forma más fácil de que
alguien saque una conclusión equivocada.

</details>

<details>
<summary>Límites de tamaño</summary>

- **PDF**: hasta 2.000 filas por tabla. Por encima, el archivo avisa y sugiere Excel o CSV
  — un PDF de cientos de páginas no le sirve a nadie y congela el navegador al generarse.
- **Detalle de atenciones**: hasta 5.000 registros por descarga.
- **Auditoría**: hasta 2.000 eventos por descarga.

En todos los casos, si el período tiene más, el archivo lo indica y basta con acotar las
fechas y descargar por partes.

</details>

<details>
<summary>Por qué a veces no aparecen las columnas de dinero</summary>

Los usuarios con rol **Admisiones** reciben siempre la versión sin valores monetarios.

La restricción se aplica **al generar el archivo**, no solo en la pantalla, y también
sustituye las gráficas por su tabla equivalente. El motivo: una gráfica de facturación
lleva las cifras dibujadas dentro de la propia imagen, así que incrustarla habría filtrado
justo lo que se pretendía ocultar.

</details>
