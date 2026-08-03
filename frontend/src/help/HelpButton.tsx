/**
 * El botón "?" que abre la ayuda de la pantalla actual.
 *
 * Deliberadamente ligero: no importa nada del panel ni del contenido, solo el
 * contexto. Así el paquete principal no crece por tenerlo en ocho páginas.
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useHelp } from './HelpProvider.js';

interface Props {
  /** `id` del artículo que corresponde a esta pantalla. */
  articulo: string;
  /** Texto junto al icono. Sin él queda solo el icono. */
  etiqueta?: string;
}

export function HelpButton({ articulo, etiqueta }: Props): React.ReactElement {
  const { abrir } = useHelp();

  return (
    <button
      type="button"
      className={`help-btn${etiqueta ? ' help-btn--con-texto' : ''}`}
      onClick={() => abrir(articulo)}
      title="Ayuda de esta sección"
      aria-label="Abrir ayuda de esta sección"
    >
      <HelpCircle size={16} />
      {etiqueta && <span>{etiqueta}</span>}
    </button>
  );
}
