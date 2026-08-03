# NEUROFIC — Admin Dashboard
## Manual de Usuario

| Campo | Valor |
|---|---|
| **Versión** | 2.2 |
| **Fecha** | Junio 2026 |
| **URL del sistema** | dashboard.neurofic.com |
| **Usuario de soporte** | soporte@neurofic.com |
| **Elaborado por** | Equipo de Tecnología — Neurofic |
| **Soporte** | resultados@neurofic.com |

> *Documento confidencial de uso interno. No distribuir fuera del equipo de Neurofic.*

---

# Parte I — Primeros pasos

## 1. Acceso al sistema

### 1.1 Dirección del sistema

El sistema está disponible en la siguiente dirección web:

**https://dashboard.neurofic.com**

Abrir esta dirección en cualquier navegador moderno (Chrome, Firefox, Edge o Safari actualizados).

### 1.2 Ingreso

Para iniciar sesión en el sistema:

1. Ingresar el correo electrónico asignado por el administrador (ejemplo: gerencia@neurofic.com).
2. Ingresar la contraseña suministrada.
3. Hacer clic en **Iniciar sesión**.

Si el correo o la contraseña son incorrectos, el sistema mostrará: *"Correo electrónico o contraseña incorrectos"*. Verificar que no haya espacios al inicio o al final.

Si se realizan demasiados intentos fallidos, el sistema bloqueará temporalmente los intentos durante un minuto y mostrará: *"Demasiados intentos. Por favor espera un minuto…"*

### 1.3 Cambiar la contraseña

Se recomienda cambiar la contraseña asignada en el primer ingreso. Para hacerlo:

1. En la barra lateral izquierda, parte inferior, hacer clic en el **ícono de llave** (junto al nombre de usuario).
2. Ingresar la contraseña actual, la nueva contraseña (mínimo 8 caracteres) y confirmarla.
3. Hacer clic en **Guardar**. La nueva contraseña entra en vigencia de inmediato.

### 1.4 Cerrar sesión

Hacer clic en el **ícono de salida** (flecha) en la parte inferior de la barra lateral. El sistema redirigirá a la pantalla de inicio de sesión.

> **Buena práctica:** siempre cerrar sesión al terminar de trabajar, especialmente en equipos compartidos.

### 1.5 Recuperar contraseña olvidada

En la pantalla de inicio hay un enlace *"¿Olvidaste tu contraseña?"*. Al hacer clic, el sistema indica que se debe contactar al administrador (soporte@neurofic.com), quien puede restablecerla desde Configuración → Usuarios.

---

## 2. Navegación general

### 2.1 Barra lateral

La barra lateral izquierda es el menú principal del sistema. En escritorio siempre está visible. En dispositivos móviles se abre con el ícono de menú en la esquina superior izquierda.

**El menú muestra únicamente las secciones habilitadas para los módulos asignados al usuario activo.** Al pie de la barra se muestra el nombre del usuario, sus módulos activos y la versión de la aplicación.

### 2.2 Secciones disponibles

| Sección | Descripción | Módulo requerido |
|---|---|---|
| Dashboard | Resumen ejecutivo del mes en curso | `dashboard` (todos) |
| Reportes | Facturación detallada con filtros avanzados | `reportes` |
| Pacientes | Personas atendidas, pacientes nuevos y frecuencia de retorno | `pacientes` |
| Honorarios | Liquidaciones y pagos a profesionales | `honorarios` |
| Capacidad | Ocupación real vs. capacidad instalada | `capacidad` |
| Auditoría | Registro de todas las acciones del sistema | `auditoria` |
| Configuración | Usuarios, reglas, fuentes y parámetros del sistema | `configuracion` |

> El sistema utiliza **permisos modulares**: en lugar de un rol fijo, cada usuario tiene asignados los módulos a los que puede acceder. El administrador configura esto desde Configuración → Usuarios.

---

# Parte II — Módulos del sistema

## 3. Dashboard

Acceso: todos los usuarios (módulo `dashboard`). Es la pantalla principal tras iniciar sesión. Ofrece una visión ejecutiva y en tiempo real del desempeño de la clínica en el mes en curso.

### 3.1 Tarjeta principal de KPIs

La tarjeta central muestra los indicadores clave del período seleccionado:

- **Facturación del mes** — monto total facturado en pesos colombianos.
- **Meta / Faltante** — si la meta se alcanzó, muestra "✓ Meta cumplida" en verde. Si no, muestra en rojo cuánto dinero faltó para cumplirla (ej. *"Faltó: $4.200.000"*).
- **Proyección de cierre** — estimación del total al finalizar el mes, calculada sobre el ritmo actual.
- **Barra de progreso** — representación visual del cumplimiento con marcador de proyección.

El color del indicador principal cambia según el avance:

| Estado | Color | Rango |
|---|---|---|
| En Meta | Verde | 100% o más |
| En Progreso | Ámbar | 80% – 99.9% |
| Bajo Meta | Rojo | Menos del 80% |

### 3.2 Indicadores secundarios

| Indicador | Descripción |
|---|---|
| Atenciones | Total de sesiones registradas en el período |
| Ticket Promedio | Facturación total ÷ número de sesiones |
| Promedio Diario | Monto promedio facturado por día |
| Días Hábiles Rest. | Días que faltan para cerrar el mes |

