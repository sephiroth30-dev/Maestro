# Centro de ayuda en la aplicación

Cómo escribir un artículo, cómo funciona el buscador y por qué está montado así.

Para el uso desde la interfaz basta con pulsar el **?** de cualquier pantalla. Este
documento es para quien mantiene el contenido o el código.

---

## La idea

Los manuales llegaron a 10 y 24 páginas y nadie los leía: cuando surge una duda usando el
sistema, abrir un PDF y buscar la sección correcta cuesta más que preguntarle a alguien.
Peor aún, se desincronizaban solos — el manual breve declaró «Versión 1.6 · Mayo 2026»
tres versiones después de la que estaba en producción.

Así que la ayuda se movió adentro, troceada, y los artículos pasaron a ser **la única
fuente**: los PDF se generan a partir de ellos y por construcción no pueden contradecir a
la aplicación.

---

## Escribir un artículo

Un archivo por tema en `frontend/src/help/content/`, nombrado `NN-id.md` para que el orden
de lectura sea evidente.

```md
---
id: honorarios
titulo: Honorarios
modulo: honorarios
orden: 60
claves: liquidacion, aprobar, pagar, nomina, ajustes
---

## Para qué sirve

Texto corto y directo. Este es el nivel que lee todo el mundo.

<details>
<summary>El detalle, para quien lo necesite</summary>

Contenido a fondo.

</details>
```

| Campo | Obligatorio | Para qué |
|---|---|---|
| `id` | Sí | Lo usa `<HelpButton articulo="...">`. No cambiarlo a la ligera. |
| `titulo` | Sí | Encabezado del panel y del manual |
| `modulo` | No | Módulo requerido. **Sin él, el artículo lo ve todo el mundo.** |
| `orden` | No | Posición en la lista y en el manual. Por defecto, 999 |
| `claves` | No | Términos que deben encontrarlo aunque no aparezcan en el texto |

### Las claves importan más de lo que parece

Son la forma de capturar cómo busca la gente de verdad, que no es como está escrito el
artículo. Nadie busca «Honorarios»: busca «liquidacion», «pagar médico», «nómina».

En el ranking pesan **por encima** de una coincidencia en el título de una sección: son
intención declarada del autor, no una casualidad del texto.

### Los `<details>` son los dos niveles a la vez

Ese bloque es el mecanismo que permite tener un solo texto y dos manuales:

| Dónde | Qué pasa con el `<details>` |
|---|---|
| Panel de la aplicación | Aparece colapsado; se abre si interesa |
| `--manual breve` | **Se elimina** |
| `--manual completo` | Se expande como una subsección normal |

Regla práctica: **fuera del desplegable, lo que necesita saber cualquiera; dentro, lo que
necesita saber quien tiene el problema concreto.**

Deja una línea en blanco después de `<summary>` y antes de `</details>`, o el Markdown de
dentro no se interpreta.

---

## Cómo se conecta a una pantalla

```tsx
import { HelpButton } from '../help/HelpButton.js';

<HelpButton articulo="reportes" />
```

Va en el encabezado, junto al título. Nada más: el panel es una única instancia montada
por `HelpProvider` en `AppLayout`, y el botón solo pide abrirlo.

Cuando una pantalla tiene pestañas con temas distintos —como Configuración— el artículo se
elige según la pestaña activa; ver el mapa `AYUDA_POR_TAB` en
`pages/Admin/Configuracion.tsx`.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `content/*.md` | Los artículos. **La fuente de verdad.** |
| `registry.ts` | `import.meta.glob` con `?raw`, parseo de metadatos, filtro por módulo |
| `buscar.ts` | Troceado por encabezados, normalización sin tildes, ranking |
| `HelpProvider.tsx` | Estado compartido; carga el panel con `React.lazy` |
| `HelpPanel.tsx` | El panel. Importa `marked` dinámicamente |
| `HelpButton.tsx` | El `?`. Ligero: no arrastra nada del panel |

`lib/permisos.ts` contiene `tieneAcceso`, la regla de módulos que ahora comparten
`App.tsx`, `Sidebar.tsx` y la ayuda. Antes estaba implementada dos veces con formas
distintas.

---

## Decisiones que conviene no deshacer sin pensarlo

**Todo se carga en diferido.** El panel, el contenido y `marked` van en chunks aparte; el
paquete principal solo crece unos 750 bytes por tener el botón en ocho páginas. Si alguien
importa `HelpPanel` de forma estática, eso se pierde sin que nada falle a la vista.

**El filtrado por módulo se aplica en el registro, no en la interfaz.** `articulosVisibles`
recorta la lista antes de construir el índice de búsqueda, así que un artículo al que no
tienes acceso no aparece ni en los resultados.

**La búsqueda ignora las tildes.** En Colombia se teclea «liquidacion» y «facturacion» sin
tilde constantemente. Sin `norm()` el buscador sería inútil para media plantilla.

**`dangerouslySetInnerHTML` es aceptable aquí, y solo aquí.** El contenido lo escribe el
equipo en el repositorio: mismo nivel de confianza que el propio código. Si algún día la
ayuda se editara desde la aplicación o desde la base de datos, esto **tendría que
sanearse**.

---

## Verificar

No hay pruebas automatizadas permanentes. Comprobación manual al tocar el sistema:

```bash
npm run dev --prefix frontend
```

1. El `?` aparece en Dashboard, Reportes, Pacientes, Honorarios, Capacidad, Auditoría y
   Configuración.
2. Al pulsarlo abre el artículo **de esa pantalla**.
3. Buscar «liquidacion» sin tilde devuelve el artículo de Honorarios primero.
4. Con un usuario sin el módulo `honorarios`, ese artículo no aparece ni en la lista ni en
   los resultados.
5. `Escape` cierra el panel.
6. `npm run build --prefix frontend` produce chunks `HelpPanel-*` y `marked-*` separados.

Y de los manuales:

```bash
python3 scripts/md-a-pdf.py --manual breve
python3 scripts/md-a-pdf.py --manual completo
```

El breve no debe contener el texto de los `<details>`; el completo sí.
