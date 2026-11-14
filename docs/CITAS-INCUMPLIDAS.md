# Citas incumplidas y su porcentaje, por EPS

> **Para qué sirve.** Ver cuántas citas **no se cumplieron** (estado `I` de Medifolios) y **qué porcentaje** son de las citas ya resueltas, en total y
> **por EPS**, siguiendo los mismos filtros que el resto de Reportes, para identificar en qué EPS hay más y hacerles seguimiento.

## Dónde se ve

En **Reportes**:

- **Tarjeta «Citas Incumplidas»** (quinta de la fila de arriba): el total de incumplidas del periodo, el **% global** («10,7 % de 870 citas resueltas») y
  las **tres EPS con más** incumplidas, cada una con su %.
- **Columnas «Incumplidas» y «% incumpl.»** en la tabla *Facturación por Entidad*. Las dos son ordenables: un clic en «Incumplidas» pone arriba la EPS con
  más; un clic en «% incumpl.», la que más incumple en proporción. El % de las EPS claramente por encima del global va en rosa.
- Una EPS con incumplidas y **nada facturado** también aparece en la tabla.
- Ambas columnas van en la **exportación** (PDF/Excel/CSV), con una nota si lo cargado no cubre todo el periodo.

**Sigue todos los filtros:** mes, año, rango, atajos (hoy, ayer, esta semana…), semana, día, **día de la semana** y **entidad** (con una EPS elegida, la
tarjeta cuenta solo esa EPS). La tarjeta y las columnas salen de la misma consulta: el total de la tarjeta es la suma de las filas.

## Qué cuenta (y qué no)

- **Incumplidas** = citas de agenda en estado `I`. **% de incumplimiento = incumplidas ÷ (cumplidas + incumplidas)**: se calcula sobre las citas que ya se
  **resolvieron**. Las pendientes (estado `P`) no entran: todavía no se sabe qué pasará con ellas. Una cita pendiente con fecha pasada que nadie marcó
  tampoco cuenta ni como cumplida ni como incumplida.
- Cuenta **citas**, no facturación, **por el día de la cita** (`fechaInicioCita`), no por el día en que se marcó.
- Igual que la agenda, **no incluye imagenología ni canceladas**.
- **Con pocas citas el % no dice nada** (3 de 5 es 60 %): con menos de 10 citas resueltas el % de esa EPS se muestra atenuado y con un aviso. Un % sin ninguna
  cita resuelta sale «—», nunca 0.
- **Sin datos de pacientes ni una fila por cita:** se guarda un **resumen por día y EPS** (cuántas cumplidas y cuántas incumplidas).

## Cómo se carga

El resumen se guarda en `citas_resumen_dia`. En **cada sincronización de citas** (cada 15 min en horario de trabajo), dentro del mismo candado y con la misma
credencial, y **después** de la agenda y de la pantalla de TV (nunca las estorba), se piden las citas **cumplidas y las incumplidas** de:

| Tarea | Qué pide | Cuándo |
|---|---|---|
| **Diaria** | El mes anterior hasta hace 8 días | Una vez al día, **primero** (esa vuelta no suma histórico) |
| **Ventana** | Los últimos 7 días | En cada vuelta, después de la diaria (una cita puede pasar a incumplida horas después) |
| **Histórico** | Un mes más hacia atrás | En cada otra vuelta, hasta el 1 de enero del año anterior |

**Carga sobre Medifolios:** las cumplidas son unas 4 veces más que las incumplidas. Estimación (con ~100 citas al día): la ventana son unas 5 páginas
(~20 s) en cada vuelta; la pasada diaria, unas 14 (~1 min) una vez al día; cada mes de histórico, unas 13 (~1 min) durante las primeras ~22 vueltas. Todo dentro
del mismo candado de las demás sincronizaciones, que se omiten (sin fallar) si lo encuentran ocupado.

Cada tarea reemplaza solo su rango, en una transacción. **Una respuesta sospechosa no se acepta** (`rangoSospechoso`), y se conserva lo anterior avisando:
- **Vacía o diezma lo guardado:** menos de la mitad de lo que ya había en ese rango, en cumplidas o en incumplidas, con 10 citas o más previas. Un 200 con lista vacía
  en un fallo a medias borraría datos reales.