### 3.3 Gráficos analíticos

- **Tendencia de facturación** (últimos 6 meses) — gráfico de línea para identificar crecimiento o caída.
- **Mix de pagadores** — torta con la participación de cada tipo de pagador (EPS, particular, póliza, convenio).
- **Cumplimiento semanal** — barras del avance semana a semana dentro del mes.
- **Top Entidades del mes** — tabla con las principales entidades pagadoras ordenadas por monto.

### 3.4 Cambiar el período visualizado

Usar el selector de mes y año en la esquina superior derecha para consultar cualquier mes histórico. Todos los indicadores y gráficos se actualizan automáticamente.

---

## 4. Reportes

Acceso: módulo `reportes`. Permite analizar la facturación en detalle con filtros flexibles por fecha, tipo de servicio, entidad pagadora y día de la semana.

> **Nota:** Los usuarios con acceso limitado (configurado por el administrador) solo pueden ver el mes actual.

### 4.1 Modos de visualización

- **Modo Mes** — seleccionar un mes completo del listado de los últimos 6 meses.
- **Modo Rango de fechas** — definir un período personalizado con presets rápidos (Hoy, Ayer, Esta semana, Semana pasada, Año) o ingresando fechas manuales de inicio y fin.

### 4.2 Filtros activos

Los filtros aplicados aparecen como etiquetas de color sobre los gráficos. Son acumulables y se eliminan individualmente con la X de cada etiqueta:

| Filtro | Cómo activarlo | Efecto |
|---|---|---|
| Día de la semana | Clic en una barra del gráfico "Facturado por día" | Muestra solo atenciones de ese día |
| Tipo de pagador | Clic en un segmento del gráfico Mix de pagadores | Filtra por EPS, particular, póliza, etc. |
| Entidad específica | Clic en una fila de la tabla Facturación por Entidad | Muestra solo atenciones de esa entidad |
| Grupo de flujo | Selector en la barra de filtros | Flujo de caja o Cobro a entidades |

### 4.3 Indicadores (KPIs)

- **Facturación Bruta** — monto total del período filtrado. Muestra en rojo cuánto dinero faltó para cumplir la meta cuando no se alcanzó, en lugar de mostrar solo el porcentaje.
- **Atenciones** — número de sesiones.
- **Ticket Promedio** — valor promedio por sesión.

### 4.4 Tabla Facturación por Entidad

| Columna | Descripción |
|---|---|
| Entidad | Nombre de la entidad o pagador |
| Tipo | Tipo de pagador (EPS, Convenio, Particular, etc.) |
| Monto | Total facturado a esa entidad en el período |
| % Total | Participación porcentual en la facturación |
| Sesiones | Número de atenciones asociadas |

### 4.5 Tabla Mix por Servicio

Muestra el desglose de facturación por tipo de procedimiento: nombre del servicio, volumen de sesiones, monto facturado y porcentaje de participación en los ingresos totales.

### 4.6 Exportar reportes

Todas las secciones con datos tienen un botón **Exportar** en el encabezado: Dashboard,
Reportes, Pacientes, Honorarios, Capacidad y Auditoría. Genera **PDF**, **Excel** o **CSV**.

Al pulsarlo se abre un cuadro de diálogo donde se elige el formato y se marca qué
secciones y qué columnas incluir. Por defecto viene todo marcado; los presets son atajos:

| Preset | Qué hace |
|---|---|
| **Todo** | El reporte completo. |
| **Vista médicos (sin valores)** | Quita de un clic todas las columnas de dinero y deja solo cantidades. Pensado para entregar a un profesional su actividad sin exponer tarifas. |
| **Solo tablas** | Omite las gráficas. |
| **Resumen ejecutivo** | Indicadores y gráficas, sin las tablas de detalle. |

**Qué esperar de cada formato**

- **PDF** — Trae el logotipo, el período, los filtros que estaban aplicados, las gráficas
  y numeración de páginas. Es el formato para imprimir o adjuntar a una presentación.
  Rechaza tablas de más de 2.000 filas; para volúmenes mayores usar Excel o CSV.
- **Excel** — Una hoja por sección más una portada con el período y los filtros. El
  encabezado queda fijo y con autofiltro, y **los importes se guardan como números
  reales**, así que se pueden sumar y usar en tablas dinámicas.
- **CSV** — Volcado plano, útil para archivos muy grandes o para cargar en otra herramienta.

**Restricción por rol.** Los usuarios de Admisiones reciben siempre la versión sin
valores monetarios. La restricción se aplica al generar el archivo, no solo en pantalla,
y también sustituye las gráficas por su tabla equivalente (una gráfica de facturación
lleva las cifras dibujadas dentro de la imagen).

**Detalle de atenciones.** En Reportes hay además un botón **Detalle**, que descarga una
fila por atención del período filtrado: fecha, paciente, documento, entidad, profesional,
servicio y valor. Es la base para armar análisis propios en Excel. Máximo 5.000
atenciones por descarga; si el período tiene más, el archivo lo indica y hay que acotar
el rango.

---

## 5. Pacientes

Acceso: módulo `pacientes`. Responde cuántas **personas distintas** se atienden, cuántas
son nuevas y con qué frecuencia regresan. Es analítica de utilización, no de población.

