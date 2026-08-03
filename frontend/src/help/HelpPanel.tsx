/**
 * Panel lateral de ayuda.
 *
 * Abre en el artículo de la pantalla desde la que se pulsó, pero el buscador de
 * arriba recorre TODOS los artículos a los que el usuario tiene acceso: si no
 * sabes en qué pantalla está la respuesta, la encuentras igual.
 *
 * Este módulo se carga con `React.lazy` desde HelpProvider, y `marked` se
 * importa dinámicamente dentro de él, siguiendo el patrón de `export/buildPdf.ts`.
 */

import React from 'react';
import { X, Search, ChevronLeft, BookOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth.js';
import { articulosVisibles, buscarArticulo } from './registry.js';
import type { Articulo } from './registry.js';
import { buscar, construirIndice } from './buscar.js';
import type { Resultado } from './buscar.js';

interface Props {
  articuloInicial?: string;
  onCerrar: () => void;
}

/** Convierte Markdown a HTML. `marked` entra en el chunk de este panel. */
function useHtml(markdown: string | undefined): string {
  const [html, setHtml] = React.useState('');

  React.useEffect(() => {
    if (!markdown) {
      setHtml('');
      return;
    }
    let vigente = true;
    void (async () => {
      const { marked } = await import('marked');
      const salida = await marked.parse(markdown, { gfm: true, breaks: false });
      if (vigente) setHtml(salida);
    })();
    return () => { vigente = false; };
  }, [markdown]);

  return html;
}

export default function HelpPanel({ articuloInicial, onCerrar }: Props): React.ReactElement {
  const { user } = useAuth();

  const articulos = React.useMemo(() => articulosVisibles(user), [user]);
  const indice = React.useMemo(() => construirIndice(articulos), [articulos]);

  const [consulta, setConsulta] = React.useState('');
  const [actualId, setActualId] = React.useState<string | undefined>(articuloInicial);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const cuerpoRef = React.useRef<HTMLDivElement>(null);

  // Escape cierra. Es el primer atajo de teclado global del proyecto; se
  // registra solo mientras el panel está montado.
  React.useEffect(() => {
    const alPulsar = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [onCerrar]);

  const resultados: Resultado[] = React.useMemo(
    () => buscar(indice, articulos, consulta),
    [indice, articulos, consulta],
  );

  const buscando = consulta.trim().length >= 2;

  // El artículo pedido puede no estar disponible para este usuario.
  const actual: Articulo | undefined = React.useMemo(() => {
    if (!actualId) return undefined;
    const a = buscarArticulo(actualId);
    return a && articulos.some((v) => v.id === a.id) ? a : undefined;
  }, [actualId, articulos]);

  const html = useHtml(buscando ? undefined : actual?.markdown);

  // Al cambiar de artículo, volver arriba: si no, se entra a mitad del texto.
  React.useEffect(() => {
    cuerpoRef.current?.scrollTo({ top: 0 });
  }, [actualId, buscando]);

  function irA(id: string): void {
    setActualId(id);
    setConsulta('');
  }

  return (
    <div className="help-overlay" onMouseDown={onCerrar}>
      <aside
        className="help-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Ayuda"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="help-panel__head">
          <div className="help-panel__titulo">
            {actual && !buscando ? (
              <>
                <button
                  type="button"
                  className="help-volver"
                  onClick={() => setActualId(undefined)}
                  title="Ver todos los temas"
                >
                  <ChevronLeft size={16} />
                </button>
                <span>{actual.titulo}</span>
              </>
            ) : (
              <>
                <BookOpen size={17} style={{ color: '#1e40af' }} />
                <span>Ayuda</span>
              </>
            )}
          </div>
          <button type="button" className="modal-close" onClick={onCerrar} aria-label="Cerrar ayuda">
            <X size={18} />
          </button>
        </header>

        <div className="help-buscador">
          <Search size={15} />
          <input
            ref={inputRef}
            type="search"
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Buscar en toda la ayuda…"
            aria-label="Buscar en la ayuda"
            autoFocus
          />
        </div>

        <div className="help-panel__cuerpo" ref={cuerpoRef}>
          {buscando ? (
            resultados.length === 0 ? (
              <p className="help-vacio">
                Nada coincide con «{consulta}». Prueba con otra palabra, o mira la lista
                de temas cerrando la búsqueda.
              </p>
            ) : (
              <ul className="help-resultados">
                {resultados.map((r, i) => (
                  <li key={`${r.articuloId}-${r.seccion}-${i}`}>
                    <button type="button" onClick={() => irA(r.articuloId)}>
                      <span className="help-resultado__titulo">
                        {r.articuloTitulo}
                        {r.seccion && <span className="help-resultado__seccion"> · {r.seccion}</span>}
                      </span>
                      <span className="help-resultado__extracto">{r.extracto}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : actual ? (
            // El contenido lo escribe el equipo en el repositorio: mismo nivel de
            // confianza que el propio código. Nada aquí viene del usuario ni de
            // la base de datos.
            <article className="help-articulo" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <>
              <p className="help-intro">
                Elige un tema o usa el buscador. Solo aparecen las secciones a las que
                tienes acceso.
              </p>
              <ul className="help-temas">
                {articulos.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => irA(a.id)}>{a.titulo}</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
