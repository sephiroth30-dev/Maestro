# Modo TV: pantalla de monitoreo para la oficina

> **Para qué sirve.** Una sola pantalla, pensada para dejarla 24/7 en un televisor o monitor de la oficina, que
> muestra el avance del mes hacia la meta, lo facturado hoy, las citas de hoy (atendidas, pendientes, incumplidas),
> la agenda de los próximos días y una cinta con lo último que se movió. Son métricas **reales** de la clínica.
>
> **Qué NO es.** No es tiempo real. Medifolios solo se consulta, no avisa de nada, y el dato cambia como máximo cada
> 15–30 minutos. Ver «Cómo se mueve la pantalla sin mentir».

## Cómo abrirla

1. Entrar al dashboard con tu usuario de siempre (**no hace falta un usuario nuevo**).
2. En el **Inicio**, pulsar **«Modo TV»**. Pasa a pantalla completa en `/tv`.
3. Para salir: mover el ratón (aparecen los botones) y pulsar **✕**, o `Esc` para salir de la pantalla completa.

Pueden verla los roles **ADMIN, GERENCIA, DIRECCION, FACTURACION y COORDINADORA**. **ADMISIONES no**: el resumen incluye
presupuesto y proyección, y ese rol tiene el acceso limitado al mes en curso.

## Dejarla funcionando siempre (PC o mini-PC con Chrome)

1. **Iniciar sesión marcando «Mantener sesión en este equipo».** Sin eso, la sesión vive solo en la pestaña y, si el PC se
   reinicia (un apagón), vuelve al inicio de sesión. Con la casilla, la sesión queda en el navegador de ese equipo.
   Usar solo en el equipo de la pantalla.
2. Abrir `https://dashboard.neurofic.com/tv`. Al pulsar «Modo TV» desde el Inicio se queda marcado que ese equipo es una
   TV: si alguna vez se cierra la sesión, tras volver a entrar regresa a la pantalla.
3. **Abrir Chrome en modo kiosco al encender el PC** (Windows): crear un acceso directo en la carpeta de inicio
   (`shell:startup`) con destino
   `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk https://dashboard.neurofic.com/tv`
   y, mejor, con `--noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required`. En modo kiosco la pantalla
   completa es automática (no hace falta el clic).
4. **Desactivar la suspensión del equipo y apagar solo la pantalla si se quiere**: Configuración → Sistema → Inicio/apagado →
   «Nunca» para suspender. La pantalla pide además «Wake Lock» al navegador y lo renueva si la pestaña se oculta, pero si el
   navegador no lo permite aparece un aviso y hay que desactivar la suspensión en el sistema.
5. Cuando se despliega una versión nueva del dashboard, la pantalla **se recarga sola** (compara la versión del servidor en
   cada lectura). No hay que tocarla.

## Diseño: terminal de bolsa (v1.9.14)

La pantalla se parece a la de una bolsa: **índices arriba, un gráfico de línea del día, un mapa de calor, velas diarias y una cinta de EPS
que no se detiene**. Todo escala por el lado que limite de la ventana (diseño 16:9; vale para 1080p, 4K o una ventana pequeña).

| Bloque | Qué es | De dónde sale |
|---|---|---|
| **Índices** (arriba, 5 celdas) | Facturado hoy ▲▼ vs ayer a esta hora · citas atendidas ▲▼ · meta del mes · proyectado (techo) · agenda pendiente | KPIs, citas de hoy y la serie del día |
| **Facturado acumulado hoy** | Línea de lo facturado a lo largo de la jornada: **un punto por sincronización (real)**, el **día anterior de fondo** (punteado) y un tramo punteado «≈» hasta ahora al ritmo de hoy; la punta pulsa | Tabla `tv_serie` (ver abajo) |
| **Mapa de EPS** | Cuadros con área = proyectado (facturado del mes + agendado) y color = variación contra el promedio de 3 meses (verde/rojo; **gris = sin historial para comparar**) | Facturado por EPS (Reportes), agenda por EPS y su `promedio_3m` |
| **Velas diarias** | Una barra por día del mes (sin domingos): **verde** si llegó a la meta diaria, **roja** si no; sábado neutro; hoy en curso; futuros —y pasados **sin ningún dato**, p. ej. un festivo— vacíos. **Sin presupuesto cargado no se juzga ningún día** (todo «cumpliría» una meta de $0) y la meta del mes sale «—" La meta diaria = presupuesto ÷ días hábiles (lunes a viernes) | Facturado por día |
| **Citas de hoy** y **Agenda 7 días** | Atendidas / pendientes / incumplidas con barras por hora y el marcador de «ahora»; valor pendiente de los próximos días con un foco rotativo | `citas_dia` y la agenda |
| **Cinta de EPS** (abajo) | `NUEVA EPS $26,6 M ▲ +12,3 % hoy ▲ +$2,1 M agenda $11,4 M` para las 15 principales, desplazándose sin parar | Las mismas EPS del mapa |
| **Sesión** (cabecera) | Reloj con segundos y «Sesión abierta · cierra en 2 h 29 min» con barra de la jornada; fuera de horario «Sesión cerrada · abre mañana a las 6:00 a. m.» | Solo el horario |