### 5.1 Antes de leer cualquier cifra: la barra de cobertura

En la parte superior aparece siempre qué porcentaje de los registros del período trae
identificación del paciente. **Todas las cifras de la página se calculan únicamente sobre
esos registros.** Si indica 62 %, el resto de la pantalla describe el 62 % de la
operación, no el total.

El enlace **Ver por fuente** desglosa la cobertura por cada origen de datos. Una fuente
al 0 % es una hoja de cálculo cuya cabecera no tiene columna de paciente: eso se corrige
en el archivo de origen, no en el sistema.

### 5.2 Indicadores

| Indicador | Significado |
|---|---|
| Pacientes únicos | Personas distintas atendidas en el período. |
| Nuevos | Sin ningún registro anterior **en los datos disponibles**. Alguien atendido hace años, si ese período no está cargado, cuenta como nuevo. La fecha desde la que hay historia se indica bajo los indicadores. |
| Recurrentes | Ya tenían registros previos. |
| Visitas por paciente | Una visita es una fecha distinta. Un EMG y un VCN el mismo día son dos atenciones pero una sola visita; por eso se muestran los dos promedios. |

### 5.3 Gráficas

- **Distribución de frecuencia** — Cuántos pacientes vinieron 1 vez, 2–3, 4–6 o 7 o más.
- **Retención mes a mes** — Qué porcentaje de los pacientes de cada mes regresa al mes
  siguiente. Los dos últimos meses aparecen vacíos a propósito: su mes siguiente todavía
  no ha terminado y puntuarlos daría una caída ficticia.

### 5.4 Por pagador y por servicio

> **Estas cifras no suman el total de pacientes únicos.** Un paciente atendido por dos
> pagadores (o con dos servicios) se cuenta en ambas filas. Por eso se presentan como
> tabla y nunca como gráfico de torta. La página informa además cuántos pacientes se
> atendieron con más de un pagador.

### 5.5 Qué no incluye

El sistema **no almacena edad, sexo, ciudad ni régimen** del paciente: la fuente de datos
solo aporta nombre y documento. Para segmentar por esos criterios habría que agregar
primero esas columnas en el archivo de origen.

---

## 6. Honorarios

Acceso: módulo `honorarios` (incluye usuarios de Recursos Humanos asignados a este módulo). Gestiona las liquidaciones de honorarios de los profesionales de la clínica.

### 6.1 Flujo de trabajo — Generar → Aprobar → Pagar

En la parte superior de la página se muestra un indicador visual de los tres pasos del proceso:

| Paso | Descripción | Quién puede ejecutarlo |
|---|---|---|
| **1. Generar** | Calcula los honorarios del período | Todos con acceso a Honorarios |
| **2. Aprobar** | Revisa y aprueba el cálculo | Solo usuarios con módulo `aprobar` (Gerencia / Dirección) |
| **3. Pagar** | Registra el pago efectivo | Solo usuarios con módulo `aprobar` |

> Si el usuario no tiene permiso para aprobar, el botón "Aprobar" no aparece. En su lugar se muestra la etiqueta **"Pendiente aprobación"** para que sea visible el estado sin generar confusión.

### 6.2 Selección del período

- **Mes completo** (predeterminado) — navegar con flechas izquierda/derecha entre meses. No es posible ir a meses futuros.
- **Período parcial** — hacer clic en *"Período parcial"* para ingresar fechas exactas de inicio y fin. Ideal para liquidar una fracción de mes.

### 6.3 Estados de una liquidación

| Estado | Color | Significado |
|---|---|---|
| Calculado | Azul claro | Generado automáticamente. Pendiente de revisión y aprobación. |
| Aprobado | Ámbar | Revisado y aprobado. Pendiente de pago. |
| Pagado | Verde | Pago registrado. Liquidación bloqueada. |

### 6.4 Generar liquidaciones

1. Seleccionar el período y hacer clic en **"Generar liquidaciones"**. El sistema calculará los honorarios de cada profesional según las reglas configuradas. Las liquidaciones aparecen en estado *Calculado*.

2. Si ya existen liquidaciones y se hace clic en **"Recalcular"**, solo se actualizan las que están en estado *Calculado*. Las *Aprobadas* y *Pagadas* quedan protegidas y no se modifican.

### 6.5 Flujo completo de aprobación y pago

1. **Calculado** → revisar el desglose expandiendo la fila del profesional.
2. **Aprobar** → hacer clic en *"Aprobar"* (disponible solo para usuarios con módulo `aprobar`). La liquidación pasa a *Aprobado*.
3. **Pagar** → hacer clic en *"Pagar"*, ingresar notas opcionales (número de transferencia, banco, etc.) y confirmar. La liquidación pasa a *Pagado*.
4. **Revertir** → si se detecta un error después de aprobar, hacer clic en *"Revertir"*, ingresar la razón y confirmar. Vuelve a *Calculado*.
5. **PDF** → desde estado *Pagado* se puede generar el comprobante de la liquidación en PDF.

### 6.6 Ajuste rápido de Ondas de Choque

Las sesiones de **Terapia Ondas de Choque** no siempre se pueden pagar en el mismo mes en que se realizan. Para ajustar cuántas se incluyen en la liquidación:

