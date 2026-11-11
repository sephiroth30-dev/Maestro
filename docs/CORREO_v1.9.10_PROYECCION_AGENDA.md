# Borrador de correo — Proyección de facturación con la agenda de citas

> **Para copiar y pegar.** Antes de enviar, revisar los puntos marcados con `[[ ]]`:
> dependen de una decisión pendiente (ver la nota al final) o de un dato que el sistema no tiene.

---

**Para:**
direccion.administrativa@neurofic.com; agerencia.neurofic@gmail.com; jefeasistencia.neurofic@gmail.com; convenios.neurofic@gmail.com; coordinadormedico.neurofic@gmail.com

**CC:** resultados@neurofic.com

**Asunto:** Nuevo en el dashboard: cuánto vamos a facturar con las citas que ya tenemos agendadas

---

Buen día a todos:

Les cuento una funcionalidad nueva que ya está disponible en **https://dashboard.neurofic.com**
(versión 1.9.10). Hasta ahora el dashboard nos decía **cuánto hemos facturado**. Ahora también nos
dice **cuánto vamos a facturar** si se atienden las citas que ya están asignadas.

## Qué es

**Proyectado = Atendido + Agendado**

- **Atendido:** lo que ya se facturó, como siempre.
- **Agendado:** las citas que Medifolios tiene **pendientes** de aquí en adelante, valoradas por EPS.
- **Proyectado:** la suma de las dos.

La idea es que quien reparte las citas entre las EPS pueda ver con tiempo **cómo va quedando cada una**,
y decidir a quién darle más o menos cupo. El dashboard **informa**; la decisión sigue siendo de ustedes.
No hay topes ni calificaciones de «mejor pagadora» cargadas en el sistema, a propósito: cambian de un mes
a otro y las define el equipo.

## Dónde se ve y cómo se usa

En **Reportes** y en el **Inicio**. Sigue **los mismos filtros** que ya conocen: mes, semana, día, rango
de fechas, día de la semana y entidad. Si eligen «Esta semana», ven lo atendido y lo agendado de esa semana;
si eligen una EPS, solo la de esa EPS.

- **Facturación Bruta:** muestra lo atendido, **+ Agendado** (con el número de citas pendientes) y el
  **Proyectado**.
- **Cumplimiento:** además del porcentaje actual, aparece **«con lo agendado»**: cómo quedaríamos frente a la
  meta si se atiende todo lo agendado.
- **Tabla por entidad:** columnas **Agendado**, **Proyectado** y **vs prom. 3 meses**, que compara cada EPS
  con su propia facturación media de los últimos tres meses cerrados. Es solo una referencia, sin colores de
  «bueno» o «malo»: que una EPS vaya por encima de lo habitual no es un problema en sí.
- **Gráficas:** lo agendado aparece **rayado** encima de lo atendido, para que no se confunda con lo ya facturado.

Si hay algo que no se pudo calcular, la pantalla **lo avisa** en vez de mostrar un número engañoso: por ejemplo,
«agenda cargada solo hasta el 12/11» o «2 citas sin precio de referencia».

## Cómo se calcula el valor de una cita

Una cita no trae precio. Se estima con **lo que realmente hemos facturado antes** por ese mismo tipo de
servicio a esa misma EPS en los últimos 90 días (la mediana por visita). No usa las tarifas de los convenios,
porque la propia documentación de Medifolios advierte que no coinciden con lo facturado. Es una **estimación**,
no el valor que se cobrará.

Las citas se actualizan **cada 15 minutos en horario de trabajo** (lunes a sábado, de 6 a. m. a 8 p. m.).
No se guarda ningún dato de pacientes: para proyectar no hacen falta.

## Qué tan bien funciona (primeras mediciones)

La probamos con datos reales el 10 de noviembre:

- Cargó **1.011 citas pendientes**, hasta el 29 de diciembre, en 7 segundos. **1.005 tienen precio de referencia**
  y todas quedaron asociadas a una EPS. Las 6 sin precio son insumos («aguja monopolar»), no consultas.
