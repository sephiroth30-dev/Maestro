# Proyección por agenda: lo atendido + lo agendado

> **Estado (v1.9.10): parte visual + backend completos y ENCENDIDOS por omisión.**
> Falta lo único que este entorno no podía comprobar: **correrlo contra el Medifolios real**. El mapeo se
> escribió contra la especificación y las consultas SQL nunca se ejecutaron en el entorno de desarrollo (no
> hay MySQL). La verdadera prueba es el primer día en producción: **Configuración → Diagnóstico → Proyección
> por agenda** dice si funcionó (ver «Puesta en marcha»).
>
> Para apagarla: compilar el frontend con `VITE_PROYECCION_AGENDA=false` (ver `docs/ENV.md`).

## Puesta en marcha (una sola vez)

1. **Configuración → Fuentes → editar el conector de Medifolios → marcar «Agenda de citas»** y guardar. Sin esta
   casilla no se sincroniza ninguna cita y la pantalla lo avisa.
2. El usuario de la API necesita el permiso **01010202** (citas). Opcionalmente **01041504** (convenios): si falta,
   la EPS de cada cita se vincula por el **nombre del convenio** contra los alias de Entidades.
3. **Configuración → Diagnóstico → Proyección por agenda:** pulsar **«Sincronizar citas ahora»** (~1 minuto) y
   revisar: permisos (si falta uno sale el mensaje de Medifolios), citas cargadas, hasta qué fecha llega la agenda,
   **convenios sin EPS vinculada** (agregar su nombre como alias de la entidad correcta) y **citas sin precio**.
4. Pulsar **«Evaluar precisión del mes pasado»** (backtest, unos minutos). **No fiarse de la cifra antes de ver
   ese resultado.**

Se usa la **misma credencial** que los consumos, con el **mismo candado** (`sync-lock.core.ts`): la sincronización
de citas nunca corre a la vez que la de consumos ni que el backtest, porque Medifolios da un solo token por
usuario. Un 403 **no** reautentica (no es un token caducado y reautenticar invalidaría el token de la otra
sincronización).

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

## Contrato del endpoint (`GET /api/reportes/agenda`, implementado)

Código: `reportes.controller.ts` → `reportes.service.ts#getAgenda` → `agenda.repo.ts` y `agenda-periodo.ts`
(lógica pura: `periodoDeAgenda`, `armarAgenda`). Caché de 60 s con el prefijo de la fuente activa.

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
  página en consumos). **Cada 15 min en horario de trabajo** (lunes a sábado, 6:00–19:59, hora de Colombia; en los
  minutos 7, 22, 37 y 52 para no coincidir con los consumos, que usan el 0 y el 30) y
  **al final de cada sincronización de consumos**; reemplazo completo en una transacción. Al arrancar el
  servidor, si la agenda lleva más de 30 min sin sincronizarse, se sincroniza de inmediato.
- **Si falla, no se pierde lo último bueno:** un 403, un error de red o un resultado sospechoso (0 citas, o
  ninguna válida) se guardan en `agenda_sync.error` y **no** vacían `citas_agendadas`. La pantalla avisa de que
  la agenda está desactualizada.
- **Un fallo persistente no se reintenta sin freno:** tras un error, el cron y la sincronización de consumos esperan
  30 min; el botón «Sincronizar citas ahora» lo salta. Si el botón o el backtest encuentran el candado ocupado,
  responden «ya hay una sincronización en curso» (409) y **no tocan** el último resultado guardado.
- **Un campo mal mapeado falla en voz alta:** si las citas llegan sin nombre de convenio o de procedimiento (la API
  llama distinto a un campo anidado), la sincronización **no guarda** y avisa en Diagnóstico, en vez de dejar todas
  las citas sin EPS con un «ok» engañoso. Un catálogo de convenios vacío tampoco reemplaza al anterior.
- **Desactivar «Agenda de citas»** hace que el endpoint deje de servir las citas guardadas (quedarían viejas).
- Un backtest «corriendo» de más de 30 min se muestra como interrumpido (el servidor se reinició a mitad).
- **No se guardan datos de pacientes**: para proyectar no hacen falta.
- **Riesgo clave: un solo token por usuario** (la causa de los 401 de la sincronización). Se resolvió con la misma
  credencial y **el mismo candado**. Si algún día la carga molesta, la alternativa es un segundo usuario de API
  solo para la agenda (permiso 01010202).
- **Con la misma credencial, pulsar «Probar» en Fuentes mientras corre una sincronización invalida su token**
  (ya ocurría con los consumos; ahora hay más sincronizaciones y queda más a la vista).

### Ventana de doble conteo (≤ 15 min)

Una cita que se atiende deja de estar «pendiente» en la siguiente vuelta. Entre que se atiende y esa vuelta
(hasta 15 min), su consumo ya puede estar facturado **y** la cita contarse aún como agendada. Es una ventana
conocida y pequeña; por eso la cadencia es corta. No se intenta «descontar» a mano.

## Qué falta (por fases)

| Fase | Qué | Estado |
|---|---|---|
| 0 | Parte visual, con cifras de ejemplo | **Hecha** (v1.9.9) |
| 1 | Tablas `citas_agendadas`, `agenda_sync`, `convenios_eps`, `agenda_backtest`; sincronización de citas, valoración, backtest y Diagnóstico | **Hecha** (v1.9.10). **Falta correrla contra Medifolios real** |
| 2 | Endpoint `GET /api/reportes/agenda`; encendida por omisión | **Hecha** (v1.9.10) |
| 3 | Opcional: ajuste por inasistencia (`I/(C+I)`), cupos libres (`L`), ver el mes siguiente en el selector | Si se pide |
| 4 | Opcional: si Medifolios expone un tope por contrato (`valorControlContrato` / `controlValor` en convenios, **sin confirmar**), mostrarlo junto al proyectado. Hoy no se usa: el usuario dijo que no hay topes formales | Solo si el usuario lo pide |

### El backtest (cómo se sabe si sirve)

Botón **«Evaluar precisión del mes pasado»** en Diagnóstico (`agenda-backtest.service.ts`, con el candado). Toma
las citas del **último mes cerrado** en estados **C** (cumplida) e **I** (incumplida), las **valora con el
historial anterior a ese mes** (sin fuga de datos) y compara, **por EPS**, lo estimado de las cumplidas contra lo
realmente facturado:

- **Cobertura = estimado ÷ real.** Es normal que quede algo por debajo de 100 %: lo facturado incluye atenciones
  que no nacen de una cita (sin agendar, ajustes). Lo que importa es que sea **estable y parecida entre EPS**: una
  EPS en 40 % mientras las demás están en 90 % es la que está mal valorada.
- **Inasistencia = I ÷ (C + I)** por EPS (información para decidir; no se aplica a la proyección).
- **Mide la valoración** (cuánto vale una cita), **no** si las citas se agendaron bien ni cuántas se cumplirán.

La precisión **no se conoce todavía**: depende de correrlo con datos reales.

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