1. Expandir la fila del profesional (clic en el ícono de flecha abajo).
2. En la fila **"Ondas de Choque"** del detalle, hacer clic en el **ícono de lápiz (✏)**.
3. En el modal que aparece, ingresar cuántas sesiones se pagarán **este mes** (de las X registradas).
4. El sistema calculará automáticamente el ajuste negativo para las sesiones aplazadas y lo creará con la justificación correspondiente.

> Este ajuste queda en estado **Pendiente** y requiere autorización de un usuario con módulo `aprobar`, igual que todos los ajustes manuales.

### 6.7 Selección masiva

Marcar la casilla al inicio de varias filas para aprobar o registrar pago de múltiples liquidaciones al mismo tiempo con los botones de la barra de selección masiva.

### 6.8 Ajustes manuales

Los ajustes son bonificaciones, descuentos o correcciones que se suman al valor calculado. Se agregan dentro del detalle expandido de cada liquidación.

**Campos del formulario de ajuste:**

| Campo | Obligatorio | Descripción |
|---|---|---|
| Categoría | Sí | Tipo de servicio al que se asocia el ajuste |
| Descripción | Sí | Nombre o concepto del ajuste |
| Cantidad | Sí | Número de unidades (puede ser negativo para descuentos) |
| Valor unitario | Sí | Precio unitario en COP |
| Total | Auto | Se calcula automáticamente |
| Justificación | Sí | Razón del ajuste (mínimo 10 caracteres) |
| Referencia / N° acta | No | Número de acta o referencia interna |

> Todo ajuste requiere autorización de un usuario **DIFERENTE** al que lo creó, con módulo `aprobar`. Hasta que no sea autorizado queda como *"Pendiente"* y **no afecta el total** de la liquidación.

**Estados de un ajuste:**

| Estado | Descripción |
|---|---|
| Pendiente auth. | Creado, esperando autorización de un tercero |
| Autorizado | Aprobado. Se suma al total de la liquidación. |
| Rechazado | No aprobado. Muestra el motivo. No afecta el total. |

### 6.9 Facturación generada por médico

Al final de la página de Honorarios hay un panel colapsable **"Facturación generada por médico"**. Hacer clic en el título para expandirlo.

Este panel muestra, para cada profesional en el período seleccionado:

| Columna | Descripción |
|---|---|
| Médico | Nombre del profesional |
| Facturado EPS/ARL | Total facturado a entidades (EPS, ARL, convenios) |
| Facturado Particular | Total facturado a pacientes particulares |
| Total Facturado | Suma de ambas columnas (lo que el médico generó para la clínica) |
| Honorarios a pagar | Monto de la liquidación del período |
| Margen clínica | Diferencia entre lo facturado y los honorarios, con porcentaje |

> El **Margen clínica** muestra en verde cuando es positivo (la clínica retiene valor) y en rojo si es negativo. Permite evaluar la rentabilidad real de cada profesional en el período.

---

## 7. Capacidad

Acceso: módulo `capacidad`. Compara la demanda real de atenciones con la capacidad instalada de cada grupo de servicio. Permite detectar cuellos de botella, servicios subutilizados y oportunidades de crecimiento.

### 7.1 Indicadores de resumen

- **Total sesiones** — número total de sesiones únicas registradas en todos los servicios del período.
- **Capacidad total** — suma de la capacidad instalada configurada para todos los grupos.
- **Ocupación global** — porcentaje promedio de utilización de los servicios con capacidad configurada.

### 7.2 Grupos de servicio monitoreados

| # | Grupo | Descripción |
|---|---|---|
| 1 | EMG / VCN | Electromiografía y Velocidades de Conducción Nerviosa |
| 2 | Electroencefalograma (EEG) | Registro eléctrico de la actividad cerebral |
| 3 | Videotelemetría (TLM) | Monitoreo EEG prolongado con video |
| 4 | Polisomnografía / LMS | Estudio del sueño nocturno |
| 5 | Potenciales Evocados | Evaluación de vías sensoriales y motoras |
| 6 | Consulta Medicina Física | Consultas de fisiatría y rehabilitación |
| 7 | Consulta Neurología | Consultas neurológicas adultos |
| 8 | Consulta Neurología Pediátrica | Consultas neurológicas pediátricas |
| 9 | Infiltración / Toxina Botulínica | Procedimientos de infiltración |
| 10 | Junta de Profesionales | Juntas interdisciplinarias |
| 11 | Terapia Ondas de Choque | Procedimientos de ondas de choque extracorpóreas |
| 12 | Ecografía como Guía | Ecografía de apoyo a procedimientos |

### 7.3 Niveles de ocupación

| Estado | Rango | Interpretación |
|---|---|---|
| Sin datos | Sin cap. configurada | No se puede calcular. Configurar en Configuración → Administración → Capacidad Instalada. |
| Baja ocupación | Menos del 30% | Servicio muy subutilizado. Revisar demanda o ampliar oferta. |
| Moderada | 30% a 59% | Ocupación media. Espacio de crecimiento importante. |
| Óptima | 60% a 89% | Rango ideal de utilización. |
| Máxima capacidad | 90% o más | Cerca del límite. Riesgo de listas de espera. |

---

## 8. Auditoría

Acceso: módulo `auditoria`. Registro completo e inmutable de todas las acciones realizadas en el sistema. Este módulo es de solo lectura: ningún usuario puede modificar ni eliminar registros del log.

