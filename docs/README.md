# Documentación — Neurofic Admin Dashboard

Índice de la documentación del proyecto.
**Al agregar una funcionalidad, actualizar el documento que le corresponda y anotarla en
el [CHANGELOG](../CHANGELOG.md).**

---

## Para usar el sistema

**La documentación de usuario vive dentro de la aplicación**, en
`frontend/src/help/content/*.md`. Los usuarios la leen con el botón **?** del encabezado
de cada pantalla; los PDF se generan a partir de esos mismos artículos.

| Documento | Contenido |
|---|---|
| `frontend/src/help/content/*.md` | **La fuente.** Un artículo por tema. Editar aquí. |
| [MANUAL_USUARIO.md](MANUAL_USUARIO.md) | Puntero: explica dónde se movió el contenido. |
| [Manual_Neurofic_Dashboard_v2_2.md](Manual_Neurofic_Dashboard_v2_2.md) | Puntero. |

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
| [AYUDA-EN-APP.md](AYUDA-EN-APP.md) | Centro de ayuda contextual: cómo escribir un artículo y cómo funciona el buscador. |

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

## Generar los manuales en PDF

```bash
pip install markdown                            # una sola vez
python3 scripts/md-a-pdf.py --manual breve      # manual de usuario
python3 scripts/md-a-pdf.py --manual completo   # con el detalle ampliado
python3 scripts/md-a-pdf.py --todos             # la documentación técnica
```

Los manuales se **componen a partir de los artículos de ayuda**, así que no pueden
contradecir a la aplicación. Los dos niveles salen del mismo texto: los bloques
`<details>` son el detalle a fondo, que el breve omite y el completo expande.

Salen en `docs/pdf/` con portada, índice navegable y numeración de páginas. La carpeta
está en `.gitignore`: **se regeneran**, no se versionan, para que nadie se lleve uno
desactualizado del repositorio.

Requiere las dependencias de `frontend/` instaladas (el renderizado usa el Chromium de
Playwright).

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
| Una pantalla | El artículo correspondiente en `frontend/src/help/content/` |
| La exportación | `EXPORTACION.md` y el artículo `90-exportacion.md` |
| La ayuda en sí | `AYUDA-EN-APP.md` |
| El despliegue o el entorno | `DEPLOY.md`, `ENV.md` |
| Cualquier cosa | `CHANGELOG.md` |
