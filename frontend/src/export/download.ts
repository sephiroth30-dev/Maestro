/**
 * Descarga de blobs en el navegador.
 *
 * Corrige el defecto latente de `api/liquidaciones.ts:descargarPDF`, que crea
 * el anchor pero nunca lo inserta en el DOM: Chrome lo tolera, algunas
 * versiones de Firefox no disparan la descarga.
 */

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