### 8.1 Filtros disponibles

- **Tipo de acción** — menú con todas las categorías (inicio de sesión, cambio de contraseña, usuarios, ajustes, liquidaciones, conectores, sincronización, datos eliminados).
- **Rango de fechas** — campos "Desde" y "Hasta" para acotar el período de búsqueda.
- **Botón Buscar** — aplica los filtros. **Botón Limpiar** — elimina todos los filtros.

### 8.2 Columnas de la tabla

| Columna | Descripción |
|---|---|
| Fecha / hora | Marca de tiempo exacta del evento (DD/MM/AAAA HH:MM:SS) |
| Usuario | Nombre, correo e iniciales. Muestra "Sistema" para acciones automáticas. |
| Acción | Tipo de acción con badge de color para identificación rápida |
| Entidad | Tipo de objeto afectado y primeros caracteres de su ID interno |
| Detalle | Información adicional del evento (máximo 3 campos clave) |
| IP | Dirección IP desde donde se realizó la acción |

### 8.3 Colores de los badges de acción

| Color | Tipos de acción |
|---|---|
| Azul | Inicio de sesión exitoso, liquidación generada, sincronización iniciada |
| Rojo | Inicio fallido, liquidación revertida, datos eliminados, usuarios/conectores eliminados |
| Gris | Cierre de sesión |
| Amarillo | Cambio o restablecimiento de contraseña, ajuste creado |
| Verde | Liquidación aprobada o pagada, ajuste autorizado |
| Morado | Usuario creado o actualizado |

El log muestra 50 registros por página. Navegar con los botones **Anterior** y **Siguiente**. El contador en la parte superior derecha muestra el total de registros que coinciden con los filtros.

---

# Parte III — Administración del sistema

> Esta sección está dirigida exclusivamente a usuarios con módulo `configuracion`.

**Ruta de acceso:** el menú lateral muestra la opción **Configuración**, que abre un panel con navegación lateral organizada en cuatro secciones: **Datos**, **Calidad**, **Administración** y **Sistema**.

---

## 9. Sección Datos

### 9.1 Entidades

Catálogo de entidades pagadoras reconocidas por el sistema. Aquí se puede clasificar cada entidad como EPS, ARL, Convenio, Particular u Otro, y marcar si pertenece a un grupo de caja.

### 9.2 Profesionales

Catálogo de los profesionales de la clínica con sus especialidades. Esta lista se usa en la generación de honorarios y en los reportes.

### 9.3 Servicios

Catálogo de procedimientos y servicios con su correspondencia a los grupos de capacidad instalada y al tipo de conteo (por unidad o por sesión).

### 9.4 Presupuestos

Define la meta de facturación mensual para cada mes del año. Es el denominador del porcentaje de cumplimiento en Dashboard y Reportes.

1. Seleccionar el año en el desplegable.
2. Para cada mes, hacer clic en el campo **Presupuesto (COP)** e ingresar el valor.
3. Los cambios se guardan automáticamente al salir del campo (Tab, Enter o clic en otro lugar).

Un ícono verde confirma el guardado. La fila inferior muestra el total anual calculado.

---

## 10. Sección Calidad

### 10.1 Diagnóstico

Muestra el estado de salud de la conexión a la base de datos, el volumen de atenciones por mes y año, y las últimas sincronizaciones realizadas por cada conector. Útil para verificar que los datos estén llegando correctamente desde las fuentes externas.

### 10.2 Sin Entidad

Lista las atenciones que llegaron de la fuente externa sin una entidad pagadora reconocida. Si hay registros pendientes, aparece un ícono rojo de alerta en el menú lateral. Resolver estos registros garantiza que la facturación esté completa en los reportes.

---

## 11. Sección Administración

### 11.1 Gestión de Usuarios

Permite crear, editar, desactivar y gestionar los accesos al sistema con base en módulos.

#### Crear un nuevo usuario

Hacer clic en **"Nuevo usuario"** y completar:

| Campo | Obligatorio | Descripción |
|---|---|---|
| Nombre completo | Sí | Nombre y apellidos |
| Correo electrónico | Sí | Correo con el que iniciará sesión |
| Módulos de acceso | Sí | Casillas de verificación por módulo (ver abajo) |
| Contraseña inicial | Sí | Mínimo 8 caracteres |
| Confirmar contraseña | Sí | Debe coincidir con la contraseña |

**Módulos disponibles:**

| Módulo | Qué habilita |
|---|---|
| `dashboard` | Página principal con KPIs (siempre activo) |
| `reportes` | Módulo de Reportes con filtros avanzados |
| `honorarios` | Liquidación y honorarios de profesionales |
| `capacidad` | Módulo de Capacidad Instalada |
| `auditoria` | Log de auditoría del sistema |
| `configuracion` | Acceso completo a toda la sección de Configuración |
| `aprobar` | Puede aprobar y pagar liquidaciones de honorarios |

> El sistema asigna automáticamente un rol interno basado en los módulos seleccionados. No es necesario elegir un rol manualmente.

El usuario puede iniciar sesión de inmediato. Notificarle para que cambie su contraseña en el primer ingreso.

#### Editar usuario

