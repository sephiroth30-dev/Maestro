---
id: config-catalogos
titulo: Catálogos y calidad de datos
modulo: configuracion
orden: 110
claves: entidades, servicios, profesionales, sin entidad, sin clasificar, alias, reclasificar, presupuesto, especialidad, pediatria, neurologia pediatrica
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

<details>
<summary>Para qué sirve la especialidad</summary>

Muchas facturas dicen solo «CONSULTA PRIMERA VEZ» o «CONSULTA DE CONTROL», sin nombrar la
especialidad. La especialidad del profesional resuelve esa ambigüedad: si a quien la hizo se
le asignó **Neurología**, **Fisiatría** o **Neurología Pediátrica**, esa consulta genérica se
sube sola al servicio específico — sin la especialidad, se queda en el genérico y no aparece
en ningún reporte que desglose por tipo de consulta.

Por eso a un neurólogo pediatra hay que marcarlo **Neurología Pediátrica** y no solo
**Neurología**: sus consultas de control y primera vez, si no dicen «pediátrica» en el texto,
solo se reclasifican correctamente con esa especialidad puesta. Después de asignarla, pulsa
**Reclasificar** para que el histórico ya cargado se actualice de inmediato — si no, el cambio
solo se ve en atenciones nuevas.

</details>

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
