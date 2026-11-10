# Proyección por agenda: lo atendido + lo agendado

> **Estado: la parte visual está hecha y desplegada APAGADA. El backend no existe todavía.**
> Se enciende con `VITE_PROYECCION_AGENDA=true` (ver `docs/ENV.md`) cuando existan
> `GET /api/reportes/agenda` y la sincronización de citas.

## Para qué sirve

Hasta ahora el dashboard decía cuánto **se ha facturado**. Esto añade cuánto **se va a facturar** si se
atienden las citas que ya están asignadas, por EPS y en total, para que el personal administrativo
decida con tiempo a quién dar más o menos citas.

Contexto de negocio, tal como lo dio el usuario:

- **No hay topes formales por EPS.** El personal observa el comportamiento y decide. Por eso **no se
  carga ningún tope**: el dashboard da la información y la decisión es humana.
- **«Mejor pagadora» no tiene parámetros fijos** y cambia de un mes a otro. Por eso **no se guarda ninguna
  calificación**. La API de Medifolios tampoco trae pagos ni cartera.
- El resultado esperado: **la proyección de lo que se va a facturar con lo atendido + lo asignado, por mes,
  semana o día, según el filtro aplicado.**

## Fórmula

`proyectado (periodo) = atendido (facturado, hasta hoy) + agendado (citas pendientes, desde hoy)`,
ambos recortados al periodo del filtro.

| Filtro | Atendido | Agendado |
|---|---|---|
| Mes en curso | del 1 a hoy | de hoy a fin de mes |
| Esta semana / Hoy / rango | lo facturado dentro del rango | las citas pendientes dentro del rango |
| Semana o mes **pasados** | todo | **0** (ya no queda agenda pendiente; ni siquiera se pide) |
| Año | lo que va del año | **no aplica**: la agenda solo llega unas semanas adelante y una proyección anual calculada con ella no sería honesta (ni se pide) |
| Día de la semana / entidad | el filtro se aplica a ambas partes | igual |

Una cita cumplida **no** se cuenta como agendada: ya está facturada (o a punto de estarlo) y contarla
duplicaría. Las citas del día de hoy ya atendidas pasan a «cumplida» y dejan de contar; las pendientes de
horas ya pasadas cuentan hasta que se marquen.

## Lo que se ve (parte hecha)

- **Ficha *Facturación Bruta*:** atendido, `+ Agendado` con su número de citas, **Proyectado**, y el
  crecimiento frente al mes anterior (solo al mirar un mes). Avisa si hay **citas sin precio de referencia**
  (no se cuentan como cero en silencio) y si la **agenda no cubre todo el periodo** (en un día no sale).
- **Ficha *Cumplimiento*:** «Con lo agendado», el cumplimiento de la meta si se atiende todo lo agendado.
- **Tabla *Facturación por Entidad*:** columnas **Agendado** (valor y citas), **Proyectado** y **vs prom. 3
  meses**. Aparecen también las EPS que solo tienen agenda y nada facturado todavía.
- **Gráficos** *Cumplimiento semanal*, *Cumplimiento diario* y *Facturado por día*: lo agendado va apilado
  sobre lo atendido **en trama**, para que no se confunda con lo ya facturado.
- **Inicio:** «Atendido + agendado» junto a «Por ritmo». La proyección por ritmo (`facturado + promedio diario ×
  días restantes`) no sabe nada de la agenda; si las dos difieren mucho, esa diferencia ya es información.
  **«Atendido + agendado» es un PISO, no una proyección completa:** solo cuenta lo que ya está en la agenda. Si la
  agenda no llega a fin de mes, o hay citas sin precio de referencia, queda por debajo de lo que de verdad se
  facturará. Por eso en esos casos **se avisa** («⚠ agenda cargada solo hasta el 12/11») y **no manda sobre la
  barra de progreso**, que sigue usando la proyección por ritmo. Sin ese cuidado, un administrativo que lee
  «vamos a 46 %» el día 5 solo porque la agenda llega hasta el 12 tomaría una decisión equivocada.

### «vs prom. 3 meses» no es un tope

Compara lo proyectado de cada EPS con su facturación mensual **media de los últimos 3 meses cerrados**. Dice
«esta EPS va un 26 % por encima de lo habitual» **sin que nadie tenga que definir qué es pasarse**. Los
colores son neutros a propósito: estar por encima no es «malo».

**Solo se muestra al mirar un MES completo y sin filtro de día de la semana.** El promedio es mensual: contra
una semana, un día, o solo «los martes» de un mes, daría −75 % en todas las EPS. Esto falló dos veces
durante la revisión: primero con rangos (semana, hoy), y después —lo encontró la revisión independiente— con
el filtro de día, donde el modo sigue siendo «mes» pero los datos son solo esos días.

## Cómo se valora una cita