Clic en el ícono de lápiz. Se pueden modificar nombre, correo, módulos y estado activo/inactivo. No es posible modificar los propios módulos ni desactivar la propia cuenta.

#### Restablecer contraseña

Clic en el ícono de llave en la fila del usuario. Ingresar la nueva contraseña y confirmarla. El sistema cerrará automáticamente la sesión activa del usuario.

#### Eliminar usuario

Clic en el ícono de papelera rojo. La eliminación desactiva el acceso pero no borra historial ni registros. Es reversible: editar el usuario y activar *"Usuario activo"*.

### 11.2 Reglas de Honorarios

Panel de configuración de las reglas de liquidación por profesional. Muestra una matriz de 9 profesionales × 10 categorías de servicio.

**Para editar una regla:**

1. Hacer clic en la celda del profesional y la categoría correspondiente.
2. Seleccionar el tipo de regla:
   - **Fijo (COP)** — valor fijo por sesión o unidad, diferenciado entre entidad y particular.
   - **Porcentaje (%)** — fracción del valor facturado bruto, diferenciada entre entidad y particular.
3. Ingresar los valores y una nota opcional.
4. Hacer clic en **Guardar**.

Los cambios aplican inmediatamente en la siguiente generación de liquidaciones. Las liquidaciones ya aprobadas o pagadas no se ven afectadas.

**Reglas especiales** (tabla inferior): configuraciones específicas como tarifas reducidas para ciertas entidades, diferenciación entre PSG y Latencia Múltiple, o excepciones por convenio particular.

### 11.3 Capacidad Instalada

Define la capacidad mensual (en sesiones) de cada grupo de servicio para un año. Los valores aquí configurados son los denominadores del módulo de Capacidad.

#### Configurar un grupo

1. Seleccionar el año en el desplegable.
2. Hacer clic en **Editar** en la fila del grupo.
3. Ingresar la capacidad mensual (número de sesiones, entre 0 y 32.767).
4. Opcionalmente ingresar la descripción de recursos (equipos, turnos, horas).
5. Hacer clic en **Guardar**.

#### Guardar configuración completa

El botón **"Guardar configuración completa"** aplica todos los valores a los 12 meses del año seleccionado en una sola operación. Ideal cuando la capacidad no cambia mes a mes.

Si se requieren valores diferentes por mes, editar cada fila individualmente y guardar por separado.

---

## 12. Sección Sistema — Fuentes de datos

> Esta sección está al final del menú de Configuración con un color diferenciado (gris/rojo) para indicar que su uso modifica el origen de los datos del sistema. Proceder con cuidado.

Los conectores son las conexiones a las fuentes externas de facturación. Cada conector sincroniza atenciones, servicios y entidades desde el sistema externo hacia la base de datos de Neurofic.

### 12.1 Tarjeta de cada conector

Cada conector muestra:

- **Nombre y tipo** del conector (Google Sheets, REST API, PostgreSQL, CSV).
- **Última sincronización** — fecha y hora exacta en zona horaria Colombia (COT). Se actualiza automáticamente cada minuto sin necesidad de recargar la página.
- **Estado** — activo/inactivo.
- **Frecuencia de sincronización** — cada 30 min, 1h, 4h, diaria o manual.

### 12.2 Sincronización

- **Sincronización automática**: el sistema sincroniza en el intervalo configurado sin intervención manual. Las sincronizaciones automáticas se realizan en zona horaria Colombia (UTC-5).
- **Sincronización manual**: hacer clic en el botón **"Sincronizar"** de la tarjeta para iniciar una sincronización inmediata. El proceso corre en segundo plano; el estado cambia a *"En proceso"* y luego a *"Completada"* o *"Fallida"*.

> El botón de actualizar (↺) en la parte superior de Reportes **recalcula los indicadores desde los datos ya almacenados** en la base de datos local. **No** dispara una nueva sincronización desde la fuente externa. Para obtener los datos más recientes de la fuente, usar el botón *"Sincronizar"* en esta sección.

### 12.3 Historial de sincronizaciones

Hacer clic en el ícono de historial de cada conector para ver el registro de las últimas sincronizaciones con: hora de inicio, hora de fin, filas leídas, filas nuevas y errores encontrados.

### 12.4 Diagnóstico de columnas

Opción disponible en cada conector para verificar el mapeo de columnas y detectar atenciones sin valor o sin entidad reconocida.

---

# Parte IV — Tabla de permisos por módulo

La siguiente tabla muestra las funciones del sistema y los módulos que habilitan cada una.

| Función | `dashboard` | `reportes` | `honorarios` | `capacidad` | `auditoria` | `configuracion` | `aprobar` |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard y KPIs del mes | ✓ | | | | | ✓ | |
| Reportes — todos los períodos | | ✓ | | | | ✓ | |
| Honorarios — ver y generar | | | ✓ | | | ✓ | |
| Honorarios — aprobar y pagar | | | | | | ✓ | ✓ |
| Ajustes manuales — crear | | | ✓ | | | ✓ | ✓ |
| Ajustes manuales — autorizar | | | | | | ✓ | ✓ |
| Ajuste rápido Ondas de Choque | | | ✓ | | | ✓ | ✓ |
| Facturación generada por médico | | | ✓ | | | ✓ | ✓ |
| Capacidad instalada — ver | | | | ✓ | | ✓ | |
| Auditoría del sistema | | | | | ✓ | ✓ | |
| Gestión de usuarios | | | | | | ✓ | |
| Reglas de honorarios | | | | | | ✓ | |
| Capacidad instalada — configurar | | | | | | ✓ | |
| Fuentes de datos | | | | | | ✓ | |

