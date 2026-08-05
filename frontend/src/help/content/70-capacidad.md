---
id: capacidad
titulo: Capacidad instalada
modulo: capacidad
orden: 70
claves: ocupacion, capacidad, cuello de botella, subutilizado, sesiones, disponible, visitas, estudios, base de conteo, demanda, no coinciden las cifras
---

## Para qué sirve

Comparar la demanda real con la capacidad instalada de cada servicio. Sirve para detectar
cuellos de botella y servicios que están dando menos de lo que podrían.

## Cómo leerla

Elige mes y año arriba. Cada tarjeta es un grupo de servicio, con su barra de ocupación y
un estado por color.

| Estado | Rango | Qué indica |
|---|---|---|
| Baja | menos del 30 % | Muy subutilizado: revisar demanda u oferta |
| Moderada | 30 – 59 % | Espacio de crecimiento importante |
| Óptima | 60 – 89 % | El rango ideal |
| Máxima | 90 % o más | Cerca del límite; riesgo de listas de espera |
| Sin datos | — | Falta configurar la capacidad de ese grupo |

## Visitas o estudios: la base de conteo

Un mismo mes admite **dos cifras de demanda**, y las dos son correctas:

- **Visitas** — paciente + fecha. Un paciente al que se le hacen EMG y VCN en la misma
  cita cuenta como **una**.
- **Estudios** — registros facturados. Ese mismo paciente cuenta como **dos**.

Cada grupo compara su capacidad contra una sola de las dos, según dónde esté su cuello de
botella. La tarjeta **rotula la que está usando** y muestra la otra debajo, en gris.

| Grupo | Base | Por qué |
|---|---|---|
| EMG / VCN | Visitas | El límite es el hueco de sala: «3 salas × 3 pacientes/hora». EMG + VCN en una cita ocupan un hueco, no dos |
| Potenciales Evocados | Estudios | Una visita cubre las modalidades visual, auditiva y somatosensorial, y cada una consume equipo y lectura por separado |
| Los demás | Visitas | Su capacidad está expresada en pacientes por hora de consultorio o de equipo |

La base se cambia por grupo en **Configuración → Cap. Instalada**, columna
«Se compara contra». No hace falta un despliegue.

<details>
<summary>«El área reporta 151 y la pantalla dice 56»</summary>

Es el caso que motivó esta separación, y ninguna de las dos cifras estaba mal.

En Potenciales Evocados, junio: **56 visitas** y **151 estudios** — unas 2,7 modalidades
por cita. Quien lee los estudios cuenta 151, porque son 151 lecturas; quien mira la agenda
cuenta 56, porque fueron 56 citas.

Antes la pantalla mostraba solo una de las dos, rotulada «sesiones», sin decir cuál era.
Ahora la tarjeta dice el sustantivo («151 estudios») y pone la otra debajo, así que la
cifra se puede conciliar con **Reportes → Mix por Servicio** sin salir de la pantalla.

**Ojo con la capacidad al cambiar la base.** Si un grupo pasa a medirse en estudios, el
número de capacidad tiene que estar expresado en estudios también. Potenciales Evocados
tenía 160 con la fórmula «1 equipo × 1 paciente/hora × 8h × 5d × 4 semanas», que son 160
*pacientes*: contra 151 estudios da 94 %, pero contra 160 estudios reales el equipo daría
para bastante más. Revisa la capacidad cuando cambies la base.

</details>

<details>
<summary>Registros sin identificación de paciente</summary>

Si una fuente llega sin nombre ni documento de paciente, esas atenciones **no se pueden
agrupar por visita**: cada una cuenta como una visita propia.

La tarjeta lo advierte con «N sin identificar» y el pie de la pantalla resume el total del
período. Es importante porque infla el conteo de visitas: si un grupo se mide en visitas y
tiene muchos registros sin identificar, su ocupación aparece más alta de lo real.

La cifra de **estudios** no se ve afectada.

</details>

<details>
<summary>El resumen de arriba</summary>

- **Demanda total** — suma de la cifra que gobierna cada grupo. Debajo, el desglose en
  visitas y estudios cuando no coinciden.
- **Capacidad total** — suma de la capacidad configurada.
- **Ocupación global** — demanda total contra capacidad total, solo de los grupos que
  tienen capacidad definida.

</details>

<details>
<summary>Ver y exportar varios meses</summary>

El botón **Rango de meses** añade dos selectores para el mes inicial. Aparece entonces la
tabla «Utilización mes a mes», con una fila por grupo y mes, y esa tabla se incluye en el
archivo exportado.

Solo salen los meses con actividad o con capacidad configurada; el rango admite hasta 36
meses. Las tarjetas de arriba siguen mostrando el mes final.

</details>

<details>
<summary>Un grupo aparece «Sin datos»</summary>

Significa que nadie ha configurado su capacidad mensual. Sin ese número no hay contra qué
comparar.

Se configura en **Configuración → Cap. Instalada**, y el cambio se refleja de inmediato en
esta pantalla.

</details>

<details>
<summary>Los doce grupos monitoreados</summary>

EMG / VCN · Electroencefalograma (EEG) · Videotelemetría (TLM) · Polisomnografía / LMS ·
Potenciales Evocados · Consulta Medicina Física · Consulta Neurología · Consulta Neurología
Pediátrica · Infiltración / Toxina Botulínica · Junta de Profesionales · Terapia Ondas de
Choque · Ecografía como Guía

Cada grupo agrupa varios procedimientos del catálogo por su nombre. Un procedimiento que no
encaje en ningún grupo no cuenta en esta pantalla, aunque sí aparezca en Reportes.

</details>
