---
id: pacientes
titulo: Pacientes
modulo: pacientes
orden: 50
claves: pacientes unicos, nuevos, recurrentes, retencion, frecuencia, cobertura, demografia, edad, sexo
---

## Para qué sirve

Responde **a cuántas personas distintas** atendemos, cuántas son nuevas y con qué
frecuencia vuelven. El resto del sistema cuenta atenciones y dinero; esta pantalla cuenta
personas.

## Lo primero: la barra de cobertura

Arriba aparece siempre qué porcentaje de los registros del período trae identificación del
paciente. **Todas las cifras de la pantalla se calculan solo sobre esos registros.**

Si dice 62 %, lo que ves describe el 62 % de la operación, no el total. El enlace **Ver
por fuente** muestra de dónde viene el faltante.

> Una fuente al 0 % es un archivo de origen sin columna de paciente. Eso se corrige en el
> archivo, no en el sistema.

## Los indicadores

| Indicador | Qué significa |
|---|---|
| Pacientes únicos | Personas distintas atendidas en el período |
| Nuevos | Sin ningún registro anterior en los datos disponibles |
| Recurrentes | Ya tenían registros previos |
| Visitas por paciente | Cuántas veces vino cada uno en promedio |

## Dos cosas que se malinterpretan fácil

**«Nuevo» no significa que nunca haya venido.** Significa que no hay registros anteriores
*en los datos cargados*. Alguien atendido hace años, si ese período no está en el sistema,
cuenta como nuevo. Bajo los indicadores se muestra desde qué fecha hay historia.

**Atención y visita no son lo mismo.** Un EMG y un VCN el mismo día son dos atenciones
pero una sola visita. Por eso se muestran los dos promedios.

## Por pagador y por servicio

> **Estas cifras no suman el total de pacientes únicos.** Un paciente atendido una vez por
> EPS y otra como particular aparece en ambas filas. Es correcto —lo atendimos por los dos
> canales— pero sumar la columna no da el total.

Por eso se presentan como tabla y nunca como gráfico de torta.

## Qué no puede responder

El sistema **no guarda edad, sexo, ciudad ni régimen**. La fuente solo aporta nombre y
documento. Para segmentar por esos criterios habría que añadir primero esas columnas al
archivo de origen.

<details>
<summary>Cómo leer la gráfica de retención</summary>

Muestra qué porcentaje de los pacientes de cada mes vuelve al mes siguiente.

Los dos últimos meses aparecen **vacíos a propósito**. Un mes solo se puede puntuar cuando
el siguiente ha terminado: medir octubre contra los tres días que lleva noviembre daría un
3 % que parecería un desplome y sería solo un artefacto del cálculo. Preferimos el hueco
antes que un dato engañoso.

</details>

<details>
<summary>Cómo se identifica a un paciente</summary>

Se usa el documento cuando está, y el nombre cuando no. Antes de comparar se normaliza:
se ignoran puntos y guiones del documento, y mayúsculas y espacios de más en el nombre.
Así «1.234.567» y «1234567» son la misma persona, igual que «  MARIA  PEREZ » y
«Maria Perez».

Los registros sin ninguno de los dos datos **quedan fuera del conteo**, no se cuentan como
un paciente anónimo. Contarlos inflaría la cifra de pacientes únicos con una persona
distinta por cada registro sin identificar.

</details>