> **Nota**: un usuario puede tener varios módulos activos simultáneamente. El módulo `configuracion` otorga acceso a todas las funciones del sistema.

---

# Parte V — Preguntas frecuentes

**¿Qué hago si no puedo iniciar sesión?**
Verificar que el correo sea exactamente el asignado (sin espacios). Si el problema persiste, contactar al administrador a soporte@neurofic.com para que restablezca la contraseña desde Configuración → Usuarios.

**¿Con qué frecuencia se actualizan los datos?**
Los datos se sincronizan automáticamente desde la fuente externa según la frecuencia configurada en cada conector (cada 30 min, 1h, 4h o diaria). La hora de la última sincronización aparece en cada tarjeta de conector y se actualiza cada minuto. Para refrescar manualmente, usar el botón *"Sincronizar"* en Configuración → Sistema.

**¿Por qué no veo algunas secciones del menú?**
Cada usuario tiene acceso solo a los módulos que le asignó el administrador. Si se necesita acceso adicional, el administrador puede editar los módulos del usuario desde Configuración → Usuarios.

**¿Cómo sé si puedo aprobar una liquidación?**
En la página de Honorarios, si tienes el módulo `aprobar`, verás el botón verde **"Aprobar"** junto a cada liquidación en estado *Calculado*. Si no tienes ese módulo, verás la etiqueta gris *"Pendiente aprobación"*. Solicitar a Gerencia o Dirección que realice la aprobación.

**¿Qué significa una liquidación en estado "Calculado"?**
El sistema generó el valor automáticamente pero aún no fue revisado ni aprobado. No representa un pago definitivo hasta pasar a *Aprobado* y luego a *Pagado*.

**¿Puedo modificar una liquidación ya pagada?**
No. Las liquidaciones *Pagadas* están bloqueadas. Si se necesita corrección, contactar al administrador.

**¿Por qué algunas sesiones de Ondas de Choque no se pueden pagar este mes?**
Es normal que un paciente realice ciclos de ondas de choque que se cobran en un mes pero se deben pagar en varios períodos. Usar el **ajuste rápido** (ícono lápiz en la fila Ondas de Choque del detalle) para indicar cuántas sesiones pagar este mes. El sistema crea el ajuste de aplazamiento automáticamente.

**¿Por qué un ajuste no se suma al total?**
Los ajustes requieren autorización de un usuario diferente al creador, con módulo `aprobar`. Mientras esté en estado *Pendiente* no afecta el total.

**¿Qué ocurre con el historial si se elimina un usuario?**
El usuario queda inactivo y no puede iniciar sesión, pero su historial queda registrado en Auditoría y en las liquidaciones en que participó. Sus datos no se borran.

**¿Se puede exportar la información?**
Sí. Dashboard, Reportes, Pacientes, Honorarios, Capacidad y Auditoría tienen un botón
**Exportar** que genera PDF, Excel o CSV. El diálogo permite marcar qué secciones y
columnas incluir, e incluye el preset **Vista médicos (sin valores)** para entregar solo
cantidades. En Reportes, el botón **Detalle** descarga una fila por atención del período
filtrado.

**¿Qué significa el porcentaje de ocupación en Capacidad?**
Es la relación entre las sesiones únicas realizadas en un grupo y la capacidad mensual configurada. Ejemplo: EMG/VCN con capacidad 1.440 y 900 sesiones = 62.5% (Óptima).

**¿Cómo se configura la meta de facturación?**
El administrador define el presupuesto mensual en Configuración → Datos → Presupuestos. Ese valor es la meta usada para calcular el faltante en Dashboard y Reportes.

**¿Qué diferencia hay entre rol y módulos?**
En versiones anteriores del sistema se asignaba un *rol* a cada usuario (Gerencia, Facturación, etc.). Ahora el sistema es **modular**: en lugar de un rol fijo, el administrador asigna individualmente los módulos a los que cada persona puede acceder. Esto permite configuraciones más precisas y flexibles.

---

# Parte VI — Configuración técnica del proyecto

> Esta sección está dirigida al equipo de dirección y tecnología. Describe la arquitectura, las decisiones de ingeniería y el trabajo técnico que sostiene la plataforma.

## 13. Arquitectura general

El Neurofic Admin Dashboard es una aplicación web de arquitectura moderna compuesta por tres capas:

| Capa | Tecnología | Función |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite 5 | Interfaz de usuario. Single Page Application. |
| Backend / API | Fastify 4 + Node.js 20 + TypeScript | Servidor REST. Lógica de negocio y seguridad. |
| Base de datos | MySQL 8 (Hostinger) + mysql2 | Persistencia de todos los datos del sistema. |
| Proceso | PM2 (gestor de procesos) | Reinicio automático ante caídas. Producción. |
| Dominio | dashboard.neurofic.com | Subdominio activo. Alojado en Hostinger. |

### 13.1 Frontend

Construido como SPA (Single Page Application): la navegación entre páginas no recarga la página completa. Características clave:

