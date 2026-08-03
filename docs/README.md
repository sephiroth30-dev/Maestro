# Documentación — Neurofic Admin Dashboard

Índice de la documentación del proyecto.
**Al agregar una funcionalidad, actualizar el documento que le corresponda y anotarla en
el [CHANGELOG](../CHANGELOG.md).**

---

## Para usar el sistema

| Documento | Contenido |
|---|---|
| [MANUAL_USUARIO.md](MANUAL_USUARIO.md) | Manual breve, por secciones. Punto de partida para un usuario nuevo. |
| [Manual_Neurofic_Dashboard_v2_2.md](Manual_Neurofic_Dashboard_v2_2.md) | Manual extenso: cada módulo en detalle, permisos por rol, preguntas frecuentes. |

## Para desarrollar

| Documento | Contenido |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Estructura del proyecto y decisiones de diseño. |
| [MODELO-DATOS.md](MODELO-DATOS.md) | Tablas, qué **no** se guarda, y las particularidades que cambian cómo se consulta. |
| [API-REFERENCE.md](API-REFERENCE.md) | Los 67 endpoints con su rol. Índice general. |
| [API-AUTH.md](API-AUTH.md) | Autenticación en detalle: cuerpos, respuestas, flujo de refresh. |
| [API-REPORTES.md](API-REPORTES.md) | Contratos de los endpoints de reportes. |
| [CONNECTORS.md](CONNECTORS.md) | Capa de conectores e importación desde hojas de cálculo. |
| [EXPORTACION.md](EXPORTACION.md) | Sistema de exportación a PDF, Excel y CSV, y cómo añadirlo a una página. |

## Para operar

| Documento | Contenido |
|---|---|
| [DEPLOY.md](DEPLOY.md) | Cómo se despliega, cómo reiniciar, cómo verificar y qué mirar cuando algo falla. |
| [ENV.md](ENV.md) | Variables de entorno. |

## Comunicación

| Documento | Contenido |
|---|---|
| [CORREO_v1.8_EXPORTACION_Y_PACIENTES.md](CORREO_v1.8_EXPORTACION_Y_PACIENTES.md) | Socialización de la exportación y la analítica de pacientes (v1.8). |
| [Correo_Socializacion_v2_2.md](Correo_Socializacion_v2_2.md) | Socialización de la versión 2.2 del manual. |
| [CORREOS_SOCIALIZACIÓN.md](CORREOS_SOCIALIZACIÓN.md) | Borradores por rol de la puesta en marcha inicial. |

---

## Tres cosas que conviene saber antes de tocar nada

**1. `backend/dist` está versionado.** Hostinger no compila. Todo cambio en
`backend/src` exige `npm run build --prefix backend` y commitear el resultado; si no, el
servidor sigue con la versión anterior **sin que nada falle a la vista**.
→ [DEPLOY.md](DEPLOY.md)

**2. Un import sin usar rompe el build del frontend.** `tsc` corre con
`noUnusedLocals` y el comando es `tsc && vite build`: si `tsc` falla, no se genera ningún
paquete y la aplicación queda en blanco.

**3. No hay datos demográficos de paciente.** Ni edad, ni sexo, ni ciudad. Solo nombre y
documento, ambos opcionales. Antes de prometer un reporte que los use, leer
[MODELO-DATOS.md](MODELO-DATOS.md).

---

## Al agregar una funcionalidad

| Si tocaste… | Actualizar |
|---|---|
| Un endpoint | `API-REFERENCE.md` y, si es de reportes, `API-REPORTES.md` |
| Una tabla o columna | `MODELO-DATOS.md` |
| Una pantalla | `MANUAL_USUARIO.md` y `Manual_Neurofic_Dashboard_v2_2.md` |
| La exportación | `EXPORTACION.md` |
| El despliegue o el entorno | `DEPLOY.md`, `ENV.md` |
| Cualquier cosa | `CHANGELOG.md` |
