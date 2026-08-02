/**
 * Estado de seleccion del dialogo de exportacion.
 *
 * Todo arranca marcado; los presets solo reescriben ese estado. `applySelection`
 * proyecta el `ExportDoc` original a uno filtrado que los generadores consumen
 * sin volver a razonar sobre la seleccion.
 */

import React from 'react';
import type {
  ExportDoc,
  ExportFormat,
  ExportSection,
  ExportSelection,
  ExportTableSection,
} from './types.js';
import type { PresetId } from './presets.js';

function sectionHasMoney(s: ExportSection): boolean {
  if (s.kind === 'table') return s.columns.some((c) => c.money);
  if (s.kind === 'kpis') return s.items.some((i) => i.money);
  if (s.kind === 'chart') return Boolean(s.fallbackTable?.columns.some((c) => c.money));
  return false;
}

/** ¿El documento tiene alguna columna monetaria? Si no, el preset sobra. */
export function docTieneValores(doc: ExportDoc): boolean {
  return doc.sections.some(sectionHasMoney);
}

function buildSelection(doc: ExportDoc, preset: PresetId, permitirValores: boolean): ExportSelection {
  const sections: Record<string, boolean> = {};
  const columns: Record<string, Record<string, boolean>> = {};
  const ocultarDinero = !permitirValores || preset === 'sin-valores';

  for (const s of doc.sections) {
    let on = true;
    if (preset === 'solo-tablas' && s.kind === 'chart') on = false;
    if (preset === 'resumen' && s.kind === 'table') on = false;
    // Una sección cuyas columnas son todas monetarias no aporta nada sin ellas.
    if (ocultarDinero && s.kind === 'table' && s.columns.length > 0 && s.columns.every((c) => c.money)) {
      on = false;
    }
    sections[s.id] = on;

    if (s.kind === 'table' || (s.kind === 'chart' && s.fallbackTable)) {
      const table: ExportTableSection = s.kind === 'table' ? s : s.fallbackTable!;
      const cols: Record<string, boolean> = {};
      for (const c of table.columns) {
        cols[c.key] = c.hidden ? false : !(ocultarDinero && c.money);
      }
      columns[s.id] = cols;
    }
  }

  return {
    sections,
    columns,
    orientation: doc.orientation ?? 'portrait',
    format: 'pdf',
  };
}

export interface UseExportSelection {
  selection: ExportSelection;
  preset: PresetId | null;
  setFormat: (f: ExportFormat) => void;
  setOrientation: (o: 'portrait' | 'landscape') => void;
  toggleSection: (id: string) => void;
  toggleColumn: (sectionId: string, colKey: string) => void;
  applyPreset: (p: PresetId) => void;
  reset: () => void;
}

export function useExportSelection(doc: ExportDoc | null, permitirValores: boolean): UseExportSelection {
  const initial = React.useMemo<ExportSelection>(
    () =>
      doc
        ? buildSelection(doc, 'todo', permitirValores)
        : { sections: {}, columns: {}, orientation: 'portrait', format: 'pdf' },
    [doc, permitirValores],
  );

  const [selection, setSelection] = React.useState<ExportSelection>(initial);
  const [preset, setPreset] = React.useState<PresetId | null>('todo');

  // Cuando cambia el documento (otro periodo, otros filtros) la seleccion se
  // reconstruye: mantener checkboxes de columnas que ya no existen produce
  // exportaciones vacias sin explicacion.
  React.useEffect(() => {
    setSelection(initial);
    setPreset('todo');
  }, [initial]);

  const applyPreset = React.useCallback(
    (p: PresetId) => {
      if (!doc) return;
      setSelection((prev) => ({ ...buildSelection(doc, p, permitirValores), format: prev.format, orientation: prev.orientation }));
      setPreset(p);
    },
    [doc, permitirValores],
  );

  const toggleSection = React.useCallback((id: string) => {
    setPreset(null);
    setSelection((prev) => ({ ...prev, sections: { ...prev.sections, [id]: !prev.sections[id] } }));
  }, []);

  const toggleColumn = React.useCallback((sectionId: string, colKey: string) => {
    setPreset(null);
    setSelection((prev) => {
      const cols = prev.columns[sectionId] ?? {};
      return {
        ...prev,
        columns: { ...prev.columns, [sectionId]: { ...cols, [colKey]: !cols[colKey] } },
      };
    });
  }, []);

  const setFormat = React.useCallback((format: ExportFormat) => {
    setSelection((prev) => ({ ...prev, format }));
  }, []);

  const setOrientation = React.useCallback((orientation: 'portrait' | 'landscape') => {
    setSelection((prev) => ({ ...prev, orientation }));
  }, []);

  const reset = React.useCallback(() => applyPreset('todo'), [applyPreset]);

  return { selection, preset, setFormat, setOrientation, toggleSection, toggleColumn, applyPreset, reset };
}

/**
 * Proyecta el documento segun la seleccion.
 *
 * `permitirValores === false` descarta las columnas monetarias aqui tambien,
 * no solo en la UI: la restriccion por rol debe cumplirse en el generador.
 */
export function applySelection(
  doc: ExportDoc,
  sel: ExportSelection,
  permitirValores: boolean,
): ExportDoc {
  const filterTable = (t: ExportTableSection, sectionId: string): ExportTableSection => {
    const picks = sel.columns[sectionId] ?? {};
    const columns = t.columns.filter(
      (c) => picks[c.key] !== false && !(!permitirValores && c.money),
    );
    // Si ninguna columna con total sobrevive, la fila de totales quedaria como
    // una banda azul con la etiqueta y nada mas.
    const keys = new Set(columns.map((c) => c.key));
    const totals =
      t.totals && Object.keys(t.totals.values).some((k) => keys.has(k)) ? t.totals : null;
    return { ...t, columns, totals };
  };

  const sections = doc.sections
    // Estricto `=== true`: una sección que no existia cuando se abrio el
    // dialogo (porque su consulta aun cargaba) no debe colarse al exportar.
    .filter((s) => sel.sections[s.id] === true)
    .map((s): ExportSection | null => {
      if (s.kind === 'table') return filterTable(s, s.id);
      if (s.kind === 'kpis') {
        return { ...s, items: s.items.filter((i) => !(!permitirValores && i.money)) };
      }

      const fallback = s.fallbackTable ? filterTable(s.fallbackTable, s.id) : undefined;

      // Las graficas de recharts dibujan las cifras DENTRO del <svg> (ejes en
      // pesos, total en el centro del donut), asi que filtrar columnas no basta:
      // para un rol sin acceso financiero hay que sustituir la imagen por su
      // tabla equivalente, que si viene saneada.
      if (!permitirValores) return fallback ?? null;

      // Una grafica que no esta montada y no tiene tabla equivalente no aporta
      // nada; se descarta aqui y no depende del estado del checkbox.
      if (!fallback && s.getEl() === null) return null;

      return { ...s, fallbackTable: fallback };
    })
    .filter((s): s is ExportSection => s !== null)
    // Una tabla sin columnas o unos KPIs sin items no deben generar una hoja
    // vacia ni un titulo huerfano en el PDF.
    .filter((s) => {
      if (s.kind === 'table') return s.columns.length > 0;
      if (s.kind === 'kpis') return s.items.length > 0;
      return true;
    });

  return { ...doc, sections, orientation: sel.orientation };
}
