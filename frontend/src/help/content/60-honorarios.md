---
id: honorarios
titulo: Honorarios
modulo: honorarios
orden: 60
claves: liquidacion, liquidaciones, aprobar, pagar, ajustes, nomina, comprobante, revertir, ondas de choque, margen
---

## Para qué sirve

Calcular, aprobar y registrar el pago de los honorarios de cada profesional.

## El flujo: Generar → Aprobar → Pagar

| Paso | Qué hace | Quién puede |
|---|---|---|
| **1. Generar** | Calcula los honorarios del período según las reglas | Todos los que entran a Honorarios |
| **2. Aprobar** | Revisa y da el visto bueno | Solo Gerencia y Dirección |
| **3. Pagar** | Registra el desembolso | Solo Gerencia y Dirección |

Si no tienes permiso para aprobar, el botón no aparece: en su lugar verás la etiqueta
**«Pendiente aprobación»**.

## Estados

| Estado | Significa |
|---|---|
| **Calculado** | Generado automáticamente. Sin revisar. |
| **Aprobado** | Revisado. Pendiente de pago. |
| **Pagado** | Pago registrado. Queda bloqueada. |

## Elegir el período

Por defecto se trabaja por mes completo, navegando con las flechas. No se puede ir a meses
futuros. El botón **Período parcial** permite fechas exactas, útil para liquidar una
fracción de mes.

## Recalcular es seguro

Al pulsar **Recalcular**, solo se actualizan las liquidaciones en estado *Calculado*. Las
**Aprobadas y Pagadas quedan protegidas** y no se tocan.

## Ver el desglose

La flecha al final de cada fila expande el detalle por categoría: consulta, EMG/VCN,
infiltración, ecografía, ondas de choque, junta, EEG, PSG/MSLT, telemetría y potenciales
evocados.

<details>
<summary>Ajustes manuales: bonos, descuentos y correcciones</summary>

Dentro del detalle de cada liquidación se pueden añadir ajustes.

| Campo | Obligatorio | Para qué |
|---|---|---|
| Categoría | Sí | A qué servicio se asocia |
| Descripción | Sí | El concepto |
| Cantidad | Sí | Puede ser negativa, para descuentos |
| Valor unitario | Sí | Precio en pesos |
| Justificación | Sí | Mínimo 10 caracteres |
| Referencia / N° acta | No | Referencia interna |

**Todo ajuste lo debe autorizar una persona distinta de quien lo creó**, con permiso de
aprobación. Mientras esté *Pendiente* **no suma al total** de la liquidación.

Estados: *Pendiente auth.* → *Autorizado* (suma) o *Rechazado* (no suma, muestra el
motivo).

Los ajustes de una liquidación **Pagada** no se pueden modificar.

</details>

<details>
<summary>Ajuste rápido de Ondas de Choque</summary>

Las sesiones de ondas de choque no siempre se pagan el mismo mes en que se hacen. Para
ajustar cuántas entran:

1. Expande la fila del profesional.
2. En la fila **Ondas de Choque**, pulsa el **lápiz**.
3. Indica cuántas sesiones se pagan este mes.

El sistema crea solo el ajuste negativo por las aplazadas, con su justificación. Queda
**Pendiente** y necesita autorización, igual que cualquier otro ajuste.

</details>

<details>
<summary>Revertir una liquidación aprobada por error</summary>

Pulsa **Revertir**, escribe la razón y confirma. Vuelve a *Calculado* y se puede
recalcular o corregir. Queda registrado en Auditoría, con quién lo hizo y por qué.

</details>

<details>
<summary>Profesionales de nómina: la liquidación es simulada</summary>

Los profesionales marcados como **Nómina** reciben un sueldo fijo, no honorarios por
procedimiento. Aun así el sistema les calcula una liquidación con las mismas reglas y la
marca como **simulada**, con una etiqueta morada.

Sirve para comparar lo que costaría esa actividad bajo el esquema de honorarios y evaluar
rentabilidad. **No se aprueba, no se paga y no entra en los totales.**

</details>

<details>
<summary>Facturación generada por médico</summary>

Al final de la página hay un panel colapsable que compara, por profesional, lo que facturó
frente a lo que se le paga:

| Columna | Qué muestra |
|---|---|
| Facturado EPS/ARL | Total a entidades |
| Facturado particular | Total a pacientes particulares |
| Total facturado | Lo que generó para la clínica |
| Honorarios a pagar | Su liquidación del período |
| Margen clínica | La diferencia, con porcentaje |

El margen sale en verde cuando es positivo y en rojo cuando no.

</details>