### El parpadeo verde/rojo solo es real

Como en una pantalla de bolsa, una celda parpadea **en verde si su valor subió y en rojo si bajó**, pero **únicamente cuando llega un dato real**
(un cambio de lo que trae el servidor tras una sincronización). Lo que se estima entre lecturas (los dos contadores «≈») **nunca** parpadea.
Nada por EPS se inventa entre lecturas: esas cifras solo cambian cuando sincroniza Medifolios.

### La serie del día y «vs ayer a esta hora»

Medifolios no da datos por hora. Para dibujar la línea del día **se guarda una foto** de las cifras (facturado de hoy, atendidas, pendientes e
incumplidas) **en cada sincronización de citas dentro del horario de trabajo** (lunes a sábado, 6:00–19:59; las sincronizaciones de noche y de
domingo NO guardan foto, porque harían que el lunes el «día anterior» fuera un domingo en 0), en la tabla `tv_serie` (sin datos de pacientes; se
conservan 60 días). Consecuencias: el gráfico **empieza vacío** el día del despliegue y se va llenando; **la comparación con el día anterior
aparece desde la segunda jornada**. El «día anterior» es el más reciente **con datos** (un festivo entre semana, todo en 0, se salta). Compara contra la cifra *vigente* ayer a esa misma hora (el último punto a esa hora o antes, sin
interpolar). Si ayer aún no tenía datos a esa hora, dice «sin dato» y no 0.

## Barra superior y botones

Arriba: la **hora de la clínica** con segundos (UTC-5, sin depender de la zona del equipo), la **sesión** (abierta / cerrada), el estado de los
datos y tres botones (≈, pantalla completa, salir) que **se ocultan solos** a los 5 s sin mover el ratón.

> **La cinta de movimientos («+4 citas atendidas») fue reemplazada por la cinta de EPS** (v1.9.14): informaba poco. Los movimientos se
> siguen detectando y guardando en `tv_movimientos` (48 h), pero hoy no se muestran; ver «Los movimientos se detectan…» más abajo.

### Fuera de horario (noche, domingos)

De lunes a sábado de 6:00 a 19:59 (hora de Colombia) la pantalla es la normal. Fuera de ese horario no pasa nada nuevo, así
que pasa a un **modo tranquilo**: un reloj grande, el **cierre del día** (facturado, citas atendidas e incumplidas, avance de la
meta), atenuada. A las 6:00 vuelve sola. La imagen además se desplaza unos píxeles cada 3 minutos (protege paneles OLED/plasma).

## Cómo se mueve la pantalla sin mentir

Siempre se está agendando y facturando, así que una pantalla quieta no representa la clínica. Pero el dato real llega cada
15–30 minutos. Se resuelve así, con una regla: **el número real es el ancla**.

