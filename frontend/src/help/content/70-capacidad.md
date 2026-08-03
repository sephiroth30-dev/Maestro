---
id: capacidad
titulo: Capacidad instalada
modulo: capacidad
orden: 70
claves: ocupacion, capacidad, cuello de botella, subutilizado, sesiones, disponible
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

## El resumen de arriba

- **Total sesiones** — sesiones únicas del período.
- **Capacidad total** — suma de la capacidad configurada.
- **Ocupación global** — promedio de los grupos que sí tienen capacidad definida.

<details>
<summary>Cuenta sesiones, no atenciones — y eso importa</summary>

La ocupación se calcula sobre **sesiones únicas**, no sobre registros. En los servicios
configurados en modo «sesión», varias atenciones del mismo paciente en la misma fecha
cuentan como una sola.

Tiene sentido: un paciente al que se le hacen EMG y VCN en la misma cita ocupa **un** hueco
de agenda, no dos. Contar registros inflaría la ocupación y haría parecer saturado un
servicio que no lo está.

</details>

<details>
<summary>Un grupo aparece «Sin datos»</summary>

Significa que nadie ha configurado su capacidad mensual. Sin ese número no hay contra qué
comparar.

Se configura en **Configuración → Capacidad instalada**, y el cambio se refleja de
inmediato en esta pantalla.

</details>

<details>
<summary>Los doce grupos monitoreados</summary>

EMG / VCN · Electroencefalograma (EEG) · Videotelemetría (TLM) · Polisomnografía / LMS ·
Potenciales Evocados · Consulta Medicina Física · Consulta Neurología · Consulta Neurología
Pediátrica · Infiltración / Toxina Botulínica · Junta de Profesionales · Terapia Ondas de
Choque · Ecografía como Guía

</details>
