# Borrador de correo — Exportación de reportes y Analítica de Pacientes

> **Para copiar y pegar.** Antes de enviar, revisar los dos puntos marcados con
> `[[ ]]`, que requieren un dato que el sistema no tiene.

---

**Para:**
direccion.administrativa@neurofic.com; agerencia.neurofic@gmail.com; jefeasistencia.neurofic@gmail.com; convenios.neurofic@gmail.com; coordinadormedico.neurofic@gmail.com; jorgetamao262@gmail.com

**CC:** resultados@neurofic.com

**Asunto:** Nuevo en el dashboard: descarga de reportes en PDF y Excel, y analítica de pacientes

---

Buen día a todos:

Les escribo para contarles dos funcionalidades nuevas que ya están disponibles en el
dashboard, en **https://dashboard.neurofic.com**.

## 1. Descargar cualquier reporte en PDF, Excel o CSV

La solicitud vino de la **Dra. [[APELLIDO]]**, que necesitaba poder llevarse la
información del sistema para analizarla por fuera y usarla en presentaciones. Quedó
resuelto de forma general, no solo para un reporte puntual.

**Cómo se usa:** en Dashboard, Reportes, Pacientes, Honorarios, Capacidad y Auditoría
hay ahora un botón **Exportar** en la parte superior. Al pulsarlo se abre una ventana
donde se elige el formato y se marca qué secciones y columnas incluir. Por defecto viene
todo marcado.

**Qué entrega cada formato:**

- **PDF** — Con el logotipo, el período consultado, los filtros que estaban aplicados,
  las gráficas y numeración de páginas. Listo para imprimir o adjuntar a una
  presentación.
- **Excel** — Una hoja por sección, con encabezado fijo y filtros. Los valores quedan
  guardados como números de verdad, así que se pueden sumar y armar tablas dinámicas
  sin tener que reescribir nada.
- **CSV** — Para archivos muy grandes o para cargar los datos en otra herramienta.

**Un atajo que puede resultarles útil:** dentro de la ventana hay un botón
**«Vista médicos (sin valores)»**. Con un clic quita todas las columnas de dinero y deja
únicamente las cantidades. Sirve para entregarle a un profesional el detalle de su
actividad —cuántos procedimientos hizo, de qué tipo— sin exponer tarifas ni honorarios.

En **Reportes** hay además un botón **Detalle**, que descarga una fila por cada atención
del período: fecha, paciente, entidad, profesional, servicio y valor. Es la base para
quien quiera construir sus propios análisis.

## 2. Analítica de Pacientes (sección nueva)

Al trabajar en lo anterior surgió una pregunta natural: si el sistema ya sabe qué se
factura y quién lo hace, ¿puede decirnos también **a cuántas personas distintas estamos
atendiendo**? Hasta ahora todos los reportes contaban atenciones y dinero, nunca
pacientes.

La nueva sección **Pacientes** responde eso:

- **Pacientes únicos** del período — personas distintas, no número de atenciones.
- **Nuevos frente a recurrentes** — cuántos vienen por primera vez y cuántos ya nos
  conocían.
- **Frecuencia de visitas** — cuántos vinieron una sola vez, cuántos entre 2 y 3 veces,
  y así.
- **Retención mes a mes** — qué porcentaje de los pacientes de cada mes regresa al
  siguiente.
- **Distribución por pagador y por servicio** — cuántas personas distintas atiende cada
  EPS y cada procedimiento.

### Dos advertencias importantes para leer bien estas cifras

**Primera: dependen de que el registro traiga identificado al paciente.** La sección
encabeza siempre con una barra que indica qué porcentaje de los registros del período
tiene nombre o documento, y **todas las cifras se calculan solo sobre ese subconjunto**.
Si la barra dice 65 %, la pantalla describe el 65 % de la operación. Hay un enlace
«Ver por fuente» que muestra de dónde viene el faltante: normalmente es una hoja de
cálculo cuya cabecera no incluye la columna de paciente, y se corrige en el archivo de
origen. Cuanto mejor sea ese registro, más confiables serán estas cifras.

**Segunda: los cuadros por pagador y por servicio no suman el total.** Un paciente
atendido una vez por EPS y otra como particular aparece en las dos filas. Es correcto que
sea así —efectivamente lo atendimos por ambos canales— pero significa que sumar esa
columna no da el total de pacientes únicos. La pantalla lo advierte y por eso esa
información se presenta como tabla y no como gráfico de torta.

### Qué no puede responder todavía

El sistema **no guarda edad, sexo, ciudad ni régimen** del paciente: la fuente de datos
solo aporta nombre y documento. Si en algún momento se quiere segmentar por esos
criterios —por ejemplo, distribución etaria por servicio— el primer paso sería agregar
esas columnas al archivo de origen; el sistema puede tomarlas desde ahí.

## Documentación

El manual de usuario ya está actualizado con ambas secciones, incluyendo el detalle de
los formatos de exportación y cómo interpretar cada indicador de pacientes.

Quedo atento a cualquier duda, y sobre todo a que la usen y me digan qué falta.

Un saludo,

[[TU NOMBRE]]
resultados@neurofic.com

---

## Notas para quien envía (no forman parte del correo)

### 1. Falta el apellido de la Dra. Sandra

Busqué «Sandra» en todo el repositorio —código, documentación, semillas de base de datos
y catálogo de profesionales— y **no aparece**. Los profesionales registrados en el
sistema son:

Perlaza · Laverde · Escobar · Therán Rosero · Montaño · Parada Palacios · Álvarez ·
Cruz · Concha

Ninguna se llama Sandra, así que puede tratarse de alguien del área administrativa y no
del catálogo clínico. **No inventé un apellido**: reemplazar `[[APELLIDO]]` antes de
enviar.

### 2. Revisión de las direcciones

Las seis están bien formadas y no hay duplicados. Dos observaciones:

| Dirección | Observación |
|---|---|
| `direccion.administrativa@neurofic.com` | Única del dominio corporativo. |
| `agerencia.neurofic@gmail.com` | **Verificar.** Empieza por «agerencia»; podría ser una errata de «gerencia». Si lo es, un envío a la dirección equivocada podría llegarle a un tercero. |
| `jefeasistencia.neurofic@gmail.com` | Correcta. |
| `convenios.neurofic@gmail.com` | Correcta. |
| `coordinadormedico.neurofic@gmail.com` | Correcta. |
| `jorgetamao262@gmail.com` | Dirección personal, sin patrón institucional. Confirmar que corresponde a quien se cree. |

No pude comprobarlas contra la libreta de contactos del correo: no tengo acceso a la
cuenta. La validación es únicamente de formato y coherencia.

### 3. Estas direcciones no son los usuarios del sistema

Las cuentas de acceso al dashboard son distintas (`gerencia@neurofic.com`,
`coordinadora@neurofic.com`, etc.). Si alguno de los destinatarios no sabe con qué
usuario entra, conviene aclarárselo en el mismo correo.

### 4. Verificar antes de anunciar

La sección Pacientes se probó con datos simulados, no contra la base real. Antes de
enviar, conviene entrar a **Pacientes** y comprobar que carga y que la barra de cobertura
muestra un porcentaje coherente — y de paso saber qué número van a ver los destinatarios
cuando entren.