- **Primera carga rara** (sin filas previas, como todo mes de histórico): 5 o más incumplidas y **ninguna** cumplida, o 100 o más cumplidas y ninguna incumplida. Sin
  esto, unas cumplidas vacías con las incumplidas bien guardarían un 100 % de incumplimiento que nadie volvería a pedir.

El botón **«Sincronizar citas ahora»** de Diagnóstico sí las acepta (por si Medifolios reclasificó muchas citas de verdad).

Convenios sin EPS que la colación de la tabla trata como iguales («Sanitas», «SANITAS», «Sánitas») se agrupan en UNA fila antes de guardar (y el `ON DUPLICATE KEY`
suma en vez de pisar), para que un choque de llave no pierda citas.

### La cobertura se dice, y no miente

Lo cargado es **un tramo sin huecos** (`desde`–`hasta`). La pasada diaria va **antes** que la ventana, para que unos días sin sincronizar (hasta ~1 mes) no
pierdan lo cargado: la diaria se pega al tramo y la ventana se pega a la diaria. Si el sistema pasa **más de un mes** sin sincronizar (agenda desactivada,
credencial rota) queda un hueco que ninguna tarea cubre: el tramo **se reinicia** desde la diaria y el histórico vuelve a llenar hacia atrás. Así `completa` nunca
afirma un mes que tiene semanas vacías. La respuesta lleva `cobertura.desde` y `cobertura.hasta`.

`completa` admite un día de margen **solo** si el periodo llega hasta hoy (la última pasada pudo ser ayer); un periodo ya cerrado exige llegar hasta su último día.

- Si el periodo que miras no está entero en lo cargado, la tarjeta lo dice con precisión: **«Cargado desde el 5 nov: antes de esa fecha el conteo puede quedar corto»**
  (falta el principio), **«Cargado hasta el 11 nov: faltan los últimos días…»** (falta el final) o **«Cargado del 5 nov al 11 nov…»** (faltan los dos). La exportación
  lo dice en su nota.
- Si el periodo es **entero anterior** a lo cargado: «—» y «este periodo es anterior a lo cargado»; ni la tarjeta ni la tabla muestran ceros.
- **Agenda sin activar:** «—» y «La agenda de citas no está activada». **Activada pero sin sincronizar:** «—» y «Aún no se han sincronizado las citas incumplidas».
  Nunca «0».
- Si lleva **más de 2 h sin sincronizar, dentro del horario de trabajo** (lunes a sábado, 6:00–19:59 hora de Colombia, con media hora de gracia al abrir), o la
  última sincronización falló, se avisa. Fuera de horario no hay nada que esperar: la lectura de anoche no es un fallo. Mientras llegan las cifras de un filtro nuevo,
  la tarjeta se atenúa (se ven las del filtro anterior) (el motivo está en **Configuración → Diagnóstico → «Citas incumplidas (Reportes)»**).

## Dónde está en el código

Backend: `services/incumplidas-plan.ts` (qué pedir, cobertura, resumen y % ; lógica pura), `services/incumplidas-sync.service.ts`,
`repositories/incumplidas.repo.ts`, `GET /api/reportes/incumplidas` (`reportes.controller.ts` → `reportes.service.ts#getIncumplidas`), tablas
`citas_resumen_dia` e `incumplidas_sync`. Frontend: `components/widgets/KpiIncumplidas.tsx`, las columnas en `TablaEntidades.tsx`, `useIncumplidas` en
`api/reportes.ts`, y la fila de Diagnóstico en `pages/Admin/SeccionAgenda.tsx`.

## Límites conocidos

- **Las consultas SQL nuevas no se pudieron ejecutar en el entorno de desarrollo** (sin MySQL): el primer día en producción es la prueba real. Si la tarjeta dice «Aún no se
  han sincronizado» pasado un ciclo, mira Diagnóstico.
- Una cita puede **pasar de incumplida a cumplida** (corrección en Medifolios): la ventana de 7 días y la pasada diaria lo recogen; en meses más viejos no se vuelven a pedir, así
  que una corrección tardía no se refleja.
- Las citas que **no se pudieron vincular a una EPS** al guardarse (alias faltante, catálogo de convenios sin permiso) quedan agrupadas por el nombre de su convenio; las de meses que ya no
  se recargan no se re-vinculan aunque luego se agregue el alias.
- No es un porcentaje de la agenda ni de lo facturado: es de las citas resueltas.