- **Permisos modulares**: cada ruta verifica en tiempo real que el usuario tenga el módulo necesario. Si no, redirige automáticamente al Dashboard.
- **Caché inteligente con React Query**: los datos consultados se almacenan en memoria para evitar llamadas repetidas. Los conectores se refrescan automáticamente cada 60 segundos.
- **Gráficos interactivos con Recharts**: clic en barras y segmentos de torta aplica filtros en cascada sobre todos los indicadores.
- **Diseño responsive**: funciona en escritorio, tablet y móvil.

### 13.2 Backend (API REST)

El servidor expone una API REST. Responsabilidades:

- Autenticación y verificación de módulos en cada solicitud.
- Cálculo automático de honorarios según reglas de liquidación cargadas desde base de datos.
- Endpoint de contribución por médico (`GET /api/honorarios/contribucion`): agrega facturación por profesional diferenciando EPS/ARL vs Particular.
- Consultas SQL optimizadas para reportes con múltiples dimensiones de filtro.
- Registro automático de auditoría en toda acción significativa.
- Auto-seed de datos de referencia al arrancar.
- Migraciones de esquema de base de datos automáticas y versionadas (actualmente 11 migraciones).

### 13.3 Arranque resiliente

El servidor inicia y acepta solicitudes HTTP en menos de 2 segundos, antes de conectarse a la base de datos. La conexión se realiza en paralelo con reintentos exponenciales (2s, 4s, 8s… hasta 30s máximo).

---

## 14. Seguridad implementada

### 14.1 Autenticación con JWT de doble token

| Token | Duración | Propósito |
|---|---|---|
| Access Token | Corta (15 min) | Autoriza cada solicitud al API. |
| Refresh Token | Larga | Renueva el Access Token sin re-login. |

### 14.2 Control de acceso basado en módulos

Cada endpoint del API verifica: (1) que el token sea válido y vigente, y (2) que el rol derivado del usuario tenga permiso para ejecutar esa operación. La verificación ocurre en el servidor — nadie puede saltarse la seguridad accediendo directamente al API.

### 14.3 Otras protecciones

| Protección | Descripción |
|---|---|
| Bcrypt | Las contraseñas se almacenan con hash bcrypt. |
| Helmet | Cabeceras HTTP de seguridad contra XSS, clickjacking y MIME sniffing. |
| CORS | Solo los orígenes autorizados pueden hacer solicitudes al API. |
| Rate Limiting | Límite de solicitudes por IP para prevenir fuerza bruta. |
| Token Revoke | Al restablecer contraseña, todos los Refresh Tokens activos del usuario quedan invalidados. |

---

## 15. Estructura de la base de datos

El esquema se gestiona con migraciones versionadas, aplicadas automáticamente al arrancar el servidor.

| Tabla | Descripción |
|---|---|
| `usuarios` | Cuentas de acceso, roles derivados y módulos asignados (columna `modulos` JSON) |
| `refresh_tokens` | Tokens de sesión activos para renovación de JWT |
| `atenciones` | Registros de atenciones importados desde fuentes externas |
| `entidades` | Catálogo de entidades pagadoras |
| `servicios` | Catálogo de procedimientos y servicios |
| `liquidaciones` | Liquidaciones de honorarios generadas por período |
| `ajustes` | Ajustes manuales asociados a liquidaciones |
| `reglas_honorarios` | Reglas de liquidación por profesional y categoría (fijo o porcentual) |
| `reglas_especiales_honorarios` | Reglas especiales: tarifas reducidas, excepciones por entidad, etc. |
| `capacidad_instalada` | Capacidad mensual configurada por grupo de servicio |
| `presupuestos` | Metas de facturación por mes y año |
| `audit_logs` | Registro inmutable de todas las acciones del sistema |

---

## 16. Despliegue y operación en producción

### 16.1 Infraestructura

El sistema está alojado en Hostinger. El proceso lo gestiona Passenger, que lo levanta bajo demanda y lo reinicia automáticamente ante cualquier caída; el despliegue lo reinicia tocando `tmp/restart.txt`.

**URL de acceso:** https://dashboard.neurofic.com

### 16.2 Variables de entorno en producción

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión a MySQL con credenciales |
| `JWT_SECRET` | Clave secreta para firmar y verificar los tokens JWT |
| `JWT_EXPIRES_IN` | Tiempo de vida del access token (ejemplo: 15m) |
| `CORS_ORIGIN` | Dominio del frontend autorizado a hacer solicitudes |
| `PORT` | Puerto HTTP del servidor |
| `NODE_ENV` | Entorno de ejecución (production / development) |

Ninguna variable de entorno está en el código fuente ni en el repositorio de git.

### 16.3 Registro de auditoría técnica

El sistema registra automáticamente toda acción significativa con: ID único, usuario, tipo de acción (más de 20 tipos catalogados), entidad afectada, detalle JSON del evento, dirección IP y marca de tiempo. El registro usa un patrón "disparo y olvido": si falla por error técnico, la operación principal del usuario no se interrumpe.

---

*Neurofic Admin Dashboard — Sistema de Gestión Administrativa Interna*
*Documento confidencial de uso interno · No distribuir fuera del equipo de Neurofic · Junio 2026 · v2.2*