La cita **no trae precio**. Se estima **al sincronizar** (cada cita recibe su valor y se guarda, de modo que
las pantallas solo suman filas):

**valor = mediana de lo facturado por *visita* de ese grupo de servicio a esa EPS en los últimos 90 días**
(de la fuente activa). Se usa el **grupo de capacidad** (`backend/src/config/capacidad-grupos.ts`) y las
visitas (`backend/src/repositories/paciente-key.ts`, `sqlLlaveVisita`) porque una cita no es una línea de
factura: una visita de Potenciales Evocados genera ~2,7 estudios, y estimar «por línea» la subestimaría a casi
la tercera parte.

Respaldo, en orden: EPS × grupo (≥3 casos) → grupo en todas las EPS → **«sin valor de referencia»**.

**Por qué no se usa la tarifa del convenio** (`GET /catalogos/convenios/{id}/tarifa`): es una consulta por cada
convenio × procedimiento, y la propia especificación advierte que **«NO es el valor facturado»**: en agosto
solo el 41 % de las líneas se facturó a la tarifa del convenio.

## Qué dice la API de Medifolios

| Necesidad | Hallazgo |
|---|---|
| Citas | `GET /citas/listar`, solo lectura, permiso **01010202**. Filtra por rango y `estadoCita`. Trae convenio, procedimiento (+CUPS), profesional, estado, `fechaInicioCita`, `origenCita`. Máx. 200 por página. |
| Estados | **P** pendiente · **C** cumplida · **I** incumplida · **L** libre. Se cuentan solo **P**. |
| Convenio → EPS | `GET /catalogos/convenios` trae un objeto `eps{}` con el nombre: el vínculo sale del catálogo. |
| Pagos / cartera | **No hay.** |

## Avisos: «sin agenda» no puede verse como «no hay citas»

Si la agenda no está disponible, el proyectado saldría **bajo sin que nadie lo notara**. Por eso la ficha avisa
cuando: la consulta **falla**; la agenda **nunca se ha sincronizado** (`actualizado_en` nulo); **no hay citas
cargadas** (`horizonte` nulo); se sincronizó **hace más de 6 h**; o **no cubre todo el periodo**. Y avisa de las
**citas sin precio de referencia**: no se cuentan como cero en silencio.

## Contrato del endpoint (a construir)

`GET /api/reportes/agenda`, con **los mismos parámetros que `/api/reportes/kpis`** (`mes_idx`+`anio` o
`start_date`+`end_date`, `entidad_id`, `dia_semana`). Devuelve **solo la parte agendada**: lo atendido ya lo
tiene la pantalla.

```ts
interface AgendaResult {
  actualizado_en: string | null;   // última sincronización de citas
  horizonte: string | null;        // fecha de la última cita cargada (YYYY-MM-DD)
  total: { citas: number; valor: number; citas_sin_valor: number };
  por_entidad: Array<{
    entidad_id: string | null; entidad: string; tipo: string;
    citas: number; valor: number; citas_sin_valor: number;
    promedio_3m: number | null;   // facturación mensual media de los últimos 3 meses cerrados
  }>;
  por_dia: Array<{ fecha: string; citas: number; valor: number }>;   // YYYY-MM-DD
}
```

Tipos en `frontend/src/api/reportes.ts` (`AgendaResult`, `useAgenda`).

**Reglas que el backend DEBE cumplir** (el cliente se defiende de algunas, pero no debe tener que hacerlo):

1. **Solo citas pendientes con fecha ≥ hoy** (hora de Colombia). Una no asistida que sigue «pendiente» con fecha
   pasada **no** es agenda. El cliente descarta `por_dia` anterior a hoy como defensa, pero no recorta `total`.
2. **Excluir las citas de hoy ya atendidas.** Si el backend las deja «pendientes» mientras su consumo ya está
   facturado, se contarían **dos veces** (en lo atendido y en lo agendado).
3. **Una fila por EPS** en `por_entidad`. Si llegaran varias de la misma EPS, el cliente las **suma**.
4. `horizonte` es **global** (la última cita cargada), no por filtro; si dependiera del filtro, el aviso «solo
   cargada hasta…» saldría en casi todas las vistas filtradas.
5. `actualizado_en` debe ser la hora de la **última sincronización correcta** de citas: con ella se avisa si está
   vieja.
6. **Aplicar `enforceAdmisionesPeriod`** como los demás endpoints de reportes: ADMISIONES solo ve el mes en curso.

### Limitaciones conocidas

- Los gráficos por **día de la semana** muestran solo lunes a viernes; una cita en sábado cuenta en el total de
  la ficha pero no tiene barra. El gráfico semanal (por fechas) sí la incluye.
- Las **imágenes de los gráficos en PDF/Excel** se capturan del DOM: llevarán las barras rayadas de «Agendado»
  sin leyenda propia ni tabla de respaldo. Las **filas de la tabla** sí se exportan sin agenda (una EPS que solo
  existe por la agenda no se exporta como si tuviera $0 facturados).

