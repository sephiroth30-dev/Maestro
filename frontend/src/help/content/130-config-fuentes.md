---
id: config-fuentes
titulo: Fuentes de datos
modulo: configuracion
orden: 130
claves: conector, sincronizar, sheet, google, importar, actualizar datos, no aparecen datos, api, medifolios, fuente activa, fuente del dashboard, cifras duplicadas
---

## Para qué sirven

Los conectores son las conexiones a los archivos de origen de donde el sistema toma las
atenciones. **Configuración → Fuentes.**

> Esta sección está marcada en un color distinto por una razón: lo que se hace aquí cambia
> el origen de todos los datos del sistema.

## Cada tarjeta muestra

Nombre y tipo del conector, cuándo fue la última sincronización (hora de Colombia), si
está activo y cada cuánto sincroniza: 30 minutos, 1 hora, 4 horas, diaria o manual.

## La fuente del dashboard

Puede haber varias fuentes cargadas a la vez, pero **el dashboard muestra una sola**. La
que esté marcada se ve distinta: borde azul, cabecera tintada y la etiqueta **Fuente del
dashboard**. Las demás quedan atenuadas y dicen *No alimenta el dashboard*.

Para cambiarla, el botón **Usar como fuente** de la tarjeta que corresponda. El cambio es
inmediato y para todos los usuarios: no es una preferencia personal.

> **Son dos cosas distintas, y conviene no confundirlas.**
>
> - **Activo / Inactivo** — si esa fuente **se sincroniza**.
> - **Fuente del dashboard** — si sus cifras **se muestran**.
>
> Una fuente puede estar sincronizando perfectamente y no alimentar el dashboard. Es justo
> lo que hace falta al estrenar un origen nuevo: se carga, se compara con el anterior en
> **Diagnóstico**, y solo cuando cuadra se marca como fuente.

### Si aparece un aviso naranja

Dice que hay varias fuentes y **ninguna marcada**. Mientras eso pase, los reportes **suman
todas**, de modo que cualquier mes que exista en dos fuentes muestra la facturación
duplicada. Se arregla marcando una con **Usar como fuente**.

## Sincronizar

- **Automática** — el sistema lo hace solo, en el intervalo configurado.
- **Manual** — el botón **Sincronizar** la lanza en el momento. Corre en segundo plano:
  el estado pasa a *En proceso* y luego a *Completada* o *Fallida*.

> **El botón ↺ de Reportes NO sincroniza.** Solo recalcula los indicadores con los datos
> que ya están guardados. Para traer datos nuevos del origen hay que sincronizar aquí.
> Es la confusión más habitual cuando alguien dice «actualicé y no aparece».

## Historial y diagnóstico

El icono de historial muestra las últimas sincronizaciones con hora de inicio y fin, filas
leídas, filas nuevas y errores.

**Diagnóstico de columnas** muestra qué columnas del archivo reconoció el sistema. Es la
primera pantalla que hay que mirar cuando faltan datos.

<details>
<summary>Cada sincronización reemplaza los datos de ese conector</summary>

No añade: **borra todo lo de ese conector y lo vuelve a insertar** desde el origen. Por eso
corregir un dato en el archivo y sincronizar funciona, y por eso también cualquier cambio
hecho directamente en la base de datos se perdería.

Las correcciones se hacen en los **catálogos** (alias de entidad, palabras clave de
servicio) o en el archivo de origen, nunca sobre las atenciones.

</details>

<details>
<summary>Conectar una API (por ejemplo Medifolios)</summary>

Además de hojas de cálculo, una fuente puede ser una **API**. El formulario pide entonces:

- **URL base** y **ruta del endpoint** — el servidor y lo que se le cuelga.
- **Autenticación** — si la API entrega el token tras un **login** con usuario y
  contraseña, hay que elegir esa opción e indicar la ruta del login y dónde viene el token
  en su respuesta. El sistema renueva el token solo cuando caduca.
- **Dónde va el token** — en una cabecera o **como parámetro de la URL**. Es el detalle que
  más veces deja una configuración correcta devolviendo *token inválido*.
- **Paginación** — si la API entrega los registros por páginas, los nombres de esos
  parámetros. Sin esto solo entraría la primera página.
- **Sincronización incremental** — en vez de bajar todo el histórico cada vez (con varios
  años cargados, unos 25 minutos), pide solo los últimos meses y reemplaza solo esas fechas.
  *Meses a refrescar* = 2 es el mes actual y el anterior. Cada noche, a las 3 a. m., se hace
  además una sincronización **completa** que corrige lo que haya cambiado fuera de esa
  ventana. En la tarjeta aparece entonces un botón **Completa** para lanzarla a mano.
- **Correspondencia de campos** — cómo se llama cada dato en la respuesta. Admite **rutas
  con punto** (`eps.nomEps`) para cuando el dato viene dentro de otro objeto.

El botón **Probar conexión** verifica credenciales y ruta antes de guardar.

> Las credenciales se guardan en el sistema y **no vuelven a mostrarse**: al editar
> aparecen como `[REDACTED]`. Editar el nombre de la fuente no borra su contraseña.

</details>

<details>
<summary>Solo se leen las columnas A a Z</summary>

El sistema lee las columnas **A hasta Z** de la hoja, y de ellas reconoce ocho campos por
el texto de la cabecera: fecha, descripción, autorización, entidad, profesional, valor,
paciente y documento.

Dos consecuencias prácticas:

- Una columna más allá de la Z **es invisible** para el sistema.
- Si una cabecera está escrita de forma que el sistema no reconoce, esa columna se
  descarta en silencio. Es la causa habitual de que la cobertura de paciente salga baja en
  la sección Pacientes.

**Diagnóstico de columnas** dice exactamente qué reconoció de cada archivo.

</details>
