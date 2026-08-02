/**
 * Boton de exportacion reutilizable.
 *
 * `buildDoc` es una FUNCION, no un valor: asi el descriptor se construye solo
 * al abrir el dialogo y los refs de graficas (`getEl`) se resuelven en el
 * momento de generar, cuando los componentes estan montados.
 */

import React from 'react';
import { Download } from 'lucide-react';
import type { ExportDoc, ExportFormat, ExportSelection } from './types.js';
import { ExportDialog } from './ExportDialog.js';
import { applySelection } from './useExportSelection.js';
import { puedeVerValores } from './presets.js';
import { saveBlob } from './download.js';
import { slugify } from './format.js';
import { useAuth } from '../hooks/useAuth.js';

interface Props {
  /** Descriptor sincrono, con los datos que la pagina ya tiene. Alimenta el dialogo. */
  buildDoc: () => ExportDoc;
  disabled?: boolean;
  label?: string;
  /**
   * Descriptor definitivo para el momento de generar. Solo hace falta cuando la
   * pagina no tiene todos los datos en el cliente (Auditoria pagina en el
   * servidor) y hay que traerlos antes de escribir el archivo. Debe producir las
   * MISMAS `section.id` que `buildDoc`, porque la seleccion se indexa por ellas.
   */
  resolveDoc?: () => Promise<ExportDoc>;
}

const EXT: Record<ExportFormat, string> = { pdf: 'pdf', excel: 'xlsx', csv: 'csv' };

export function ExportButton({ buildDoc, disabled, label, resolveDoc }: Props): React.ReactElement {
  const { user } = useAuth();
  const permitirValores = puedeVerValores(user?.rol);

  const [open, setOpen] = React.useState(false);
  const [doc, setDoc] = React.useState<ExportDoc | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  function handleOpen(): void {
    setWarnings([]);
    setError(null);
    setDoc(buildDoc());
    setOpen(true);
  }

  function handleClose(): void {
    setOpen(false);
    setDoc(null);
  }

  async function handleGenerate(
    format: ExportFormat,
    orientation: 'portrait' | 'landscape',
    selection: ExportSelection,
  ): Promise<void> {
    setGenerating(true);
    setWarnings([]);
    setError(null);
    // Deja pintar el spinner antes de bloquear el hilo principal.
    await new Promise((r) => setTimeout(r, 0));

    try {
      // Se reconstruye el descriptor: los datos pudieron cambiar mientras el
      // dialogo estaba abierto.
      const source = resolveDoc ? await resolveDoc() : buildDoc();
      const fresh = applySelection(source, { ...selection, orientation }, permitirValores);
      const base = `${slugify(fresh.fileBase)}_${slugify(fresh.periodLabel)}`;
      const filename = `${base}.${EXT[format]}`;

      if (format === 'pdf') {
        const { buildPdf } = await import('./buildPdf.js');
        const res = await buildPdf(fresh);
        saveBlob(res.blob, filename);
        if (res.warnings.length > 0) {
          setWarnings(res.warnings);
          setGenerating(false);
          return;
        }
      } else if (format === 'excel') {
        const { buildExcel } = await import('./buildExcel.js');
        saveBlob(await buildExcel(fresh), filename);
      } else {
        const { buildCsv } = await import('./buildCsv.js');
        saveBlob(buildCsv(fresh), filename);
      }

      setGenerating(false);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el archivo.');
      setGenerating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--secondary"
        onClick={handleOpen}
        disabled={disabled}
        title="Descargar este reporte en PDF, Excel o CSV"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Download size={15} />
        {label ?? 'Exportar'}
      </button>

      {open && doc && (
        <ExportDialog
          doc={doc}
          permitirValores={permitirValores}
          generating={generating}
          warnings={warnings}
          error={error}
          onGenerate={(f, o, s) => void handleGenerate(f, o, s)}
          onClose={handleClose}
        />
      )}
    </>
  );
}
