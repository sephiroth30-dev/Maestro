---
id: config-reglas
titulo: Reglas de honorarios
modulo: configuracion
orden: 120
claves: tarifas, reglas, matriz, honorarios, duplicar, regla especial, porcentaje
---

## Para qué sirven

Son la tabla de tarifas con la que el sistema calcula las liquidaciones. Sin reglas, un
profesional liquida en cero.

**Configuración → Reglas de honorarios.**

## La matriz de tarifas

Una fila por profesional y una columna por categoría: consulta, EMG/VCN, infiltración,
ecografía, ondas de choque, junta, EEG, PSG/MSLT, telemetría y potenciales evocados.

Cada celda se edita en el sitio. Puede ser un **valor fijo** por procedimiento o un
**porcentaje** de lo facturado.

## Copiar de otro profesional

El botón de **duplicar** copia todas las reglas de un profesional a otro. Es lo práctico
al dar de alta a alguien que cobra igual que un colega: se copia y se ajusta lo que
cambie.

## Reglas especiales

Excepciones que no caben en la matriz: una tarifa distinta para una entidad concreta, un
mínimo garantizado, un tratamiento particular de cierto procedimiento. Se listan aparte,
con su condición y su valor.

<details>
<summary>Los cambios no reescriben lo ya aprobado</summary>

Al cambiar una tarifa, las liquidaciones **Aprobadas y Pagadas no se tocan**: quedaron
congeladas con las reglas vigentes cuando se generaron.

Para aplicar la tarifa nueva a un período todavía abierto, hay que ir a Honorarios y
pulsar **Recalcular**. Solo se actualizarán las que estén en estado *Calculado*.

Es deliberado: un pago ya aprobado no debe cambiar de importe porque alguien editó una
tabla después.

</details>

<details>
<summary>«Sin regla (facturado)» en el detalle</summary>

Cuando en el desglose de una liquidación aparece la fila **Sin regla (facturado)**,
significa que ese profesional tuvo atenciones en una categoría para la que **no hay tarifa
definida**.

El sistema no inventa un valor: lo muestra aparte para que se vea. Si debía cobrar por
eso, falta cargar la regla y recalcular.

</details>