## Cómo se evita recargar Medifolios y el dashboard

- **El dashboard nunca llama a Medifolios al abrirse.** Una tarea copia las citas pendientes a una tabla local
  (`citas_agendadas`); las pantallas leen de ahí con la caché de 60 s de los reportes.
- Solo se piden las citas **P de agenda**, de hoy a fin del mes siguiente (sin históricas, canceladas ni
  imagenología): cientos o pocos miles de filas, ~15 páginas, **cerca de un minuto** (referencia: 4,3 s por
  página en consumos). Cada 30 min en horario de trabajo y tras cada sincronización de consumos; reemplazo
  completo en una transacción.
- **No se guardan datos de pacientes**: para proyectar no hacen falta.
- **Riesgo clave: un solo token por usuario** (la causa de los 401 de la sincronización). La de citas no puede
  correr a la vez que la de consumos con el mismo usuario. **Recomendado: un segundo usuario de API solo para la
  agenda** (permiso 01010202). Alternativa: misma credencial y **el mismo candado** (`sync-lock.core.ts`).

## Qué falta (por fases)

| Fase | Qué | Estado |
|---|---|---|
| 0 | Parte visual, con cifras de ejemplo | **Hecha**, desplegada apagada |
| 1 | Tabla `citas_agendadas`, sincronización de citas, valoración y **backtest** en Diagnóstico | Pendiente. **Parada:** el usuario revisa la precisión con sus datos reales |
| 2 | Endpoint `GET /api/reportes/agenda`; encender `VITE_PROYECCION_AGENDA` | Pendiente |
| 3 | Opcional: ajuste por inasistencia (`I/(C+I)`), cupos libres (`L`), ver el mes siguiente en el selector | Si se pide |

### El backtest (cómo se sabrá si sirve)

Con las citas del mes pasado (todos los estados), reconstruir lo que se habría proyectado el día 10 y
compararlo con lo realmente facturado, **por EPS**. Se publica el error en Diagnóstico. **La precisión no se
conoce todavía**: depende de este paso.

### Para escribir el mapeo sobre campos reales

El entorno de desarrollo **no tiene credenciales de Medifolios ni salida de red** hacia su servidor, así que el
mapeo se escribe contra la especificación. Lo que solo los datos reales confirman:

1. que el convenio de una cita se vincule bien a la EPS de las atenciones;
2. que `referencia.nomReferencia` de las citas se clasifique igual que `descripcion` de los consumos;
3. cuántas citas pendientes hay y el formato real de `fechaInicioCita`;
4. que el usuario de API tenga el permiso 01010202.

Para anclarlo sin dar credenciales: 3–5 registros reales de `GET /citas/listar` (estado P, **sin nombres ni
documentos de pacientes**) y de `GET /catalogos/convenios`, tomados del Swagger.

## Cómo se revisó

El prototipo lo revisó un subagente independiente, solo de lectura, con una lista de invariantes. Encontró
**problemas reales que las pruebas con datos simulados no habían visto**, todos corregidos y verificados con un
escenario que los provoca:

| Hallazgo | Corrección |
|---|---|
| La tarjeta del Inicio presentaba como «proyección más fiable» un piso (agenda parcial o con citas sin precio) | «Atendido + agendado» con aviso; no manda sobre la barra salvo agenda completa |
| La exportación incluía EPS sintéticas con $0 | Se excluyen las filas que solo existen por la agenda |
| «vs prom.» se comparaba contra un solo día de la semana | Solo en mes completo sin filtro de día |
| Ordenar por «Agendado» ordenaba solo las 10 primeras por facturación | Se ordena todo y luego se recorta a 10 |
| El modo Año pedía agenda de `[1 ene, hoy]` y enseñaba un proyectado anual con la agenda de un día | El modo Año no lleva agenda |
| El modo compacto (filtro de día o EPS) no mostraba la agenda en la ficha | La ficha la lleva, sin la referencia del mes anterior |
| Con el interruptor apagado cambiaban la leyenda y el SVG de los gráficos | Todo lo de la agenda es condicional |
| Un fallo del servidor o una agenda vieja se veían igual que «no hay citas» | Avisos explícitos |

**Interruptor apagado = HTML idéntico al de producción**, comprobado comparando el DOM real de seis pantallas
(mes, mes con filtro de día, esta semana, hoy, año e inicio) contra el último commit desplegado. Dos de esas
pantallas difieren de sí mismas entre capturas por la animación de recharts, así que se compararon por
emparejamiento: cada pantalla tiene al menos un par idéntico.

## Supuestos

- Solo citas **P de agenda**: sin imagenología ni canceladas.
- Cada EPS necesita ≥3 casos recientes para tener precio propio.
- El valor de una cita es una **estimación** a partir de lo facturado antes; no es el valor que se cobrará.
