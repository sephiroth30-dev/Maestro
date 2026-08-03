# Manual de Usuario — dónde está ahora

> **Este archivo ya no se edita.** El contenido se movió a los artículos de ayuda
> de la aplicación.

## Por qué

El manual y la aplicación se desincronizaban: llegó a declarar «Versión 1.6 · Mayo 2026»
tres versiones después de la que estaba en producción, y describía una exportación que
todavía no existía. Mantener el mismo texto en dos sitios garantiza que uno de los dos
mienta.

## Dónde está el contenido

**`frontend/src/help/content/*.md`** — un artículo por tema. Son la única fuente: de ahí
salen tanto el panel de ayuda de la aplicación como los PDF.

Los usuarios lo leen pulsando el botón **?** del encabezado de cada pantalla, que abre la
ayuda de esa sección y permite buscar en todas.

## Generar los PDF

```bash
python3 scripts/md-a-pdf.py --manual breve      # manual de usuario
python3 scripts/md-a-pdf.py --manual completo   # con el detalle ampliado
```

Salen en `docs/pdf/`, que está en `.gitignore`: se regeneran, no se versionan.

Los dos niveles vienen del mismo texto. Los bloques `<details>` de cada artículo son el
detalle a fondo: el manual breve los omite y el completo los expande.

## Para cambiar algo

Edita el artículo correspondiente en `frontend/src/help/content/` y despliega. La ayuda de
la aplicación se actualiza con el despliegue, y los PDF se regeneran con el comando de
arriba.
