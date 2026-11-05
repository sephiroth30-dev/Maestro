/**
 * Rótulo legible de un tipo de pagador. Compartido entre Reportes y el bloque
 * comparativo para que el mismo tipo no se llame distinto en dos sitios.
 */
export const TIPO_DISPLAY_LABEL: Record<string, string> = {
  EPS:             'EPS',
  CONVENIO:        'Convenio (cobro)',
  CONVENIO__CAJA:  'Convenio (directo)',
  ARL:             'ARL',
  PARTICULAR:      'Particular',
  OTRO:            'Otro',
  OTRO__CAJA:      'Otro (caja)',
};

export function tipoLabel(tipo: string): string {
  return TIPO_DISPLAY_LABEL[tipo] ?? tipo.replace('__CAJA', ' (caja)');
}