1. **Contadores con ritmo («≈»).** Entre dos lecturas, *Facturado hoy* y *Citas atendidas* (las dos primeras celdas de los índices) avanzan al **ritmo real de hoy**
   (facturado de hoy ÷ horas laborales transcurridas) a partir de la hora de la última sincronización. Esa parte es una
   **estimación**: está **marcada** («≈ entre lecturas»), el **dato real y su hora** se ven debajo, y tiene un **tope**
   (nunca avanza más de lo que daría el ritmo hasta la próxima sincronización esperada: 30 min por omisión, la cadencia de la
   fuente hasta un máximo de 60). Si la sincronización se atrasa, el contador **se detiene** en el tope en lugar de subir sin
   fin. Cuando llega el dato real, el contador **se acomoda con una transición, también hacia abajo**: una corrección no se
   esconde. El botón **≈** apaga la interpolación (queda solo lo real); se recuerda en ese equipo.
   - El ritmo del facturado es **lineal sobre la jornada** (los consumos no traen hora de atención): una aproximación, no un
     perfil horario. **No se calcula en la primera hora de jornada** (a las 6:30 una sola cita ya sería «2 por hora» y el contador
     se adelantaría mucho a lo real). Las **atendidas** también llevan «≈» cuando se están estimando.
2. **Movimiento verídico.** El marcador de «ahora», la cinta de EPS, la línea del día con su punta que pulsa y el foco rotativo se alimentan de
   datos reales.
3. **Cuando entra un dato nuevo**, el contador se acomoda y las celdas que cambiaron **parpadean en verde o rojo** (ver «El parpadeo…»).

### Los movimientos se detectan, no ocurren «en vivo» (hoy no se muestran)

Los movimientos se calculan **al sincronizar**, comparando la lectura anterior con la nueva. La hora que muestra es la de **detección**,
no la de la atención («10:37 · +4 citas atendidas» = se detectó a las 10:37). Se **suprimen** en tres casos, para no inventar
movimientos: sin lectura previa (primer arranque), lectura de otro día o de **más de 3 horas** (tras una caída, todo lo agendado en
el hueco saldría como un solo «+N»; vale para atendidas, incumplidas y agendadas), y cambio de mes (la ventana de citas se alarga y
entrarían cientos de «nuevas»). Una lectura previa **vacía** (un día que arranca sin citas) sí es una lectura. Solo se muestra una **subida** de lo facturado; una baja (un ajuste) no.

### Estado de los datos

El punto de la cabecera y el aviso dicen la verdad:

- **En vivo:** el servidor responde y Medifolios está sincronizado.
- **Medifolios sin sincronizar** (ámbar): el servidor responde, pero **los consumos** (la cifra principal: facturado y meta) llevan más
  que la cadencia de la fuente + 15 min sin sincronizar, **o las citas** llevan más de 45 min. Se evalúan **por separado**: que las citas
  estén al día no esconde que los consumos llevan horas parados. Solo en horario de trabajo (de noche es normal) y no en la primera
  media hora de la jornada (el primer ciclo aún no corrió). Con sincronización manual no hay contra qué juzgar.
- **Sin conexión con el servidor** (rojo): la pantalla lleva más de 3 minutos sin respuesta. **Conserva la última lectura** y lo
  dice, en vez de congelarse sin avisar.

## Cómo funciona por dentro

- **Endpoint:** `GET /api/tv/estado` (roles ADMIN, GERENCIA, DIRECCION, FACTURACION, COORDINADORA). Un solo endpoint agregado y
  ligero; la pantalla lo consulta cada **45 s** (también con la pestaña en segundo plano). Caché de 20 s en el servidor además
  de la de reportes (60 s). **Solo agregados: nada de pacientes ni de honorarios** (hay una prueba que lo comprueba).
- **Polling, no WebSocket:** el hosting (Passenger) no es amigable con conexiones largas y el dato solo cambia cada 15–30 min.
- **Si «Citas de hoy» sale vacía:** la tarjeta lo explica. «Esperando la primera lectura» = aún no corrió (tras un despliegue se lee al
  arrancar el servidor, y luego cada 15 min). «No se pudieron leer» = falló: **Configuración → Diagnóstico → Proyección por agenda →
  «Citas de hoy (pantalla de TV)»** muestra la hora y el error (p. ej. un 403 de Medifolios). «Sincronizar citas ahora» reintenta
  saltándose el enfriamiento de 30 min.