- **Prueba retrospectiva con octubre:** valoramos las citas cumplidas de octubre usando solo la información
  anterior y las comparamos con lo realmente facturado. En las 8 EPS de mayor valor, lo estimado quedó en
  **alrededor del 90 % de lo facturado**. Por EPS va de 71 % a 119 %: cinco quedan entre 90 % y 105 %, y las más
  desviadas son Unidad Salud Ocupacional (sobreestima, 119 %), Suramericana (71 %), Clínica de Occidente (73 %)
  y Comfenalco (76 %). Quedar algo por debajo del 100 % es normal, porque lo facturado incluye atenciones que no
  nacieron de una cita.
- Además, comparamos la fuente nueva (la API de Medifolios) con la hoja que usábamos: **coinciden con 1 a 2 %
  de diferencia** en septiembre, octubre y noviembre.

## Lo que deben tener presente

**1. Hoy la cifra agendada es un techo, no una cifra esperada.** Suma todas las citas pendientes como si todas
se fueran a atender. Pero en octubre **cerca del 23 % de las citas quedaron incumplidas** (los pacientes no
llegaron; por EPS, entre 23 % y 30 %). Con ese comportamiento, la parte agendada sale **sobreestimada en torno a
una cuarta parte**. Por ejemplo, en una semana donde el sistema mostraba $55,9 M agendados, descontando la
inasistencia habitual serían unos $43 M.

[[ Opción A, si se aprueba el ajuste: «Ya estamos trabajando en mostrar dos cifras: **Agendado** (si llegan
todos) y **Esperado** (descontando la inasistencia histórica de cada EPS). Les avisamos cuando esté listo.» ]]
[[ Opción B, si aún no se decide: «Mientras tanto, lean el Proyectado como el máximo posible, no como lo más
probable.» ]]

**2. Es un piso en otro sentido:** solo cuenta lo que ya está en la agenda. Si a mediados de mes la agenda llega
hasta el 29, lo que se agende después no está. La pantalla lo avisa.

**3. Las citas de hoy** cuya hora ya pasó siguen contando hasta que Medifolios las marque como cumplidas o
incumplidas. Por eso, a última hora del día, todavía puede verse algo de agenda en la barra de hoy.

**4. No hay agenda para meses o semanas ya pasados** ni para la vista de **Año**: una proyección anual con una
agenda que solo llega unas semanas adelante no sería honesta.

## Qué les pedimos

- **Úsenla unas semanas y cuéntennos qué ven raro.** Sobre todo, si una EPS les parece muy alta o muy baja
  frente a lo que conocen. Con eso ajustamos el método.
- Si notan una EPS o un servicio que aparece **sin precio**, o una cita que no debería estar, avísennos con el
  nombre de la EPS y la fecha.
- [[ Si el ajuste por inasistencia queda aprobado: «Díganos si prefieren ver el Esperado en lugar del Agendado
  en la ficha principal, o las dos cifras.» ]]

Quedo atento a sus comentarios.

Cordialmente,

[[ NOMBRE ]]
[[ CARGO ]]

---

## Nota para quien envía (borrar antes de enviar)

- **Decisión pendiente:** el ajuste por inasistencia («Agendado» y «Esperado») está propuesto pero **no
  implementado**. Hasta que se apruebe, el correo debe usar la opción B; si ya se hizo, la opción A. No prometer
  fecha sin confirmarla.
- **Cifras del correo:** salen de la primera corrida en producción (10-nov-2026). Las de cobertura y
  inasistencia son de las 8 EPS de mayor valor que se alcanzaron a revisar (la fila TOTAL del backtest no se
  vio completa). Si se quiere afirmar algo más fino, revisar primero la tabla completa en
  **Configuración → Diagnóstico → Proyección por agenda**.
- **Qué no decir:** que la cifra es «lo que se va a facturar». Es una estimación y, por ahora, un techo.
- **Detalle técnico y limitaciones:** `docs/PROYECCION-AGENDA.md`.
