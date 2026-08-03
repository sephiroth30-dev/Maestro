# Sistema de exportación

Cómo funciona la descarga de reportes en PDF, Excel y CSV, y cómo añadirla a una página
nueva.

Para el uso desde la interfaz, ver el manual de usuario. Este documento es para quien
toque el código.

---

## Idea central

Cada página **declara qué exportar** con un descriptor (`ExportDoc`); el código
compartido resuelve **cómo generarlo** en cada formato. La página no sabe nada de PDF ni
de Excel, y los generadores no saben nada de honorarios ni de pacientes.

Sin esa separación harían falta tres implementaciones por página (una por formato) y
cualquier cambio de estilo obligaría a tocarlas todas.

**Todo ocurre en el navegador.** No hay endpoints de exportación. Las razones:

- El servidor está en hosting compartido con memoria limitada.
- Varios filtros de Reportes son solo del cliente (tipo de pagador, grupo caja/cobro).
  Generar en el servidor produciría un archivo que no coincide con la pantalla.

La única excepción es el comprobante de honorarios individual
(`GET /api/liquidaciones/:id/pdf`), que ya existía y se genera con pdfkit en el backend.

---

## Archivos

Todo vive en `frontend/src/export/`.

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | `ExportDoc`, `ExportSection`, `ExportColumn` y el helper `defineTable`. Sin dependencias. |
| `format.ts` | Formato de celdas, saneado para PDF, `slugify`, y dónde va la etiqueta de totales. |
| `brand.ts` | Colores, márgenes y textos de marca. Replican el comprobante del backend. |
| `logo.ts` | Logotipo vectorial rasterizado a PNG, memoizado. |
| `svgToPng.ts` | Convierte una gráfica de recharts en imagen. |
| `buildPdf.ts` | Generador PDF. **Importa jsPDF de forma dinámica.** |
| `buildExcel.ts` | Generador Excel. **Importa ExcelJS de forma dinámica.** |
| `buildCsv.ts` | Generador CSV, sin dependencias. |
| `presets.ts` | Los cuatro presets y la política de acceso a valores por rol. |
| `useExportSelection.ts` | Estado del diálogo y `applySelection`, que proyecta el documento. |
| `ExportDialog.tsx` | El modal. Reutiliza las clases `.modal-*` existentes. |
| `ExportButton.tsx` | El botón. Es lo único que importa una página. |
| `docs/*.ts` | Un descriptor por página. Aquí va todo lo específico del dominio. |

Y `frontend/export-test.html` + `src/export-test.tsx`: un banco de pruebas que ejercita
los tres formatos con datos que llevan acentos, símbolos raros y una gráfica real. Se
abre en desarrollo en `/export-test.html` y **no entra al build de producción** (Vite
solo empaqueta `index.html`).

---

## Añadir exportación a una página nueva

**1. Escribir el descriptor** en `frontend/src/export/docs/miPaginaDoc.ts`:

```ts
export function buildMiPaginaDoc(i: MiPaginaDocInput): ExportDoc {
  return {
    fileBase: 'mi-pagina',
    title: 'Mi Página',
    subtitle: 'Clínica Neurofic',
    periodLabel: i.periodLabel,
    filters: [{ label: 'Período', value: i.periodLabel }],
    orientation: 'portrait',
    sections: [
      { kind: 'kpis', id: 'resumen', title: 'Resumen', items: [
        { label: 'Total', value: i.total, format: 'currency', money: true },
      ]},
      defineTable<MiFila>({
        id: 'detalle',
        title: 'Detalle',
        columns: [
          { key: 'nombre', header: 'Nombre', accessor: (r) => r.nombre, width: 30 },
          { key: 'valor',  header: 'Valor',  accessor: (r) => r.valor,
            format: 'currency', money: true },
        ],
        rows: i.filas,
        totals: { label: 'TOTAL', values: { valor: suma } },
      }),
    ],
  };
}
```

**2. Colocar el botón** en la página:

```tsx
const buildExportDoc = useMemo(() => () => buildMiPaginaDoc({ … }), [deps]);
…
<ExportButton buildDoc={buildExportDoc} disabled={isLoading} />
```

`buildDoc` es una **función**, no un valor: así el descriptor se construye al abrir el
diálogo, y los `getEl()` de las gráficas se resuelven cuando ya están montadas.

**3. Si hay gráficas**, poner un `ref` en la tarjeta contenedora y pasarlo:

```tsx
const refGrafica = useRef<HTMLDivElement>(null);
<div className="chart-card" ref={refGrafica}> … </div>
```

```ts
{ kind: 'chart', id: 'mi-grafica', title: 'Mi gráfica',
  getEl: () => refGrafica.current,
  fallbackTable: /* tabla equivalente — ver abajo por qué es obligatoria */ }
```

---

## Reglas que no son negociables

### `money: true` en toda columna con dinero