- **Citas de hoy:** la sincronización de citas ya pedía las pendientes; ahora además pide las **cumplidas (C)** y **incumplidas (I)
  de hoy** (dos peticiones pequeñas, dentro del mismo candado y con la misma credencial) y las guarda en `citas_dia`, que se
  reemplaza entera en cada vuelta **junto con sus movimientos, en una sola transacción**. Siempre guarda una fila marcador, para
  distinguir «hoy no hay citas» (sábado sin agenda, festivo) de «hoy no se ha leído». No se toca `citas_agendadas`.
  - Va **después** de dar la agenda por buena: el «ok» de la agenda no espera a estas dos peticiones. Si fallan, **no** se estropea
    la agenda: la TV conserva la lectura anterior y la edad de los datos lo muestra; tras un fallo no se reintenta en cada vuelta
    de 15 min (espera 30 min; el botón «Sincronizar citas ahora» lo salta).
  - Las cumplidas e incumplidas de un día **solo crecen**. Si Medifolios respondiera vacío o a medias, se **arrastran** las de la
    lectura anterior: guardarlo tal cual haría que la siguiente lectura correcta las contara como «+N atendidas» falsas.
- **Movimientos:** tabla `tv_movimientos` (48 h). Las citas nuevas/atendidas/incumplidas salen de `citas-dia.service.ts` +
  `tv-movimientos.ts` (lógica pura); lo facturado, de comparar lo facturado hoy antes y después de cada sincronización de consumos
  (`sync.service.ts`).
- **Código:** `backend/src/services/{tv-estado,tv-serie,tv.service,tv-movimientos,citas-dia.service}.ts`, `controllers/tv.controller.ts`,
  `repositories/tv.repo.ts`; frontend `pages/Tv.tsx`, `pages/tv/*` (Indices, GraficoDia, MapaEps, Velas, CintaEps, Contador, useFlash),
  `pages/tv.css`, `api/tv.ts`, `lib/tv.ts` (lógica pura: treemap, geometría del gráfico, velas, sesión, ritmo).
- **Más campos en `GET /api/tv/estado`:** `serie` (fotos de hoy), `previa` (día anterior con fotos), `vs_previa`, `eps` (15 principales con
  facturado, agendado, proyectado y variación) y `dias_mes` (velas y meta diaria). Siguen siendo solo agregados.

## Límites conocidos

- **No existe «en atención».** Medifolios solo tiene estados pendiente / cumplida / incumplida / libre; el máximo es «atendidas».
  Una cita pasa de pendiente a cumplida con un desfase de hasta 15 min.
- **«Atendidas» sale del estado C de Medifolios**: si en la práctica C no coincide con «ya facturado», la cifra puede adelantarse
  o atrasarse respecto a lo facturado. Se comprueba con datos reales.
- La cifra **agendada es un techo**: no descuenta la inasistencia (≈ 23 % en octubre). Está rotulado en pantalla. El ajuste
  («Esperado») está propuesto y pendiente de aprobación.
- **Las consultas SQL nuevas no se pudieron ejecutar en el entorno de desarrollo** (no hay MySQL): el primer día en producción
  es la prueba real. Si algo falla, el síntoma es la pantalla vacía de «citas de hoy» o sin movimientos, con el servidor
  respondiendo; ver los registros del servidor («Citas de hoy para la TV: no se pudieron actualizar»).
- La sesión se mantiene gracias a la renovación del token (corregida en 1.9.11). Si alguna vez se cierra, la pantalla vuelve a
  `/login` y, tras iniciar sesión, regresa a `/tv`.
- Un navegador sin Wake Lock no puede evitar la suspensión por sí solo: hay que desactivarla en el sistema.
- **Autorrecarga y pantalla completa:** al recargar por una versión nueva, un navegador normal sale de la pantalla completa pedida con
  el botón y no puede volver a pedirla sin un clic. Con `--kiosk` no importa. Solo recarga si cambia la versión del servidor.
- La pantalla usa el **reloj del equipo** para el horario y la edad de los datos: un PC con el reloj desajustado puede mostrar
  «retrasado» sin serlo o cambiar de modo a otra hora. Mantener la hora automática.
- Entre las 12 a. m. y las 6 a. m. y en domingo no se muestra el «cierre del día» (sería el de un día nuevo, con $0): solo el avance
  del mes. El cierre (facturado, atendidas, incumplidas) aparece pasadas las 8 p. m. de lunes a sábado.
- Una cita sin hora en Medifolios cuenta en los totales pero no en las barras por hora.
