/**
 * Tipos del sistema de exportación.
 *
 * Cada página declara QUÉ exportar mediante un `ExportDoc`; el código
 * compartido resuelve CÓMO generarlo (PDF / Excel / CSV).
 *
 * Sin dependencias en runtime — este archivo debe poder importarse desde
 * cualquier página sin arrastrar librerías al bundle principal.
 */

export type ExportFormat = 'pdf' | 'excel' | 'csv';

export type CellFormat =
  | 'text'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime';

export type CellValue = string | number | Date | null | undefined;

export interface ExportColumn<T = unknown> {
  /** Identificador estable — es la llave del checkbox en el diálogo. */
  key: string;
  header: string;
  accessor: (row: T) => CellValue;
  /** Por defecto 'text'. */
  format?: CellFormat;
  /** Por defecto: derecha para number/currency/percent, izquierda para el resto. */
  align?: 'left' | 'center' | 'right';
  /** true ⇒ el preset "Vista médicos (sin valores)" la desmarca. */
  money?: boolean;
  /** PDF: peso relativo de la columna. Excel: ancho en caracteres. */
  width?: number;
  /** Arranca desmarcada. */
  hidden?: boolean;
}

export interface ExportTotalsRow {
  label: string;
  /** Valores indexados por `ExportColumn.key`. */
  values: Record<string, CellValue>;
}

interface SectionBase {
  id: string;
  title: string;
  /** Nota aclaratoria que se imprime bajo el título. */
  note?: string;
}

export interface ExportTableSection<T = unknown> extends SectionBase {
  kind: 'table';
  columns: ExportColumn<T>[];
  rows: T[];
  totals?: ExportTotalsRow | null;
}

export interface ExportKpiItem {
  label: string;
  value: CellValue;
  format?: CellFormat;
  money?: boolean;
  hint?: string;
}

export interface ExportKpiSection extends SectionBase {
  kind: 'kpis';
  items: ExportKpiItem[];
}

export interface ExportChartSection extends SectionBase {
  kind: 'chart';
  /** Se resuelve en el momento de generar, no al construir el descriptor. */
  getEl: () => HTMLElement | null;
  /** Se usa en Excel/CSV y cuando la captura de la gráfica falla. */
  fallbackTable?: ExportTableSection;
}

export type ExportSection =
  | ExportTableSection
  | ExportKpiSection
  | ExportChartSection;

export interface ExportFilterChip {
  label: string;
  value: string;
}

export interface ExportDoc {
  /** Base del nombre de archivo, sin extensión ni período. */
  fileBase: string;
  title: string;
  subtitle?: string;
  periodLabel: string;
  filters: ExportFilterChip[];
  sections: ExportSection[];
  orientation?: 'portrait' | 'landscape';
}

export interface ExportSelection {
  sections: Record<string, boolean>;
  /** sectionId → columnKey → incluida. */
  columns: Record<string, Record<string, boolean>>;
  orientation: 'portrait' | 'landscape';
  format: ExportFormat;
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  warnings: string[];
}

/**
 * Construye una sección de tabla borrando el genérico de fila de forma segura.
 *
 * `ExportSection` es una unión, así que almacenar `ExportTableSection<T>` con
 * distintos `T` obligaría a `any`. Este helper deja los call-sites totalmente
 * tipados y la unión libre de `any`.
 */
export function defineTable<T>(s: {
  id: string;
  title: string;
  note?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  totals?: ExportTotalsRow | null;
}): ExportTableSection {
  return {
    kind: 'table',
    id: s.id,
    title: s.title,
    note: s.note,
    rows: s.rows as unknown[],
    totals: s.totals ?? null,
    columns: s.columns.map((c) => ({
      ...c,
      accessor: (r: unknown) => c.accessor(r as T),
    })),
  };
}

/** Alineación por defecto según el formato de la celda. */
export function defaultAlign(format?: CellFormat): 'left' | 'center' | 'right' {
  switch (format) {
    case 'number':
    case 'currency':
    case 'percent':
      return 'right';
    case 'date':
    case 'datetime':
      return 'center';
    default:
      return 'left';
  }
}