Es lo que hace funcionar el preset «Vista médicos (sin valores)» **y** la restricción por
rol. Una columna monetaria sin la marca se cuela en un archivo que promete no llevar
valores.

### Toda gráfica necesita `fallbackTable`

Por dos motivos:

1. **Excel y CSV no incrustan imágenes**; la tabla es lo que se exporta ahí.
2. **Las gráficas de recharts dibujan las cifras dentro del propio SVG** — el eje Y de
   cumplimiento y el centro del donut llevan importes en pesos. Para un rol sin acceso
   financiero, `applySelection` sustituye la imagen por la tabla, que sí viene filtrada.
   Sin `fallbackTable` la sección desaparece.

La tabla debe describir **lo mismo** que la gráfica. Si la gráfica usa datos sin filtrar
y la tabla los filtrados, el PDF se contradice a sí mismo en la misma página.

### La restricción por rol se aplica en el generador

`applySelection(doc, selection, permitirValores)` descarta las columnas monetarias
aunque la selección diga lo contrario. Los checkboxes son comodidad; la restricción es
la función. Los roles sin acceso están en `ROLES_SIN_VALORES` (`presets.ts`).

### Los importes van crudos a Excel

`excelValue()` escribe número o `Date`, nunca texto pre-formateado, y el formato se
aplica con `numFmt`. Una celda con `"$ 1.234"` como texto no se puede sumar, que es justo
para lo que se exporta.

### Las librerías se importan dinámicamente

jsPDF y ExcelJS pesan ~400 kB gzip juntos. Solo se cargan al pulsar Generar:

```ts
const ExcelJS = (await import('exceljs')).default;   // dentro de la función
import type { Workbook } from 'exceljs';             // el tipo sí es estático
```

Un `import { Workbook } from 'exceljs'` (sin `type`) devuelve las librerías al paquete
principal sin que nada falle a la vista. Se verifica mirando que `npm run build` produzca
chunks separados `jspdf-*.js` y `exceljs-*.js`.

---

## Datos que no están en el cliente

Cuando la página no tiene todo cargado —Auditoría pagina en el servidor— se usa
`resolveDoc`:

```tsx
<ExportButton
  buildDoc={buildPreview}       // lo que ya hay: alimenta el diálogo
  resolveDoc={resolveCompleto}  // async: se ejecuta al pulsar Generar
/>
```

`resolveDoc` debe producir los **mismos `section.id`** que `buildDoc`, porque la
selección se indexa por ellos.

Ejemplos: Auditoría (pagina de a 200, tope 2.000) y el botón Detalle de Reportes (pide
las atenciones al generar, tope 5.000).

---

## Detalles que costaron encontrarse

**Acentos en PDF.** Las fuentes estándar de jsPDF usan WinAnsi (cp1252), que **sí** cubre
`á é í ó ú ñ ¿ ¡` — no hace falta incrustar una fuente. Lo que no cubre son los símbolos
que la aplicación usa en textos visibles: `✓ ✗ ≠ → ↑ ↓ ⏳ ⚠`. `toPdfSafe()` los sustituye
y debe aplicarse a **toda** celda; está centralizado en `buildPdf.ts` para que no se
olvide.

**Capturar la gráfica.** Se serializa el `<svg>` a un Blob URL y se rasteriza en canvas.
Nunca con `btoa()`: revienta con acentos (basta un «Miércoles» en el eje X). Se busca
`svg.recharts-surface` y no el primer `<svg>`: si la tarjeta está en estado de error, el
primero es el icono de recargar y acabaría incrustado a media página como si fuera la
gráfica. Se descartan capturas menores de 80 px por lo mismo.

**Compresión.** Sin `compress: true` en jsPDF, un PDF con logo y una gráfica pesa ~3 MB;
con él, ~50 kB.

**Fórmulas en CSV.** Una celda que empieza por `= + - @` se ejecuta al abrir el archivo en
Excel. Un nombre de entidad viene del origen y puede empezar así, de modo que `esc()` le
antepone un apóstrofo.

**Fechas.** `new Date('2026-07-01')` se interpreta como UTC y en Colombia se muestra como
30 de junio. Usar `parseLocalDate()`.

---

## Verificación

No hay pruebas automatizadas. El banco de pruebas permite comprobar a mano:

```bash
npm run dev --prefix frontend     # abrir http://localhost:5173/export-test.html
```

Lista mínima al tocar el sistema:

1. PDF con todo: logotipo, acentos correctos, gráfica presente, `Página N de M` en todas.
2. PDF con «Vista médicos»: **ni un solo símbolo `$`** en el archivo.
3. Excel: encabezado fijo, y la columna de importes suma al seleccionarla.
4. Una tabla larga: el encabezado se repite en cada página.
5. `npm run build --prefix frontend`: deben aparecer chunks `jspdf-*` y `exceljs-*`
   separados del principal.
