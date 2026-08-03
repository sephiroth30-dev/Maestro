/**
 * Constantes de marca para los documentos generados.
 *
 * Los valores replican el comprobante de honorarios que ya genera el backend
 * (`backend/src/services/liquidaciones.service.ts`) para que ambos PDFs se
 * vean como parte de la misma familia.
 */

export const BRAND = {
  nombre: 'NEUROFIC',
  descriptor: 'Centro de Neurofisiología Clínica',
  sitio: 'dashboard.neurofic.com',
} as const;

/** Paleta en RGB — jsPDF trabaja con componentes, no con hex. */
export const RGB = {
  azul: [30, 64, 175] as [number, number, number], // #1e40af
  azulClaro: [59, 130, 246] as [number, number, number], // #3b82f6
  rojo: [239, 20, 64] as [number, number, number], // #ef1440 corporativo
  tinta: [15, 23, 42] as [number, number, number], // #0f172a
  pizarra: [71, 85, 105] as [number, number, number], // #475569
  gris: [100, 116, 139] as [number, number, number], // #64748b
  borde: [226, 232, 240] as [number, number, number], // #e2e8f0
  claro: [241, 245, 249] as [number, number, number], // #f1f5f9
  cebra: [250, 250, 250] as [number, number, number], // #fafafa
  aviso: [254, 249, 195] as [number, number, number], // #fef9c3
  blanco: [255, 255, 255] as [number, number, number],
};

/** Equivalentes ARGB para ExcelJS. */
export const ARGB = {
  encabezadoFondo: 'FFF1F5F9',
  encabezadoTexto: 'FF475569',
  totalFondo: 'FF1E40AF',
  totalTexto: 'FFFFFFFF',
  tituloTexto: 'FF0F172A',
  notaTexto: 'FF64748B',
} as const;

/** Geometria en puntos — carta, mismos margenes que el comprobante. */
export const PAGE = {
  marginLeft: 60,
  marginRight: 60,
  marginTop: 50,
  marginBottom: 50,
  /** Espacio reservado arriba en las paginas de continuacion. */
  contentTop: 96,
} as const;

const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function fmtFechaLarga(d: Date): string {
  return FECHA_LARGA.format(d);
}

export function pieDePagina(d: Date): string {
  return `Generado el ${fmtFechaLarga(d)} - Neurofic Admin - ${BRAND.sitio}`;
}
