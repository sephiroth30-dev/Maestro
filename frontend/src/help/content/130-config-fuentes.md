---
id: config-fuentes
titulo: Fuentes de datos
modulo: configuracion
orden: 130
claves: conector, sincronizar, sheet, google, importar, actualizar datos, no aparecen datos
---

## Para qué sirven

Los conectores son las conexiones a los archivos de origen de donde el sistema toma las
atenciones. **Configuración → Fuentes.**

> Esta sección está marcada en un color distinto por una razón: lo que se hace aquí cambia
> el origen de todos los datos del sistema.

## Cada tarjeta muestra

Nombre y tipo del conector, cuándo fue la última sincronización (hora de Colombia), si
está activo y cada cuánto sincroniza: 30 minutos, 1 hora, 4 horas, diaria o manual.

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
