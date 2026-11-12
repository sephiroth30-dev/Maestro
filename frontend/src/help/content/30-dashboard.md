---
id: dashboard
titulo: Dashboard
modulo: dashboard
orden: 30
claves: inicio, kpi, meta, cumplimiento, proyeccion, ticket promedio, tendencia, modo tv, pantalla, televisor, monitor
---

## Para qué sirve

Es la primera pantalla al entrar. Responde una sola pregunta: **cómo va el mes**.

## Los indicadores

| Indicador | Qué significa |
|---|---|
| Facturación del mes | Total facturado en el período |
| Meta / Faltante | Si se cumplió, sale en verde; si no, cuánto dinero faltó |
| Proyección de cierre | A qué total se llegaría manteniendo el ritmo actual |
| Atenciones | Sesiones registradas |
| Ticket promedio | Facturación dividida entre el número de sesiones |
| Promedio diario | Cuánto se factura por día en promedio |
| Días hábiles restantes | Lo que queda para cerrar el mes |

El color del indicador principal cambia solo: **verde** al 100 % o más, **ámbar** entre
80 y 99 %, **rojo** por debajo del 80 %.

## Modo TV

El botón **Modo TV** (arriba a la derecha) abre una pantalla completa para dejar en el televisor o monitor de la oficina, con aspecto
de pantalla de bolsa: índices arriba (facturado hoy, citas atendidas, meta, proyectado, agenda), una **línea del día** que se dibuja con
cada sincronización y se compara con el día anterior, un **mapa de calor de EPS** (verde o rojo según vayan contra su promedio de 3
meses), **velas diarias** del mes contra la meta diaria, las citas de hoy y una **cinta de EPS** que no se detiene. Se actualiza sola y no
hay que tocarla.

- **No es tiempo real.** Los datos cambian cada 15–30 minutos. Entre una lectura y otra, los contadores avanzan al ritmo de hoy y
  van marcados con **≈**; el dato real y su hora se ven debajo, y se corrige cuando llega el dato nuevo. El botón **≈** apaga ese avance.
- **Las celdas parpadean en verde o rojo solo cuando entra un dato real**; la estimación «≈» nunca parpadea.
- **La línea del día empieza vacía** el día que se activa y se llena con cada sincronización; la comparación con el día anterior aparece desde la segunda jornada.
- Arriba siempre dice si los datos están **en vivo**, si **Medifolios lleva rato sin sincronizar** o si **no hay conexión**.
- De noche y los domingos pasa a un modo tranquilo con el resumen del día.
- Para dejarla fija en un equipo, inicia sesión marcando **«Mantener sesión en este equipo»**.

Para salir, mueve el ratón y pulsa la **✕**.

## Las gráficas

- **Tendencia de facturación** — los últimos meses, para ver si se sube o se baja.
- **Mix de pagadores** — cuánto aporta cada tipo de pagador.
- **Cumplimiento mensual** — avance frente al presupuesto.
- **Top entidades** — las que más facturan en el período.

<details>
<summary>Cómo leer la proyección sin engañarse</summary>

La proyección es una regla de tres sobre el ritmo actual: toma lo facturado hasta hoy y lo
extrapola a los días hábiles que quedan. Es útil a mitad de mes y poco fiable en los
primeros días, cuando dos o tres jornadas atípicas distorsionan el promedio.

Tampoco sabe de estacionalidad: no descuenta una semana de festivos ni un puente. Úsala
como señal de alerta temprana, no como cifra de cierre.

</details>

<details>
<summary>Cambiar el período</summary>

El Dashboard trabaja sobre el año en curso, de enero al mes actual. Para analizar
cualquier otro período, con filtros por entidad, día o servicio, la herramienta es
**Reportes**.

</details>
