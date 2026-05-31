# Manual de Usuario — Neurofic Admin Dashboard

**Versión:** 1.6  
**Fecha:** Mayo 2026  
**Soporte:** resultados@neurofic.com

---

## ¿Qué es el Dashboard de Neurofic?

Es la plataforma de administración interna de Neurofic. Centraliza en un solo lugar la información de facturación, reportes de atenciones, honorarios médicos, capacidad instalada y auditoría del sistema. Cada usuario accede únicamente a las secciones habilitadas para su rol.

---

## 1. Acceso al sistema

### Ingresar

1. Abrir el navegador y entrar a la dirección del sistema (la URL que el administrador compartió).
2. Digitar el **correo electrónico** y la **contraseña** asignados.
3. Hacer clic en **Iniciar sesión**.

> Si olvidó su contraseña, contactar al administrador del sistema para que la restablezca.

### Cambiar contraseña

En cualquier momento puede cambiar su contraseña:

1. En la parte inferior izquierda de la barra lateral, hacer clic en el ícono de **llave** (🔑).
2. Ingresar la contraseña actual y la nueva (mínimo 8 caracteres).
3. Hacer clic en **Guardar**.

### Cerrar sesión

Hacer clic en el ícono de **salir** (→) en la parte inferior de la barra lateral.

---

## 2. Navegación general

La barra lateral izquierda contiene el menú principal. Los ítems visibles dependen del rol asignado. Los ítems marcados con **"Pronto"** están en desarrollo.

| Sección | Descripción |
|---|---|
| Dashboard | Resumen de KPIs y métricas del mes |
| Reportes | Detalle de atenciones y facturación |
| Honorarios | Liquidaciones de profesionales |
| Capacidad | Ocupación de servicios vs. capacidad instalada |
| Auditoría | Registro de acciones del sistema |
| Admin | Gestión de usuarios, configuración y capacidad |

---

## 3. Dashboard

**Acceso:** Todos los roles.

El Dashboard muestra el estado del mes en curso de un vistazo:

- **Cumplimiento de meta** — porcentaje del presupuesto alcanzado.
- **Total facturado** — suma de atenciones del mes seleccionado.
- **Número de sesiones** — pacientes atendidos en el período.
- **Ticket promedio** — valor promedio por sesión.
- **Proyección** — estimación de cierre de mes basada en el ritmo actual.
- **Tendencia mensual** — gráfico de los últimos 6 meses.
- **Cumplimiento semanal** — progreso semana a semana dentro del mes.
- **Mix de pagador** — distribución por tipo de facturación (EPS, particular, póliza, etc.).
- **Facturado por día de la semana** — identifica qué días se atiende más.

### Cambiar el mes visualizado

En la esquina superior derecha del Dashboard hay un selector de mes y año. Al cambiarlo, todos los indicadores se actualizan automáticamente.

---

## 4. Reportes

**Acceso:** ADMIN, Gerencia, Dirección, Facturación, Coordinadora (todos los períodos) — Admisiones (solo mes actual).

Permite analizar las atenciones en detalle con filtros flexibles.

### Filtros disponibles

- **Rango de fechas** — presets rápidos: Hoy, Ayer, Esta semana, Semana pasada, Este mes, Mes pasado, Este año. O rango personalizado.
- **Tipo de servicio** — filtra por categoría de atención.
- **Día de la semana** — permite ver solo los datos de un día específico.
- **Entidad / pagador** — filtra por EPS, aseguradora o particular.

### Gráficos

- **Facturado por mes** — comparativo histórico.
- **Distribución por día de la semana** — identifica días pico.
- **Mix de pagador** — participación de cada entidad en la facturación.

### Tabla de detalle

Muestra cada sesión registrada con: fecha, paciente, servicio, profesional, entidad y valor. Se puede exportar.

---

## 5. Honorarios

**Acceso:** ADMIN, Gerencia, Dirección, Facturación.

Gestiona las liquidaciones de honorarios de los profesionales.

### Estados de una liquidación

| Estado | Significado |
|---|---|
| **Calculado** | Generado automáticamente, pendiente de revisión |
| **Aprobado** | Revisado y aprobado, pendiente de pago |
| **Pagado** | Desembolso realizado |

### Flujo de trabajo

1. **Generar liquidación** — seleccionar mes/año y hacer clic en "Generar". El sistema calcula los honorarios según las reglas definidas.
2. **Revisar** — expandir la fila del profesional para ver el desglose por categoría de servicio.
3. **Aprobar** — solo Gerencia y Dirección pueden aprobar (pasa de Calculado → Aprobado).
4. **Registrar pago** — registrar la fecha y observaciones del desembolso (pasa a Pagado).

### Ajustes manuales

Dentro de cada liquidación se pueden agregar **ajustes** (bonos, descuentos, correcciones):

1. Expandir la liquidación y hacer clic en **"+ Agregar ajuste"**.
2. Seleccionar la categoría, ingresar el monto (positivo = bono, negativo = descuento) y justificación.
3. Los ajustes requieren **autorización de Gerencia o Dirección** antes de sumarse al total.

