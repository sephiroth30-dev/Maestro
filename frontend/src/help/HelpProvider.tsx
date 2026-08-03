/**
 * Estado compartido de la ayuda.
 *
 * Una sola instancia del panel para toda la aplicación: los botones "?" de cada
 * página solo piden abrirlo con un artículo concreto. El panel se carga con
 * `React.lazy`, así que ni el contenido ni el parseador de Markdown entran al
 * paquete principal hasta que alguien pulsa el botón por primera vez.
 */

import React, { Suspense } from 'react';

const HelpPanel = React.lazy(() => import('./HelpPanel.js'));

interface HelpContextValue {
  abrir: (articuloId?: string) => void;
  cerrar: () => void;
  abierto: boolean;
}

const HelpContext = React.createContext<HelpContextValue | null>(null);

export function useHelp(): HelpContextValue {
  const ctx = React.useContext(HelpContext);
  if (!ctx) {
    // Falla explícito en vez de en silencio: un botón "?" fuera del proveedor
    // simplemente no haría nada y costaría entender por qué.
    throw new Error('useHelp debe usarse dentro de <HelpProvider>');
  }
  return ctx;
}

export function HelpProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [abierto, setAbierto] = React.useState(false);
  const [articuloId, setArticuloId] = React.useState<string | undefined>();

  const abrir = React.useCallback((id?: string) => {
    setArticuloId(id);
    setAbierto(true);
  }, []);

  const cerrar = React.useCallback(() => setAbierto(false), []);

  const valor = React.useMemo(() => ({ abrir, cerrar, abierto }), [abrir, cerrar, abierto]);

  return (
    <HelpContext.Provider value={valor}>
      {children}
      {abierto && (
        <Suspense fallback={null}>
          <HelpPanel articuloInicial={articuloId} onCerrar={cerrar} />
        </Suspense>
      )}
    </HelpContext.Provider>
  );
}
