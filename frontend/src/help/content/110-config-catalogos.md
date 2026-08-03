---
id: config-catalogos
titulo: Catálogos y calidad de datos
modulo: configuracion
orden: 110
claves: entidades, servicios, profesionales, sin entidad, sin clasificar, alias, reclasificar, presupuesto
---

## Para qué sirven

Los datos llegan del archivo de origen como texto libre: «NUEVA EPS», «Nueva Eps S.A.»,
«NUEVAEPS» pueden ser la misma entidad escrita de tres formas. Los catálogos enseñan al
sistema a reconocerlas como una sola.

## Entidades

**Configuración → Entidades.** Cada entidad tiene un nombre oficial, un tipo (EPS, ARL,
convenio, particular…) y una lista de **nombres tal como aparecen en el origen**.

Cuando aparece una variante nueva, se añade a esa lista y el sistema la reconoce a partir
de ahí.

## Profesionales

**Configuración → Profesionales.** Mismo principio: nombre oficial, alias del origen,
especialidad y si es de **nómina** (sueldo fijo, liquidación simulada).

## Servicios

**Configuración → Servicios.** Además de nombre y alias, cada servicio tiene:

- **Nombre en reportes** — cómo quieres que se llame en pantalla, sin tocar el matching.
- **Modo de conteo** — *unidad* (cada registro cuenta) o *sesión* (varias atenciones del
  mismo paciente el mismo día cuentan como una).
- **Palabras clave** — con qué texto del origen se reconoce.

## Cuando algo no se reconoce

Dos pestañas señalan lo que quedó sin clasificar:

- **Sin entidad** — registros cuyo pagador no se reconoció. Desde ahí se puede crear la
  entidad y reasignar sus atenciones de una vez.
- **Sin clasificar** (dentro de Servicios) — descripciones del origen que no encajaron con
  ningún servicio.

> Vale la pena revisarlas: cada registro sin clasificar es facturación que no aparece bien
> repartida en los reportes.

<details>
<summary>Reclasificar el histórico</summary>

Al añadir un alias o una palabra clave, el cambio afecta a lo que entre desde ese momento.
Para aplicarlo también a lo ya cargado está el botón **Reclasificar**, en Servicios,
Profesionales y Entidades.

Recorre el histórico y reasigna lo que ahora sí encaja. Puede tardar unos segundos y al
terminar informa cuántos registros actualizó.

</details>

<details>
<summary>Presupuestos mensuales</summary>

**Configuración → Presupuestos.** Define la meta de facturación de cada mes: es el
denominador de todos los porcentajes de cumplimiento del Dashboard y de Reportes.

Se escribe el valor y se guarda solo al salir del campo. Un icono verde lo confirma, y
abajo se ve el total anual.

Sin presupuesto cargado, el cumplimiento sale en cero — no porque no se facture, sino
porque no hay contra qué comparar.

</details>