> Los ajustes de una liquidación **Pagada** no pueden modificarse.

---

## 6. Capacidad

**Acceso:** ADMIN, Gerencia, Dirección, Facturación.

Muestra la ocupación real de cada servicio frente a la capacidad instalada del año 2026.

### Cómo leer la página

- Usar los selectores de **mes** y **año** para elegir el período.
- Cada tarjeta representa un grupo de servicio (EMG/VCN, EEG, Polisomnografía, etc.).
- La **barra de progreso** indica el porcentaje de ocupación.
- El **badge de estado** clasifica la ocupación:

| Badge | Rango | Significado |
|---|---|---|
| 🔵 Baja | < 30 % | Capacidad muy subutilizada |
| 🟡 Moderada | 30 – 60 % | Ocupación media |
| 🟢 Óptima | 60 – 90 % | Rango ideal |
| 🔴 Máxima | > 90 % | Cerca del límite, posible cuello de botella |
| ⚪ Sin datos | — | Sin capacidad configurada para ese período |

### KPIs del resumen superior

- **Servicios activos** — grupos con atenciones en el período.
- **Promedio de ocupación** — media de todos los grupos.
- **En óptimo** — cuántos servicios están en rango ideal.
- **En máximo** — cuántos superan el 90 % de capacidad.

---

## 7. Auditoría

**Acceso:** ADMIN, Facturación.

Registro completo de todas las acciones realizadas en el sistema: inicios de sesión, creación/modificación de usuarios, generación de liquidaciones, ajustes, cambios de configuración, etc.

### Filtros

- **Rango de fechas** — buscar eventos en un período específico.
- **Tipo de acción** — filtrar por categoría (login, liquidación, usuario, etc.).

### Cómo interpretar el log

Cada entrada muestra: fecha y hora, usuario que realizó la acción, tipo de acción y detalle adicional. El registro es de **solo lectura** y no puede modificarse.

---

## 8. Administración (solo ADMIN)

### 8.1 Gestión de usuarios

Ruta: **Admin → Usuarios**

- **Crear usuario** — ingresar nombre, correo, rol y contraseña inicial.
- **Editar** — modificar nombre, correo, rol o activar/desactivar la cuenta.
- **Restablecer contraseña** — asignar nueva contraseña (cierra la sesión activa del usuario).
- **Eliminar** — desactiva el acceso (la cuenta no se borra definitivamente).

> No puede editar su propio rol ni desactivar su propia cuenta.

### 8.2 Configuración

Ruta: **Admin → Configuración**

Parámetros generales del sistema: meta de facturación mensual, reglas de honorarios por categoría de servicio y conectores de datos.

### 8.3 Capacidad instalada

Ruta: **Admin → Cap. Instalada**

Permite ajustar la capacidad instalada de cada grupo de servicio por mes. Los cambios se reflejan inmediatamente en la página de Capacidad.

---

## 9. Permisos por rol

| Función | Admin | Gerencia | Dirección | Facturación | Coordinadora | Admisiones |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard / KPIs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Reportes (todos los períodos) | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Reportes (solo mes actual) | — | — | — | — | — | ✓ |
| Honorarios (ver / generar) | ✓ | ✓ | ✓ | ✓ | — | — |
| Honorarios (aprobar / pagar) | ✓ | ✓ | ✓ | — | — | — |
| Ajustes manuales (crear) | ✓ | ✓ | ✓ | ✓ | — | — |
| Ajustes manuales (autorizar) | ✓ | ✓ | ✓ | — | — | — |
| Capacidad instalada | ✓ | ✓ | ✓ | ✓ | — | — |
| Auditoría del sistema | ✓ | — | — | ✓ | — | — |
| Gestión de usuarios | ✓ | — | — | — | — | — |
| Configuración del sistema | ✓ | — | — | — | — | — |
| Cap. instalada (configurar) | ✓ | — | — | — | — | — |

---

## 10. Preguntas frecuentes

**¿Qué hago si no puedo iniciar sesión?**  
Verificar que el correo y la contraseña sean correctos. Si el problema persiste, contactar al administrador para restablecer la contraseña.

**¿Los datos se actualizan en tiempo real?**  
Los datos se sincronizan automáticamente desde la fuente. El Dashboard y los Reportes reflejan la información disponible al momento de cargar la página. Usar el botón de **actualizar** (↺) para refrescar manualmente.

**¿Puedo exportar los reportes?**  
Sí. En la sección de Reportes hay una opción de exportar la tabla de detalle.

**¿Qué significa que una liquidación esté en "Calculado"?**  
Que fue generada automáticamente pero aún no ha sido revisada ni aprobada. No refleja un pago definitivo.

**¿Por qué no veo algunas secciones del menú?**  
Cada rol tiene acceso solo a las secciones pertinentes a sus funciones. Si necesita acceso adicional, solicitar al administrador.

---

*Neurofic — Sistema de Gestión Administrativa Interna*
